import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

type FetchImplementation = (
  input: URL | Request | string,
  init?: RequestInit
) => Promise<Response>;

interface NativeClientOptions {
  maxRedirections?: number;
  connectTimeout?: number;
}

type NativeFetchImplementation = (
  input: URL | Request | string,
  init?: RequestInit & NativeClientOptions
) => Promise<Response>;

export interface RuntimeFetchAdapters {
  isTauri: boolean;
  browserFetch: FetchImplementation;
  loadNativeFetch: () => Promise<NativeFetchImplementation>;
}

export type RuntimeTransport = 'browser' | 'native';

const NATIVE_CONNECT_TIMEOUT_MS = 15_000;
const TRANSPORT_PROBE_TIMEOUT_MS = 4_000;
const TRANSPORT_PROBE_BEARER = 'notesflash-transport-probe';

const transportSelections = new Map<string, Promise<RuntimeTransport>>();
const resolvedTransports = new Map<string, RuntimeTransport>();
const failedTransports = new Map<string, RuntimeTransport>();
let responseTransports = new WeakMap<Response, RuntimeTransport>();

export class NativeHttpError extends Error {
  constructor(public readonly nativeCause: unknown) {
    super(`Tauri native HTTP failed: ${runtimeCauseSummary(nativeCause)}`);
    this.name = 'NativeHttpError';
  }
}

export class TransportProbeError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly browserCause: unknown,
    public readonly nativeCause: unknown
  ) {
    super(
      `Both desktop transports failed for ${endpoint}; browser: ${runtimeCauseSummary(browserCause)}; ` +
      `native: ${runtimeCauseSummary(nativeCause)}`
    );
    this.name = 'TransportProbeError';
  }
}

export function isTauriRuntime(scope: typeof globalThis = globalThis): boolean {
  return '__TAURI_INTERNALS__' in scope;
}

/**
 * Web/PWA traffic uses the platform Fetch API directly. On desktop, NotesFlash
 * first probes a harmless health endpoint and chooses one transport for the
 * endpoint before any pairing or mutation is sent. A failed business request
 * is never replayed through the other transport.
 */
export async function runtimeFetch(
  input: URL | Request | string,
  init?: RequestInit,
  adapters: RuntimeFetchAdapters = defaultAdapters()
): Promise<Response> {
  if (!adapters.isTauri) return adapters.browserFetch(input, init);

  const endpoint = runtimeEndpointForRequest(input);
  const transport = await selectDesktopTransport(endpoint, adapters);

  try {
    const response = transport === 'browser'
      ? await adapters.browserFetch(input, init)
      : await nativeRequest(input, init, adapters);
    responseTransports.set(response, transport);
    return response;
  } catch (error) {
    // The explicit Retry action should run a fresh harmless probe. Do not
    // replay this request automatically: it may be a pairing or write request.
    markRuntimeTransportFailed(endpoint, transport);
    if (transport === 'native') throw new NativeHttpError(error);
    throw error;
  }
}

export function runtimeTransportForEndpoint(endpoint: string): RuntimeTransport | undefined {
  return resolvedTransports.get(normalizeTransportEndpoint(endpoint));
}

export function runtimeTransportForResponse(response: Response): RuntimeTransport | undefined {
  return responseTransports.get(response);
}

export function invalidateRuntimeTransport(endpoint?: string): void {
  if (!endpoint) {
    transportSelections.clear();
    resolvedTransports.clear();
    failedTransports.clear();
    responseTransports = new WeakMap<Response, RuntimeTransport>();
    return;
  }
  const key = normalizeTransportEndpoint(endpoint);
  transportSelections.delete(key);
  resolvedTransports.delete(key);
  failedTransports.delete(key);
}

export function markRuntimeTransportFailed(
  endpoint: string,
  transport: RuntimeTransport
): void {
  const key = normalizeTransportEndpoint(endpoint);
  transportSelections.delete(key);
  resolvedTransports.delete(key);
  failedTransports.set(key, transport);
}

export function runtimeEndpointForRequest(input: URL | Request | string): string {
  const rawUrl = input instanceof Request ? input.url : String(input);
  const base = typeof globalThis.location?.href === 'string'
    ? globalThis.location.href
    : 'http://localhost/';
  const url = new URL(rawUrl, base);
  const apiMarker = url.pathname.indexOf('/api/');
  const endpointPath = apiMarker >= 0 ? url.pathname.slice(0, apiMarker) : '';
  url.pathname = endpointPath || '/';
  url.search = '';
  url.hash = '';
  return url.pathname === '/' ? url.origin : `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

async function selectDesktopTransport(
  endpoint: string,
  adapters: RuntimeFetchAdapters
): Promise<RuntimeTransport> {
  const key = normalizeTransportEndpoint(endpoint);
  const existing = transportSelections.get(key);
  if (existing) return existing;

  const selection = probeDesktopTransport(key, adapters)
    .then((transport) => {
      resolvedTransports.set(key, transport);
      return transport;
    })
    .catch((error) => {
      transportSelections.delete(key);
      resolvedTransports.delete(key);
      throw error;
    });
  transportSelections.set(key, selection);
  return selection;
}

async function probeDesktopTransport(
  endpoint: string,
  adapters: RuntimeFetchAdapters
): Promise<RuntimeTransport> {
  const healthUrl = `${endpoint}/api/health?transportProbe=${probeNonce()}`;
  const previousFailure = failedTransports.get(endpoint);
  const order: RuntimeTransport[] = previousFailure === 'browser'
    ? ['native', 'browser']
    : ['browser', 'native'];
  let browserCause: unknown;
  let nativeCause: unknown;

  for (const transport of order) {
    try {
      if (transport === 'browser') {
        await probeRequest((signal) => adapters.browserFetch(healthUrl, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${TRANSPORT_PROBE_BEARER}`,
            'content-type': 'application/json'
          },
          signal
        }));
      } else {
        await probeRequest((signal) => nativeRequest(healthUrl, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal
        }, adapters));
      }
      return transport;
    } catch (error) {
      if (transport === 'browser') browserCause = error;
      else nativeCause = error;
    }
  }

  throw new TransportProbeError(endpoint, browserCause, nativeCause);
}

async function probeRequest(request: (signal: AbortSignal) => Promise<Response>): Promise<void> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), TRANSPORT_PROBE_TIMEOUT_MS);
  try {
    const response = await request(controller.signal);
    // Any HTTP response proves that the network transport is usable. Reading
    // the tiny body also validates the plugin response-stream IPC path.
    await response.arrayBuffer();
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function nativeRequest(
  input: URL | Request | string,
  init: RequestInit | undefined,
  adapters: RuntimeFetchAdapters
): Promise<Response> {
  const nativeFetch = await adapters.loadNativeFetch();
  return nativeFetch(input, {
    ...init,
    // NotesFlash API routes never redirect. Refusing redirects prevents an
    // allowed Worker URL from forwarding the native client to another host.
    maxRedirections: 0,
    connectTimeout: NATIVE_CONNECT_TIMEOUT_MS
  });
}

function defaultAdapters(): RuntimeFetchAdapters {
  return {
    isTauri: isTauriRuntime(),
    browserFetch: (input, init) => globalThis.fetch(input, init),
    loadNativeFetch: async () => tauriFetch as NativeFetchImplementation
  };
}

function normalizeTransportEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '');
}

function probeNonce(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function runtimeCauseSummary(cause: unknown): string {
  if (cause instanceof Error) return cause.message || cause.name;
  if (typeof cause === 'string') return cause;
  if (cause && typeof cause === 'object') {
    const record = cause as Record<string, unknown>;
    const nested = record.message ?? record.error ?? record.cause;
    if (typeof nested === 'string') return nested;
    try {
      return JSON.stringify(cause);
    } catch {
      return Object.prototype.toString.call(cause);
    }
  }
  return String(cause);
}
