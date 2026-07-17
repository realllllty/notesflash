import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invalidateRuntimeTransport,
  ManualProxyProbeError,
  markRuntimeResponseFailed,
  markRuntimeTransportFailed,
  NativeHttpError,
  NativeNetworkDiagnosticError,
  runtimeEndpointForRequest,
  runtimeFetch,
  runtimeTransportForEndpoint,
  runtimeTransportForResponse,
  TransportProbeError,
  TransportProbeTimeoutError,
  type RuntimeFetchAdapters
} from './runtime-fetch';
import type { DesktopNetworkSnapshot } from './network-settings';

function response(label: string, status = 200): Response {
  return new Response(label, { status });
}

function pendingUntilAbort(signal?: AbortSignal | null): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('runtime HTTP transport', () => {
  beforeEach(() => invalidateRuntimeTransport());

  it('uses browser fetch directly for Web and PWA environments', async () => {
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeFetch = vi.fn(async () => response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: false,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    expect(await (await runtimeFetch('https://example.com/api/notes', undefined, adapters)).text())
      .toBe('browser');
    expect(browserFetch).toHaveBeenCalledOnce();
    expect(adapters.loadNativeFetch).not.toHaveBeenCalled();
  });

  it('selects the browser transport before sending a desktop business request', async () => {
    const browserFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) =>
      String(input).includes('/api/health') ? response('healthy') : response('browser'));
    const nativeFetch = vi.fn(async () => response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: '{}' },
      adapters
    )).text()).toBe('browser');

    expect(browserFetch).toHaveBeenCalledTimes(2);
    const [probeUrl, probeInit] = browserFetch.mock.calls[0];
    expect(String(probeUrl)).toContain('/api/health?transportProbe=');
    expect(new Headers(probeInit?.headers).get('authorization'))
      .toBe('Bearer notesflash-transport-probe');
    expect(browserFetch.mock.calls[1]).toEqual([
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: '{}' }
    ]);
    expect(adapters.loadNativeFetch).not.toHaveBeenCalled();
    expect(runtimeTransportForEndpoint('https://notes.example.workers.dev')).toBe('browser');
  });

  it('uses native HTTP when the WebKit health probe fails', async () => {
    const browserFetch = vi.fn().mockRejectedValue(new TypeError('Load failed'));
    const nativeFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) =>
      String(input).includes('/api/health') ? response('healthy') : response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    )).text()).toBe('native');

    expect(browserFetch).toHaveBeenCalledOnce();
    expect(nativeFetch).toHaveBeenCalledTimes(2);
    expect(nativeFetch.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      maxRedirections: 0,
      connectTimeout: 15_000
    });
    expect(nativeFetch.mock.calls[1]).toEqual([
      'https://notes.example.workers.dev/api/notes',
      { maxRedirections: 0, connectTimeout: 15_000 }
    ]);
    expect(runtimeTransportForEndpoint('https://notes.example.workers.dev')).toBe('native');
  });

  it('starts the fallback probe after 300 ms instead of waiting for the primary timeout', async () => {
    vi.useFakeTimers();
    try {
      let browserProbeAborted = false;
      const browserFetch = vi.fn((input: URL | Request | string, init?: RequestInit) => {
        if (!String(input).includes('/api/health')) return Promise.resolve(response('browser'));
        init?.signal?.addEventListener('abort', () => {
          browserProbeAborted = true;
        }, { once: true });
        return pendingUntilAbort(init?.signal);
      });
      const nativeFetch = vi.fn(async (input: URL | Request | string) =>
        String(input).includes('/api/health') ? response('healthy') : response('native'));
      const adapters: RuntimeFetchAdapters = {
        isTauri: true,
        browserFetch,
        loadNativeFetch: vi.fn(async () => nativeFetch)
      };

      const request = runtimeFetch(
        'https://notes.example.workers.dev/api/notes',
        undefined,
        adapters
      );
      await vi.advanceTimersByTimeAsync(299);
      expect(adapters.loadNativeFetch).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(await (await request).text()).toBe('native');
      expect(adapters.loadNativeFetch).toHaveBeenCalledTimes(2);
      expect(browserProbeAborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('consumes a losing probe that rejects after it was cancelled', async () => {
    vi.useFakeTimers();
    try {
      const browserFetch = vi.fn((input: URL | Request | string) => {
        if (!String(input).includes('/api/health')) return Promise.resolve(response('browser'));
        return new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(new TypeError('late WebKit rejection')), 1_000);
        });
      });
      const nativeFetch = vi.fn(async (input: URL | Request | string) =>
        String(input).includes('/api/health') ? response('healthy') : response('native'));
      const adapters: RuntimeFetchAdapters = {
        isTauri: true,
        browserFetch,
        loadNativeFetch: vi.fn(async () => nativeFetch)
      };

      const first = runtimeFetch(
        'https://notes.example.workers.dev/api/notes',
        undefined,
        adapters
      );
      await vi.advanceTimersByTimeAsync(300);
      expect(await (await first).text()).toBe('native');

      await vi.advanceTimersByTimeAsync(700);
      expect(await (await runtimeFetch(
        'https://notes.example.workers.dev/api/notes',
        undefined,
        adapters
      )).text()).toBe('native');
      expect(browserFetch).toHaveBeenCalledOnce();
      expect(nativeFetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows a browser probe to succeed after the old four-second deadline', async () => {
    vi.useFakeTimers();
    try {
      const browserFetch = vi.fn((input: URL | Request | string, init?: RequestInit) => {
        if (!String(input).includes('/api/health')) return Promise.resolve(response('browser'));
        return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(response('healthy')), 6_000);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(init.signal?.reason);
          }, { once: true });
        });
      });
      const nativeFetch = vi.fn((_input: URL | Request | string, init?: RequestInit) =>
        pendingUntilAbort(init?.signal));
      const adapters: RuntimeFetchAdapters = {
        isTauri: true,
        browserFetch,
        loadNativeFetch: vi.fn(async () => nativeFetch)
      };

      const request = runtimeFetch(
        'https://notes.example.workers.dev/api/notes',
        undefined,
        adapters
      );
      await vi.advanceTimersByTimeAsync(6_000);

      expect(await (await request).text()).toBe('browser');
      expect(nativeFetch).toHaveBeenCalledOnce();
      expect(runtimeTransportForEndpoint('https://notes.example.workers.dev')).toBe('browser');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports independent, explicit probe timeouts when both transports hang', async () => {
    vi.useFakeTimers();
    try {
      const browserFetch = vi.fn((_input: URL | Request | string, init?: RequestInit) =>
        pendingUntilAbort(init?.signal));
      const nativeFetch = vi.fn((_input: URL | Request | string, init?: RequestInit) =>
        pendingUntilAbort(init?.signal));
      const adapters: RuntimeFetchAdapters = {
        isTauri: true,
        browserFetch,
        loadNativeFetch: vi.fn(async () => nativeFetch)
      };

      const request = runtimeFetch(
        'https://notes.example.workers.dev/api/devices/pair',
        { method: 'POST', body: 'pairing-secret' },
        adapters
      );
      const rejection = expect(request).rejects.toMatchObject({
        name: 'TransportProbeError',
        browserCause: expect.objectContaining({
          name: 'TransportProbeTimeoutError',
          transport: 'browser',
          timeoutMs: 10_000
        }),
        nativeCause: expect.objectContaining({
          name: 'TransportProbeTimeoutError',
          transport: 'native',
          timeoutMs: 15_000
        })
      } satisfies Partial<TransportProbeError>);

      await vi.advanceTimersByTimeAsync(15_300);
      await rejection;
      expect(browserFetch).toHaveBeenCalledOnce();
      expect(nativeFetch).toHaveBeenCalledOnce();
      expect(TransportProbeTimeoutError).toBeTypeOf('function');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses only native HTTP and forwards the configured manual proxy', async () => {
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) =>
      String(input).includes('/api/health') ? response('healthy') : response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch),
      getNetworkSnapshot: () => ({
        mode: 'manual',
        proxyUrl: 'socks5h://127.0.0.1:1080',
        revision: 1,
        nativeProxy: {
          all: {
            url: 'socks5h://127.0.0.1:1080',
            noProxy: 'localhost,127.0.0.1,::1'
          }
        }
      })
    };

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: '{}' },
      adapters
    )).text()).toBe('native');

    expect(browserFetch).not.toHaveBeenCalled();
    expect(nativeFetch).toHaveBeenCalledTimes(2);
    expect(nativeFetch.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      proxy: {
        all: {
          url: 'socks5h://127.0.0.1:1080',
          noProxy: 'localhost,127.0.0.1,::1'
        }
      }
    });
    expect(nativeFetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      proxy: {
        all: { url: 'socks5h://127.0.0.1:1080' }
      }
    });
  });

  it('does not bypass a failed manual proxy through the browser transport', async () => {
    const nativeError = new Error('proxy tunnel failed');
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeFetch = vi.fn().mockRejectedValue(nativeError);
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch),
      getNetworkSnapshot: () => ({
        mode: 'manual',
        proxyUrl: 'http://127.0.0.1:7890',
        revision: 1,
        nativeProxy: { all: { url: 'http://127.0.0.1:7890' } }
      })
    };

    await expect(runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: 'pairing-secret' },
      adapters
    )).rejects.toMatchObject({
      name: 'ManualProxyProbeError',
      endpoint: 'https://notes.example.workers.dev',
      nativeCause: nativeError
    } satisfies Partial<ManualProxyProbeError>);

    expect(browserFetch).not.toHaveBeenCalled();
    expect(nativeFetch).toHaveBeenCalledOnce();
    expect(JSON.stringify(nativeFetch.mock.calls)).not.toContain('pairing-secret');
  });

  it('re-probes when the local network settings revision changes', async () => {
    let snapshot: DesktopNetworkSnapshot = {
      mode: 'system',
      proxyUrl: '',
      revision: 0
    };
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeFetch = vi.fn(async (input: URL | Request | string) =>
      String(input).includes('/api/health') ? response('healthy') : response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch),
      getNetworkSnapshot: () => snapshot
    };

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    )).text()).toBe('browser');

    snapshot = {
      mode: 'manual',
      proxyUrl: 'http://127.0.0.1:7890',
      revision: 1,
      nativeProxy: { all: { url: 'http://127.0.0.1:7890' } }
    };
    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    )).text()).toBe('native');

    expect(browserFetch).toHaveBeenCalledTimes(2);
    expect(nativeFetch).toHaveBeenCalledTimes(2);
  });

  it('never sends a business request through a network revision that changed during probing', async () => {
    const oldBrowserProbe = deferred<Response>();
    let snapshot: DesktopNetworkSnapshot = {
      mode: 'system',
      proxyUrl: '',
      revision: 0
    };
    const browserFetch = vi.fn((input: URL | Request | string) => {
      if (String(input).includes('/api/health')) return oldBrowserProbe.promise;
      return Promise.resolve(response('stale-browser-business'));
    });
    const nativeFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) =>
      String(input).includes('/api/health') ? response('healthy') : response('native-business'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch),
      getNetworkSnapshot: () => snapshot
    };

    const request = runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: '{}' },
      adapters
    );
    snapshot = {
      mode: 'manual',
      proxyUrl: 'http://127.0.0.1:7890',
      revision: 1,
      nativeProxy: { all: { url: 'http://127.0.0.1:7890' } }
    };
    oldBrowserProbe.resolve(response('old-healthy'));

    expect(await (await request).text()).toBe('native-business');
    expect(browserFetch).toHaveBeenCalledOnce();
    expect(nativeFetch).toHaveBeenCalledTimes(2);
    expect(nativeFetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      proxy: { all: { url: 'http://127.0.0.1:7890' } }
    });
  });

  it('does not let a stale response failure evict a newer transport generation', async () => {
    let snapshot: DesktopNetworkSnapshot = {
      mode: 'system',
      proxyUrl: '',
      revision: 0
    };
    const browserFetch = vi.fn(async (input: URL | Request | string) =>
      String(input).includes('/api/health') ? response('healthy') : response('old-browser'));
    const nativeFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) =>
      String(input).includes('/api/health') ? response('healthy') : response('new-native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch),
      getNetworkSnapshot: () => snapshot
    };

    const staleResponse = await runtimeFetch(
      'https://notes.example.workers.dev/api/notes/old',
      undefined,
      adapters
    );
    snapshot = {
      mode: 'manual',
      proxyUrl: 'http://127.0.0.1:7890',
      revision: 1,
      nativeProxy: { all: { url: 'http://127.0.0.1:7890' } }
    };
    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes/new',
      undefined,
      adapters
    )).text()).toBe('new-native');

    markRuntimeResponseFailed('https://notes.example.workers.dev', staleResponse);
    expect(runtimeTransportForEndpoint('https://notes.example.workers.dev')).toBe('native');
    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes/later',
      undefined,
      adapters
    )).text()).toBe('new-native');

    expect(nativeFetch).toHaveBeenCalledTimes(3);
  });

  it('shares one cold-start transport selection across concurrent business requests', async () => {
    const health = deferred<Response>();
    const browserFetch = vi.fn((input: URL | Request | string) =>
      String(input).includes('/api/health')
        ? health.promise
        : Promise.resolve(response(String(input))));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn()
    };

    const first = runtimeFetch('https://notes.example.workers.dev/api/notes/a', undefined, adapters);
    const second = runtimeFetch('https://notes.example.workers.dev/api/notes/b', undefined, adapters);
    expect(browserFetch).toHaveBeenCalledOnce();
    health.resolve(response('healthy'));

    await Promise.all([first, second]);
    expect(browserFetch).toHaveBeenCalledTimes(3);
    expect(adapters.loadNativeFetch).not.toHaveBeenCalled();
  });

  it('does not send a business request when the caller aborts during transport selection', async () => {
    const health = deferred<Response>();
    const browserFetch = vi.fn((input: URL | Request | string) =>
      String(input).includes('/api/health')
        ? health.promise
        : Promise.resolve(response('business')));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn()
    };
    const controller = new AbortController();
    const abortError = new DOMException('cancelled by caller', 'AbortError');

    const request = runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      { signal: controller.signal },
      adapters
    );
    controller.abort(abortError);
    await expect(request).rejects.toBe(abortError);
    expect(browserFetch).toHaveBeenCalledOnce();

    health.resolve(response('healthy'));
    await Promise.resolve();
    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    )).text()).toBe('business');
    expect(browserFetch).toHaveBeenCalledTimes(2);
  });

  it('does not mark a healthy transport failed when the caller aborts a business request', async () => {
    const businessStarted = deferred<void>();
    const browserFetch = vi.fn((input: URL | Request | string, init?: RequestInit) => {
      if (String(input).includes('/api/health')) return Promise.resolve(response('healthy'));
      if (!init?.signal) return Promise.resolve(response('next-business'));
      businessStarted.resolve();
      return pendingUntilAbort(init.signal);
    });
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn()
    };
    const controller = new AbortController();
    const abortError = new DOMException('cancelled by caller', 'AbortError');

    const request = runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      { signal: controller.signal },
      adapters
    );
    await businessStarted.promise;
    controller.abort(abortError);
    await expect(request).rejects.toBe(abortError);
    expect(runtimeTransportForEndpoint('https://notes.example.workers.dev')).toBe('browser');

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    )).text()).toBe('next-business');
    expect(browserFetch).toHaveBeenCalledTimes(3);
    expect(adapters.loadNativeFetch).not.toHaveBeenCalled();
  });

  it('adds the native source-chain diagnostic to an otherwise generic plugin error', async () => {
    const browserError = new TypeError('Load failed');
    const nativeError = new Error('error sending request for url');
    const browserFetch = vi.fn().mockRejectedValue(browserError);
    const nativeFetch = vi.fn().mockRejectedValue(nativeError);
    const diagnoseNativeNetwork = vi.fn(async () => ({
      networkOk: false,
      healthOk: false,
      targetHost: 'notes.example.workers.dev',
      proxyMode: 'system',
      phase: 'request',
      category: 'dns',
      status: null,
      elapsedMs: 12,
      topError: 'error sending request',
      sourceChain: ['dns error: no such host'],
      isTimeout: false,
      isConnect: true,
      isRequest: true,
      isBuilder: false,
      isStatus: false,
      isRedirect: false,
      isBody: false,
      isDecode: false
    }));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch),
      diagnoseNativeNetwork
    };

    const caught = await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    ).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(TransportProbeError);
    expect((caught as TransportProbeError).nativeCause).toBeInstanceOf(NativeNetworkDiagnosticError);
    expect(String((caught as TransportProbeError).nativeCause)).toContain('dns error: no such host');
    expect(diagnoseNativeNetwork).toHaveBeenCalledWith(
      'https://notes.example.workers.dev',
      undefined
    );
  });

  it('caches the selected transport for later requests to the same endpoint', async () => {
    const browserFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) =>
      response(String(input)));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn()
    };

    await runtimeFetch('https://notes.example.workers.dev/api/notes', undefined, adapters);
    await runtimeFetch('https://notes.example.workers.dev/api/search/lexical?q=test', undefined, adapters);

    expect(browserFetch).toHaveBeenCalledTimes(3);
    expect(String(browserFetch.mock.calls[0][0])).toContain('/api/health?transportProbe=');
  });

  it('never replays a failed mutation through the other transport', async () => {
    const browserFetch = vi.fn().mockRejectedValue(new TypeError('Load failed'));
    const nativeError = new Error('native request failed after send');
    const nativeFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) => {
      if (String(input).includes('/api/health')) return response('healthy');
      throw nativeError;
    });
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    await expect(runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: '{}' },
      adapters
    )).rejects.toMatchObject({
      name: 'NativeHttpError',
      nativeCause: nativeError
    } satisfies Partial<NativeHttpError>);

    expect(browserFetch).toHaveBeenCalledOnce();
    expect(nativeFetch).toHaveBeenCalledTimes(2);
    expect(runtimeTransportForEndpoint('https://notes.example.workers.dev')).toBeUndefined();
  });

  it('does not switch to native after a browser-selected mutation fails', async () => {
    const browserError = new TypeError('Load failed after send');
    const browserFetch = vi.fn(async (input: URL | Request | string, _init?: RequestInit) => {
      if (String(input).includes('/api/health')) return response('healthy');
      throw browserError;
    });
    const nativeFetch = vi.fn(async (input: URL | Request | string) =>
      String(input).includes('/api/health') ? response('healthy') : response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    await expect(runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: '{}' },
      adapters
    )).rejects.toBe(browserError);

    expect(browserFetch).toHaveBeenCalledTimes(2);
    expect(adapters.loadNativeFetch).not.toHaveBeenCalled();
    expect(runtimeTransportForEndpoint('https://notes.example.workers.dev')).toBeUndefined();

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: '{}' },
      adapters
    )).text()).toBe('native');
    expect(browserFetch).toHaveBeenCalledTimes(2);
    expect(nativeFetch).toHaveBeenCalledTimes(2);
  });

  it('avoids a transport whose response body failed on the next request', async () => {
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeFetch = vi.fn(async (input: URL | Request | string) =>
      String(input).includes('/api/health') ? response('healthy') : response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    await runtimeFetch('https://notes.example.workers.dev/api/notes', undefined, adapters);
    markRuntimeTransportFailed('https://notes.example.workers.dev', 'browser');

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    )).text()).toBe('native');
    expect(nativeFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the failed transport when concurrent response ownership changes', async () => {
    const requestError = new TypeError('request A failed');
    const bodyError = new TypeError('response B body failed');
    let rejectRequestA: ((reason: unknown) => void) | undefined;
    const responseB = response('body');
    Object.defineProperty(responseB, 'text', {
      value: vi.fn().mockRejectedValue(bodyError)
    });
    const browserFetch = vi.fn((input: URL | Request | string): Promise<Response> => {
      const url = String(input);
      if (url.includes('/api/health')) return Promise.resolve(response('healthy'));
      if (url.endsWith('/api/notes/a')) {
        return new Promise((_resolve, reject) => {
          rejectRequestA = reject;
        });
      }
      if (url.endsWith('/api/notes/b')) return Promise.resolve(responseB);
      return Promise.resolve(response('seed'));
    });
    const nativeFetch = vi.fn(async (input: URL | Request | string) =>
      String(input).includes('/api/health') ? response('healthy') : response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    await runtimeFetch('https://notes.example.workers.dev/api/meta', undefined, adapters);
    const requestA = runtimeFetch(
      'https://notes.example.workers.dev/api/notes/a',
      undefined,
      adapters
    );
    const ownedResponseB = await runtimeFetch(
      'https://notes.example.workers.dev/api/notes/b',
      undefined,
      adapters
    );

    rejectRequestA?.(requestError);
    await expect(requestA).rejects.toBe(requestError);
    await expect(ownedResponseB.text()).rejects.toBe(bodyError);
    const failedTransport = runtimeTransportForResponse(ownedResponseB);
    expect(failedTransport).toBe('browser');
    markRuntimeTransportFailed('https://notes.example.workers.dev', failedTransport!);

    expect(await (await runtimeFetch(
      'https://notes.example.workers.dev/api/notes',
      undefined,
      adapters
    )).text()).toBe('native');
    expect(nativeFetch).toHaveBeenCalledTimes(2);
  });

  it('reports both harmless probe failures without sending the business request', async () => {
    const browserError = new TypeError('Load failed');
    const nativeError = { message: 'invalid peer certificate: UnknownIssuer' };
    const browserFetch = vi.fn().mockRejectedValue(browserError);
    const nativeFetch = vi.fn().mockRejectedValue(nativeError);
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    await expect(runtimeFetch(
      'https://notes.example.workers.dev/api/devices/pair',
      { method: 'POST', body: 'pairing-secret' },
      adapters
    )).rejects.toMatchObject({
      name: 'TransportProbeError',
      endpoint: 'https://notes.example.workers.dev',
      browserCause: browserError,
      nativeCause: nativeError
    } satisfies Partial<TransportProbeError>);

    expect(browserFetch).toHaveBeenCalledOnce();
    expect(nativeFetch).toHaveBeenCalledOnce();
    expect(String(nativeFetch.mock.calls[0][0])).toContain('/api/health?transportProbe=');
    expect(JSON.stringify(nativeFetch.mock.calls)).not.toContain('pairing-secret');
  });

  it('derives the endpoint when a self-hosted Worker uses a base path', () => {
    expect(runtimeEndpointForRequest(
      'https://example.com/notesflash/api/search/lexical?q=hello'
    )).toBe('https://example.com/notesflash');
  });
});
