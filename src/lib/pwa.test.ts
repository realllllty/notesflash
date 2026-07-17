import { describe, expect, it, vi } from 'vitest';
import {
  clearLegacyTauriServiceWorkers,
  shouldClearTauriServiceWorkers,
  shouldRegisterPwaServiceWorker,
  type TauriServiceWorkerCleanupAdapters
} from './pwa';

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

  it('waits for legacy registrations to unregister before continuing', async () => {
    let finishUnregister: ((value: boolean) => void) | undefined;
    const unregister = vi.fn(
      () => new Promise<boolean>((resolve) => {
        finishUnregister = resolve;
      })
    );
    const adapters = cleanupAdapters({
      getRegistrations: async () => [{ unregister }]
    });

    let settled = false;
    const result = clearLegacyTauriServiceWorkers(adapters).then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    finishUnregister?.(true);
    await expect(result).resolves.toBe(true);
    expect(unregister).toHaveBeenCalledOnce();
  });

  it('reloads once when a legacy controller survives without registrations', async () => {
    const adapters = cleanupAdapters({
      hasController: () => true
    });

    await expect(clearLegacyTauriServiceWorkers(adapters)).resolves.toBe(false);
    expect(adapters.setReloadMarker).toHaveBeenCalledWith('done');
    expect(adapters.reload).toHaveBeenCalledOnce();
  });

  it('does not create a reload loop when the guarded reload already ran', async () => {
    const adapters = cleanupAdapters({
      hasController: () => true,
      getReloadMarker: () => 'done'
    });

    await expect(clearLegacyTauriServiceWorkers(adapters)).resolves.toBe(true);
    expect(adapters.reload).not.toHaveBeenCalled();
  });

  it('continues startup when service-worker cleanup fails', async () => {
    const adapters = cleanupAdapters({
      getRegistrations: vi.fn().mockRejectedValue(new Error('WebKit storage unavailable'))
    });

    await expect(clearLegacyTauriServiceWorkers(adapters)).resolves.toBe(true);
  });
});

function cleanupAdapters(
  overrides: Partial<TauriServiceWorkerCleanupAdapters> = {}
): TauriServiceWorkerCleanupAdapters {
  return {
    getRegistrations: vi.fn(async () => []),
    hasController: vi.fn(() => false),
    getReloadMarker: vi.fn(() => null),
    setReloadMarker: vi.fn(),
    removeReloadMarker: vi.fn(),
    reload: vi.fn(),
    ...overrides
  };
}
