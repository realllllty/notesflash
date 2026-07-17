import { characterNgrams, cosineSimilarity, makeSnippet, normalizeText } from './text';
import { NativeHttpError, runtimeFetch } from './runtime-fetch';
import type {
  ConnectionProfile,
  CreateNoteInput,
  ImageAsset,
  Note,
  NotesClient,
  PairingCode,
  PairingResponse,
  SearchHit,
  SortMode,
  UpdateNoteInput
} from './types';

const CONNECTION_KEY = 'notesflash.connection.v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function loadConnection(): ConnectionProfile | null {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY);
    return raw ? (JSON.parse(raw) as ConnectionProfile) : null;
  } catch {
    return null;
  }
}

export function saveConnection(profile: ConnectionProfile): void {
  localStorage.setItem(CONNECTION_KEY, JSON.stringify(profile));
}

export function clearConnection(): void {
  localStorage.removeItem(CONNECTION_KEY);
}

export async function pairDevice(
  endpoint: string,
  code: string,
  deviceName: string
): Promise<ConnectionProfile> {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const response = await fetchWorker(normalizedEndpoint, '/api/devices/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: code.trim(), deviceName, platform: clientPlatform() })
  });

  const payload = await readWorkerPayload(response, normalizedEndpoint);
  if (!response.ok) throw toApiError(response, payload);

  const result = payload as Partial<PairingResponse> & { accessToken?: string };
  const token = result.token ?? result.accessToken;
  if (!token || !result.instanceId) {
    throw new ApiError('配对响应缺少必要字段。', 500, 'INVALID_PAIRING_RESPONSE', payload);
  }

  return {
    endpoint: normalizedEndpoint,
    token,
    instanceId: result.instanceId,
    deviceId: result.deviceId
  };
}

export class RemoteNotesClient implements NotesClient {
  constructor(private readonly connection: ConnectionProfile) {}

  async logout(): Promise<void> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      await this.request('/api/auth/logout', { method: 'POST', signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async createPairingCode(): Promise<PairingCode> {
    const payload = await this.request('/api/pairing-codes', { method: 'POST' });
    return mapPairingCode(payload);
  }

  async listNotes(sort: SortMode, onProgress?: (notes: Note[]) => void): Promise<Note[]> {
    const notes: Note[] = [];
    let offset = 0;

    // The product intentionally renders one continuous flat stream. Fetch D1
    // in bounded pages, but keep following nextOffset until the cloud list is
    // complete instead of silently stopping after the first 50 notes.
    for (let page = 0; page < 1000; page += 1) {
      const payload = await this.request(
        `/api/notes?sort=${encodeURIComponent(sort)}&limit=100&offset=${offset}`
      );
      const records = Array.isArray(payload) ? payload : getArray(payload, 'notes');
      notes.push(...records.map((record) => this.mapNote(record)));
      onProgress?.([...notes]);

      const nextOffset = optionalNumber(asRecord(payload).nextOffset);
      if (nextOffset === undefined || nextOffset <= offset || records.length === 0) break;
      offset = nextOffset;
    }

    return notes;
  }

  async createNote(input: CreateNoteInput): Promise<Note> {
    const payload = await this.request('/api/notes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID()
      },
      body: JSON.stringify(input)
    });
    return this.mapNote(getRecord(payload, 'note'));
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    const payload = await this.request(`/api/notes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
    return this.mapNote(getRecord(payload, 'note'));
  }

  async deleteNote(id: string, baseVersion: number): Promise<void> {
    await this.request(`/api/notes/${encodeURIComponent(id)}?baseVersion=${baseVersion}`, {
      method: 'DELETE'
    });
  }

  async lexicalSearch(query: string): Promise<SearchHit[]> {
    const payload = await this.request(`/api/search/lexical?q=${encodeURIComponent(query)}`);
    return this.mapHits(payload, 'lexical');
  }

  async semanticSearch(query: string): Promise<SearchHit[]> {
    const payload = await this.request('/api/search/semantic', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit: 30 })
    });
    return this.mapHits(payload, 'semantic');
  }

  async uploadImage(file: File): Promise<ImageAsset> {
    const form = new FormData();
    form.set('file', file);
    const payload = await this.request('/api/images', { method: 'POST', body: form });
    return this.mapImage(getRecord(payload, 'image'));
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.connection.token}`);
    headers.set('accept', 'application/json');

    const endpoint = normalizeEndpoint(this.connection.endpoint);
    const response = await fetchWorker(endpoint, path, {
      ...init,
      headers
    });
    const payload = await readWorkerPayload(response, endpoint);
    if (!response.ok) throw toApiError(response, payload);
    return payload;
  }

  private mapHits(payload: unknown, fallbackType: 'lexical' | 'semantic'): SearchHit[] {
    const records = Array.isArray(payload) ? payload : getArray(payload, 'results');
    return records.map((record, index) => {
      const value = asRecord(record);
      const note = this.mapNote(value.note ?? value);
      return {
        note,
        matchType: value.matchType === 'both' ? 'both' : fallbackType,
        snippet: typeof value.snippet === 'string'
          ? value.snippet
          : fallbackType === 'semantic'
            ? ''
            : makeSnippet(note.title, note.body, ''),
        score: numberValue(value.score, 1 / (index + 1))
      };
    });
  }

  private mapNote(value: unknown): Note {
    const record = asRecord(value);
    const rawImages = Array.isArray(record.images) ? record.images : [];
    return {
      id: stringValue(record.id),
      title: stringValue(record.title),
      body: stringValue(record.body ?? record.content),
      images: rawImages.map((image) => this.mapImage(image)),
      version: numberValue(record.version, 1),
      createdAt: timestampValue(record.createdAt ?? record.created_at),
      updatedAt: timestampValue(record.updatedAt ?? record.updated_at),
      embeddingStatus: embeddingStatusValue(record.embeddingStatus ?? record.embedding_status)
    };
  }

  private mapImage(value: unknown): ImageAsset {
    const record = asRecord(value);
    const rawUrl = stringValue(record.url ?? record.objectUrl ?? record.object_url);
    return {
      id: stringValue(record.id),
      url: rawUrl.startsWith('/') ? `${this.connection.endpoint}${rawUrl}` : rawUrl,
      name: stringValue(record.name ?? record.filename, '图片'),
      mimeType: stringValue(record.mimeType ?? record.mime_type, 'image/*'),
      width: optionalNumber(record.width),
      height: optionalNumber(record.height),
      size: optionalNumber(record.size)
    };
  }
}

export class DemoNotesClient implements NotesClient {
  private notes: Note[] = demoNotes();
  private images = new Map<string, ImageAsset>();

  constructor() {
    for (const note of this.notes) {
      for (const image of note.images) this.images.set(image.id, image);
    }
  }

  async logout(): Promise<void> {}

  async createPairingCode(): Promise<PairingCode> {
    await delay(180);
    return {
      code: createDemoPairingCode(),
      expiresAt: Date.now() + 10 * 60 * 1000
    };
  }

  async listNotes(sort: SortMode, onProgress?: (notes: Note[]) => void): Promise<Note[]> {
    const result = sortNotes(this.notes.map(cloneNote), sort);
    onProgress?.(result);
    return result;
  }

  async createNote(input: CreateNoteInput): Promise<Note> {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: input.title,
      body: input.body,
      images: (input.imageIds ?? []).map((id) => this.images.get(id)).filter(isImageAsset),
      version: 1,
      createdAt: now,
      updatedAt: now,
      embeddingStatus: 'pending'
    };
    this.notes.unshift(note);
    window.setTimeout(() => {
      const current = this.notes.find((item) => item.id === note.id);
      if (current) current.embeddingStatus = 'ready';
    }, 900);
    return cloneNote(note);
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    const note = this.notes.find((item) => item.id === id);
    if (!note) throw new ApiError('找不到这条笔记。', 404, 'NOTE_NOT_FOUND');
    if (note.version !== input.baseVersion) {
      throw new ApiError('这条笔记已经在另一处被修改。', 409, 'VERSION_CONFLICT', {
        serverNote: cloneNote(note)
      });
    }

    note.title = input.title;
    note.body = input.body;
    note.images = (input.imageIds ?? []).map((imageId) => this.images.get(imageId)).filter(isImageAsset);
    note.version += 1;
    note.updatedAt = Date.now();
    note.embeddingStatus = 'pending';
    window.setTimeout(() => {
      const current = this.notes.find((item) => item.id === id);
      if (current && current.version === note.version) current.embeddingStatus = 'ready';
    }, 900);
    return cloneNote(note);
  }

  async deleteNote(id: string, baseVersion: number): Promise<void> {
    const note = this.notes.find((item) => item.id === id);
    if (!note) return;
    if (note.version !== baseVersion) throw new ApiError('版本冲突。', 409, 'VERSION_CONFLICT');
    this.notes = this.notes.filter((item) => item.id !== id);
  }

  async lexicalSearch(query: string): Promise<SearchHit[]> {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];

    const hits: SearchHit[] = [];
    for (const note of this.notes) {
      const title = normalizeText(note.title);
      const body = normalizeText(note.body);
      const titleIndex = title.indexOf(normalizedQuery);
      const bodyIndex = body.indexOf(normalizedQuery);
      if (titleIndex < 0 && bodyIndex < 0) continue;

      const score =
        (title === normalizedQuery ? 100 : 0) +
        (titleIndex === 0 ? 60 : titleIndex >= 0 ? 35 : 0) +
        (bodyIndex >= 0 ? 20 : 0) +
        Math.max(0, 8 - Math.floor((Date.now() - note.updatedAt) / 86400000));

      hits.push({
        note: cloneNote(note),
        matchType: 'lexical',
        snippet: makeSnippet(note.title, note.body, query),
        score
      });
    }

    return hits.sort((a, b) => b.score - a.score);
  }

  async semanticSearch(query: string): Promise<SearchHit[]> {
    const queryVector = characterNgrams(query);
    await delay(180);

    return this.notes
      .map((note) => {
        const score = cosineSimilarity(queryVector, characterNgrams(`${note.title} ${note.body}`));
        return {
          note: cloneNote(note),
          matchType: 'semantic' as const,
          snippet: makeSnippet(note.title, note.body, query),
          score
        };
      })
      .filter((hit) => hit.score > 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  async uploadImage(file: File): Promise<ImageAsset> {
    const [dimensions, url] = await Promise.all([readImageDimensions(file), readFileDataUrl(file)]);
    const image: ImageAsset = {
      id: crypto.randomUUID(),
      url,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      ...dimensions
    };
    this.images.set(image.id, image);
    return image;
  }
}

function demoNotes(): Note[] {
  const now = Date.now();
  const sampleImage: ImageAsset = {
    id: 'demo-image-layout',
    url: '/icons/notesflash-512.png',
    name: 'NotesFlash 图标',
    mimeType: 'image/png',
    width: 512,
    height: 512,
    size: 18432
  };

  return [
    {
      id: crypto.randomUUID(),
      title: 'Cloudflare 后端部署',
      body: '点击 Deploy to Cloudflare 后，Worker、D1、R2、Vectorize 和 Queue 会在用户自己的账号中创建。\n桌面端只需要填写 Worker 地址与配对码。\n部署完成后打开 /setup 生成一次性配对码。',
      images: [],
      version: 1,
      createdAt: now - 86400000 * 6,
      updatedAt: now - 1000 * 60 * 42,
      embeddingStatus: 'ready'
    },
    {
      id: crypto.randomUUID(),
      title: '快捷检索的交互约定',
      body: 'Command + Shift + Space 唤起窗口。搜索框自动聚焦。\nEnter 或向下键逐行跳到下一个命中，向上键回到上一个。\n同一篇笔记的多处命中会逐行循环，高光不会改变页面尺寸。\nTab 复制当前逻辑行并直接进入对应位置编辑。',
      images: [],
      version: 1,
      createdAt: now - 86400000 * 5,
      updatedAt: now - 1000 * 60 * 60 * 5,
      embeddingStatus: 'ready'
    },
    {
      id: crypto.randomUUID(),
      title: '周末采购清单',
      body: '咖啡豆\n燕麦奶\nUSB-C 线\n相框\n厨房纸巾',
      images: [],
      version: 1,
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000,
      embeddingStatus: 'ready'
    },
    {
      id: crypto.randomUUID(),
      title: '产品定位一句话',
      body: 'NotesFlash 是一个搜索优先、扁平无文件夹的云端笔记。\n桌面负责快速输入，手机 PWA 负责随时回看。\n核心不是整理，而是尽快找到那一行。',
      images: [],
      version: 1,
      createdAt: now - 86400000 * 3,
      updatedAt: now - 1000 * 60 * 90,
      embeddingStatus: 'ready'
    },
    {
      id: crypto.randomUUID(),
      title: '语义搜索校准样例',
      body: '向量检索会把意思相近的内容排上来。\n例如搜索“配对码怎么拿”，可能命中 Cloudflare 部署与设备连接相关笔记。\n演示模式用本地 n-gram 近似，真实后端会走 Workers AI + Vectorize。',
      images: [],
      version: 1,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 1000 * 60 * 18,
      embeddingStatus: 'ready'
    },
    {
      id: crypto.randomUUID(),
      title: '界面截图备忘',
      body: '主界面保持紧凑：顶部搜索，下方是完整正文流。\n不要折叠，不要只显示摘要。\n下面这张图用于验收图片展示。',
      images: [sampleImage],
      version: 1,
      createdAt: now - 86400000,
      updatedAt: now - 1000 * 60 * 8,
      embeddingStatus: 'ready'
    },
    {
      id: crypto.randomUUID(),
      title: '会议速记：周五同步',
      body: '1. 确认 PWA 安装路径\n2. 校验 Tab 复制命中行\n3. 检查快速创建标题来自搜索框\n4. 图片粘贴后立刻预览',
      images: [],
      version: 1,
      createdAt: now - 1000 * 60 * 60 * 30,
      updatedAt: now - 1000 * 60 * 3,
      embeddingStatus: 'ready'
    }
  ];
}

function sortNotes(notes: Note[], sort: SortMode): Note[] {
  return notes.sort((left, right) => {
    if (sort === 'title_asc') return left.title.localeCompare(right.title, 'zh-CN');
    if (sort === 'created_desc') return right.createdAt - left.createdAt;
    return right.updatedAt - left.updatedAt;
  });
}

function cloneNote(note: Note): Note {
  return { ...note, images: note.images.map((image) => ({ ...image })) };
}

function mapPairingCode(payload: unknown): PairingCode {
  const record = asRecord(payload);
  const code = stringValue(record.code).trim().toUpperCase();
  const expiresAt = optionalTimestampValue(record.expiresAt ?? record.expires_at);
  if (!code || expiresAt === undefined) {
    throw new ApiError('配对码响应缺少必要字段。', 500, 'INVALID_PAIRING_CODE_RESPONSE', payload);
  }
  return { code, expiresAt };
}

function createDemoPairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `NF-${characters.slice(0, 5).join('')}-${characters.slice(5).join('')}`;
}

export function normalizeEndpoint(value: string): string {
  const candidate = value.trim();
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new ApiError('Worker 地址无效，请填写完整的 https:// 地址。', 400, 'INVALID_ENDPOINT');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ApiError('Worker 地址必须以 https:// 开头。', 400, 'INVALID_ENDPOINT');
  }
  if (url.username || url.password) {
    throw new ApiError('Worker 地址不能包含用户名或密码。', 400, 'INVALID_ENDPOINT');
  }

  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.pathname === '/' ? url.origin : `${url.origin}${url.pathname}`;
}

async function fetchWorker(endpoint: string, path: string, init: RequestInit): Promise<Response> {
  try {
    return await runtimeFetch(`${endpoint}${path}`, init);
  } catch (error) {
    throw mapWorkerNetworkError(error, endpoint);
  }
}

async function readWorkerPayload(response: Response, endpoint: string): Promise<unknown> {
  try {
    return await readPayload(response);
  } catch (error) {
    throw mapWorkerNetworkError(error, endpoint);
  }
}

function mapWorkerNetworkError(error: unknown, endpoint: string): unknown {
  if (error instanceof NativeHttpError) {
    const host = workerHost(endpoint);
    const reason = error.nativeCause instanceof Error
      ? error.nativeCause.message
      : String(error.nativeCause);
    return new ApiError(
      `桌面原生网络请求失败（${host}）。请重试；如果问题持续，请把此错误截图发给开发者。`,
      0,
      'NATIVE_HTTP_ERROR',
      { endpoint, reason, transport: 'tauri-native' }
    );
  }
  if (!isNetworkFailure(error)) return error;

  const host = workerHost(endpoint);
  const reason = error instanceof Error ? error.message : String(error);
  return new ApiError(
    `无法连接到 Cloudflare Worker（${host}）。请检查网络连接、Worker 地址，以及该 Worker 是否仍在运行。`,
    0,
    'NETWORK_ERROR',
    { endpoint, reason }
  );
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /load failed|failed to fetch|network(?: request)? (?:failed|error)/i.test(message);
}

function workerHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function clientPlatform(): string {
  if ('__TAURI_INTERNALS__' in window) return 'macos';
  if (window.matchMedia('(display-mode: standalone)').matches) return 'pwa';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios-web';
  return 'web';
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const record = asRecord(payload);
  const errorRecord = asRecord(record.error);
  const message = stringValue(errorRecord.message ?? record.message, `请求失败（${response.status}）`);
  const code = stringValue(errorRecord.code ?? record.code, undefined);
  return new ApiError(message, response.status, code, payload);
}

function getArray(payload: unknown, key: string): unknown[] {
  const value = asRecord(payload)[key];
  return Array.isArray(value) ? value : [];
}

function getRecord(payload: unknown, key: string): unknown {
  const record = asRecord(payload);
  return record[key] ?? payload;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function timestampValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function optionalTimestampValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function embeddingStatusValue(value: unknown): Note['embeddingStatus'] {
  return value === 'disabled' || value === 'pending' || value === 'processing' || value === 'ready' || value === 'failed'
    ? value
    : 'pending';
}

function isImageAsset(value: ImageAsset | undefined): value is ImageAsset {
  return Boolean(value);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function readImageDimensions(file: File): Promise<Pick<ImageAsset, 'width' | 'height'>> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片。'));
    reader.readAsDataURL(file);
  });
}
