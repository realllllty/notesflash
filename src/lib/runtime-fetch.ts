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

const NATIVE_CONNECT_TIMEOUT_MS = 15_000;

let nativeFetchPromise: Promise<NativeFetchImplementation> | null = null;

export class NativeHttpError extends Error {
  constructor(public readonly nativeCause: unknown) {
    const reason = nativeCause instanceof Error ? nativeCause.message : String(nativeCause);
    super(`Tauri native HTTP failed: ${reason}`);
    this.name = 'NativeHttpError';
  }
}

export function isTauriRuntime(scope: typeof globalThis = globalThis): boolean {
  return '__TAURI_INTERNALS__' in scope;
}

/**
 * Browser/PWA traffic uses the platform Fetch API. Tauri traffic uses the
 * official Rust HTTP plugin so WKWebView CORS/network state cannot strand the
 * desktop client with an opaque `Load failed` error.
 */
export async function runtimeFetch(
  input: URL | Request | string,
  init?: RequestInit,
  adapters: RuntimeFetchAdapters = defaultAdapters()
): Promise<Response> {
  if (!adapters.isTauri) return adapters.browserFetch(input, init);
  try {
    const nativeFetch = await adapters.loadNativeFetch();
    return await nativeFetch(input, {
      ...init,
      // NotesFlash API routes never redirect. Refusing redirects prevents an
      // allowed Worker URL from forwarding the native client to another host.
      maxRedirections: 0,
      connectTimeout: NATIVE_CONNECT_TIMEOUT_MS
    });
  } catch (error) {
    throw new NativeHttpError(error);
  }
}

function defaultAdapters(): RuntimeFetchAdapters {
  return {
    isTauri: isTauriRuntime(),
    browserFetch: globalThis.fetch.bind(globalThis),
    loadNativeFetch: loadNativeFetch
  };
}

function loadNativeFetch(): Promise<NativeFetchImplementation> {
  nativeFetchPromise ??= import('@tauri-apps/plugin-http').then(
    ({ fetch }) => fetch as NativeFetchImplementation
  ).catch((error) => {
    // Let the user's explicit Retry action attempt to load the plugin again
    // instead of retaining one rejected module promise for the whole session.
    nativeFetchPromise = null;
    throw error;
  });
  return nativeFetchPromise;
}
