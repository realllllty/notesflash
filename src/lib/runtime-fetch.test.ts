import { describe, expect, it, vi } from 'vitest';
import { NativeHttpError, runtimeFetch, type RuntimeFetchAdapters } from './runtime-fetch';

function response(label: string): Response {
  return new Response(label, { status: 200 });
}

describe('runtime HTTP transport', () => {
  it('uses browser fetch for Web and PWA environments', async () => {
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeFetch = vi.fn(async () => response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: false,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    expect(await (await runtimeFetch('https://example.com', undefined, adapters)).text()).toBe('browser');
    expect(browserFetch).toHaveBeenCalledOnce();
    expect(adapters.loadNativeFetch).not.toHaveBeenCalled();
  });

  it('uses native HTTP for Tauri without attempting WebKit fetch', async () => {
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeFetch = vi.fn(async () => response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    expect(await (await runtimeFetch('https://example.com', undefined, adapters)).text()).toBe('native');
    expect(nativeFetch).toHaveBeenCalledOnce();
    expect(nativeFetch).toHaveBeenCalledWith('https://example.com', {
      maxRedirections: 0,
      connectTimeout: 15_000
    });
    expect(browserFetch).not.toHaveBeenCalled();
  });

  it('forces redirect and connection safety settings for native requests', async () => {
    const nativeFetch = vi.fn(async () => response('native'));
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch: vi.fn(async () => response('browser')),
      loadNativeFetch: vi.fn(async () => nativeFetch)
    };

    await runtimeFetch(
      'https://example.com',
      {
        method: 'POST',
        maxRedirections: 8,
        connectTimeout: 90_000
      } as RequestInit,
      adapters
    );

    expect(nativeFetch).toHaveBeenCalledWith('https://example.com', {
      method: 'POST',
      maxRedirections: 0,
      connectTimeout: 15_000
    });
  });

  it('does not replay a failed native mutation through browser fetch', async () => {
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeError = new Error('native request failed');
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn(async () => async () => Promise.reject(nativeError))
    };

    await expect(runtimeFetch('https://example.com', { method: 'POST' }, adapters)).rejects.toMatchObject({
      name: 'NativeHttpError',
      nativeCause: nativeError
    } satisfies Partial<NativeHttpError>);
    expect(browserFetch).not.toHaveBeenCalled();
  });

  it('maps a native plugin loading failure without falling back to WebKit', async () => {
    const browserFetch = vi.fn(async () => response('browser'));
    const nativeError = new Error('plugin command not found');
    const adapters: RuntimeFetchAdapters = {
      isTauri: true,
      browserFetch,
      loadNativeFetch: vi.fn().mockRejectedValue(nativeError)
    };

    await expect(runtimeFetch('https://example.com', undefined, adapters)).rejects.toMatchObject({
      name: 'NativeHttpError',
      nativeCause: nativeError
    } satisfies Partial<NativeHttpError>);
    expect(browserFetch).not.toHaveBeenCalled();
  });
});
