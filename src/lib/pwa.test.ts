import { describe, expect, it } from 'vitest';
import { shouldClearTauriServiceWorkers, shouldRegisterPwaServiceWorker } from './pwa';

describe('PWA service worker registration', () => {
  it('never registers inside a Tauri desktop WebView', () => {
    const environment = {
      isTauri: true,
      protocol: 'tauri:',
      serviceWorkerSupported: true
    };
    expect(shouldRegisterPwaServiceWorker(environment)).toBe(false);
    expect(shouldClearTauriServiceWorkers(environment)).toBe(true);
  });

  it('registers for the HTTPS web and PWA build', () => {
    expect(
      shouldRegisterPwaServiceWorker({
        isTauri: false,
        protocol: 'https:',
        serviceWorkerSupported: true
      })
    ).toBe(true);
  });

  it('does not register for unsupported protocols or browsers', () => {
    expect(
      shouldRegisterPwaServiceWorker({
        isTauri: false,
        protocol: 'file:',
        serviceWorkerSupported: true
      })
    ).toBe(false);
    expect(
      shouldRegisterPwaServiceWorker({
        isTauri: false,
        protocol: 'https:',
        serviceWorkerSupported: false
      })
    ).toBe(false);
  });
});
