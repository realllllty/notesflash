import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invalidateRuntimeTransport,
  markRuntimeTransportFailed,
  NativeHttpError,
  runtimeEndpointForRequest,
  runtimeFetch,
  runtimeTransportForEndpoint,
  runtimeTransportForResponse,
  TransportProbeError,
  type RuntimeFetchAdapters
} from './runtime-fetch';

function response(label: string, status = 200): Response {
  return new Response(label, { status });
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
