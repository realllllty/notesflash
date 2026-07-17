import type { Proxy as TauriHttpProxy } from '@tauri-apps/plugin-http';

const STORAGE_KEY = 'notesflash.network.v1';
const CHANGE_EVENT = 'notesflash:network-settings-changed';
const STORAGE_VERSION = 1;
const DEFAULT_NO_PROXY = 'localhost,127.0.0.1,::1';

export type DesktopProxyProtocol = 'http:' | 'https:' | 'socks5:' | 'socks5h:';

interface PersistedDesktopNetworkSettings {
  version: 1;
  proxyUrl: string;
  revision: number;
}

export type DesktopNetworkSnapshot =
  | {
      mode: 'system';
      proxyUrl: '';
      revision: number;
      nativeProxy?: undefined;
    }
  | {
      mode: 'manual';
      proxyUrl: string;
      revision: number;
      nativeProxy: TauriHttpProxy;
    };

export class DesktopProxyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesktopProxyValidationError';
  }
}

export function isDesktopRuntime(scope: typeof globalThis = globalThis): boolean {
  return '__TAURI_INTERNALS__' in scope;
}

/**
 * Normalize a user-entered proxy address without ever accepting credentials.
 * An empty value means that reqwest should keep using its normal system proxy
 * discovery. Local proxy tools usually expose an HTTP port, so a missing
 * protocol intentionally defaults to http://.
 */
export function normalizeDesktopProxyUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const candidate = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new DesktopProxyValidationError('请输入代理地址，例如 127.0.0.1:7890');
  }

  if (!isSupportedProxyProtocol(parsed.protocol)) {
    throw new DesktopProxyValidationError(
      '代理仅支持 http、https、socks5 或 socks5h 协议，不支持 PAC 地址。'
    );
  }
  if (!parsed.hostname) {
    throw new DesktopProxyValidationError('代理地址缺少主机名。');
  }
  if (!isLoopbackProxyHost(parsed.hostname)) {
    throw new DesktopProxyValidationError(
      '为避免把代理配置发送到外部主机，仅支持 localhost、127.0.0.1 或 ::1。'
    );
  }
  if (parsed.username || parsed.password) {
    throw new DesktopProxyValidationError(
      '请勿在代理地址中填写账号或密码；当前版本仅保存无需认证的本地代理。'
    );
  }
  if (parsed.search || parsed.hash) {
    throw new DesktopProxyValidationError('代理地址不能包含查询参数或 # 片段。');
  }
  if (parsed.pathname && parsed.pathname !== '/') {
    throw new DesktopProxyValidationError('代理地址不能包含路径或 PAC 文件地址。');
  }

  return `${parsed.protocol}//${parsed.host}`;
}

export function getDesktopNetworkSnapshot(): DesktopNetworkSnapshot {
  return toSnapshot(readPersistedSettings());
}

export function saveDesktopProxyUrl(value: string): DesktopNetworkSnapshot {
  const proxyUrl = normalizeDesktopProxyUrl(value);
  const previous = readPersistedSettings();
  if (previous.proxyUrl === proxyUrl) return toSnapshot(previous);

  const next: PersistedDesktopNetworkSettings = {
    version: STORAGE_VERSION,
    proxyUrl,
    revision: nextRevision(previous.revision)
  };

  const storage = browserStorage();
  if (!storage) {
    throw new Error('当前环境无法在本机保存代理设置。');
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error('无法在本机保存代理设置，请检查应用存储权限。');
  }

  notifySettingsChanged();
  return toSnapshot(next);
}

export function subscribeDesktopNetworkSettings(
  listener: (snapshot: DesktopNetworkSnapshot) => void
): () => void {
  listener(getDesktopNetworkSnapshot());
  if (typeof window === 'undefined') return () => undefined;

  const handleChange = () => listener(getDesktopNetworkSnapshot());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) handleChange();
  };

  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleStorage);
  };
}

function isSupportedProxyProtocol(value: string): value is DesktopProxyProtocol {
  return ['http:', 'https:', 'socks5:', 'socks5h:'].includes(value);
}

function isLoopbackProxyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function readPersistedSettings(): PersistedDesktopNetworkSettings {
  const fallback: PersistedDesktopNetworkSettings = {
    version: STORAGE_VERSION,
    proxyUrl: '',
    revision: 0
  };
  const storage = browserStorage();
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as Partial<PersistedDesktopNetworkSettings>;
    if (value.version !== STORAGE_VERSION) return fallback;
    if (typeof value.proxyUrl !== 'string') return fallback;
    if (!Number.isSafeInteger(value.revision) || (value.revision ?? -1) < 0) return fallback;

    return {
      version: STORAGE_VERSION,
      proxyUrl: normalizeDesktopProxyUrl(value.proxyUrl),
      revision: value.revision!
    };
  } catch {
    return fallback;
  }
}

function toSnapshot(settings: PersistedDesktopNetworkSettings): DesktopNetworkSnapshot {
  if (!settings.proxyUrl) {
    return {
      mode: 'system',
      proxyUrl: '',
      revision: settings.revision
    };
  }

  return {
    mode: 'manual',
    proxyUrl: settings.proxyUrl,
    revision: settings.revision,
    nativeProxy: {
      all: {
        url: settings.proxyUrl,
        noProxy: DEFAULT_NO_PROXY
      }
    }
  };
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function nextRevision(previous: number): number {
  return previous >= Number.MAX_SAFE_INTEGER ? 1 : previous + 1;
}

function notifySettingsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}
