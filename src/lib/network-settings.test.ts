// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DesktopProxyValidationError,
  getDesktopNetworkSnapshot,
  isDesktopRuntime,
  normalizeDesktopProxyUrl,
  saveDesktopProxyUrl,
  subscribeDesktopNetworkSettings
} from './network-settings';

describe('desktop network settings', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('defaults a host and port without a protocol to an HTTP proxy', () => {
    expect(normalizeDesktopProxyUrl(' 127.0.0.1:7890 ')).toBe('http://127.0.0.1:7890');
  });

  it.each([
    ['http://localhost:7890', 'http://localhost:7890'],
    ['HTTPS://LOCALHOST:8443/', 'https://localhost:8443'],
    ['socks5://127.0.0.1:1080', 'socks5://127.0.0.1:1080'],
    ['socks5h://[::1]:1080', 'socks5h://[::1]:1080']
  ])('normalizes the supported proxy address %s', (input, output) => {
    expect(normalizeDesktopProxyUrl(input)).toBe(output);
  });

  it('uses an empty value to restore normal system proxy discovery', () => {
    expect(normalizeDesktopProxyUrl('   ')).toBe('');
    expect(getDesktopNetworkSnapshot()).toMatchObject({
      mode: 'system',
      proxyUrl: '',
      revision: 0
    });
  });

  it.each([
    'file:///tmp/proxy',
    'http://127.0.0.1:7890/proxy.pac',
    'http://127.0.0.1:7890?token=secret',
    'http://127.0.0.1:7890#proxy',
    'http://user:password@127.0.0.1:7890',
    'http://proxy.example:7890',
    'http://192.168.1.10:7890'
  ])('rejects an unsafe or unsupported proxy address %s', (input) => {
    expect(() => normalizeDesktopProxyUrl(input)).toThrow(DesktopProxyValidationError);
  });

  it('persists a native proxy snapshot and increments its revision only on changes', () => {
    const first = saveDesktopProxyUrl('127.0.0.1:7890');
    expect(first).toEqual({
      mode: 'manual',
      proxyUrl: 'http://127.0.0.1:7890',
      revision: 1,
      nativeProxy: {
        all: {
          url: 'http://127.0.0.1:7890',
          noProxy: 'localhost,127.0.0.1,::1'
        }
      }
    });

    expect(saveDesktopProxyUrl('http://127.0.0.1:7890').revision).toBe(1);
    expect(saveDesktopProxyUrl('socks5h://127.0.0.1:7891').revision).toBe(2);
    expect(getDesktopNetworkSnapshot().proxyUrl).toBe('socks5h://127.0.0.1:7891');
  });

  it('increments the revision when the manual proxy is cleared', () => {
    saveDesktopProxyUrl('127.0.0.1:7890');
    expect(saveDesktopProxyUrl('')).toMatchObject({ mode: 'system', revision: 2 });
  });

  it('notifies subscribers after a same-window settings change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDesktopNetworkSettings(listener);

    saveDesktopProxyUrl('127.0.0.1:7890');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toMatchObject({
      mode: 'manual',
      proxyUrl: 'http://127.0.0.1:7890'
    });

    unsubscribe();
    saveDesktopProxyUrl('127.0.0.1:7891');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('detects Tauri without treating the normal PWA window as desktop', () => {
    expect(isDesktopRuntime()).toBe(false);
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    });
    expect(isDesktopRuntime()).toBe(true);
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });
});
