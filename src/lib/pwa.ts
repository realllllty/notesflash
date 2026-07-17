interface ServiceWorkerEnvironment {
  isTauri: boolean;
  protocol: string;
  serviceWorkerSupported: boolean;
}

interface LegacyServiceWorkerRegistration {
  unregister(): Promise<boolean>;
}

export interface TauriServiceWorkerCleanupAdapters {
  getRegistrations(): Promise<readonly LegacyServiceWorkerRegistration[]>;
  hasController(): boolean;
  getReloadMarker(): string | null;
  setReloadMarker(value: string): void;
  removeReloadMarker(): void;
  reload(): void;
}

const TAURI_SW_CLEANUP_KEY = 'notesflash.tauri-sw-cleanup.v1';

export function shouldRegisterPwaServiceWorker(environment: ServiceWorkerEnvironment): boolean {
  if (environment.isTauri || !environment.serviceWorkerSupported) return false;
  return environment.protocol === 'https:' || environment.protocol === 'http:';
}

export function shouldClearTauriServiceWorkers(environment: ServiceWorkerEnvironment): boolean {
  return environment.isTauri && environment.serviceWorkerSupported;
}

/**
 * Prepares the runtime before Svelte mounts. A false result means a one-time
 * reload was started to release a legacy service-worker controller, so the
 * current document must not begin loading cloud data.
 */
export async function prepareRuntimeServiceWorker(): Promise<boolean> {
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const environment = {
    isTauri: '__TAURI_INTERNALS__' in window,
    protocol: window.location.protocol,
    serviceWorkerSupported
  };

  if (shouldClearTauriServiceWorkers(environment)) {
    return clearLegacyTauriServiceWorkers();
  }

  if (
    !shouldRegisterPwaServiceWorker(environment)
  ) {
    return true;
  }

  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    },
    { once: true }
  );
  return true;
}

export async function clearLegacyTauriServiceWorkers(
  adapters: TauriServiceWorkerCleanupAdapters = defaultCleanupAdapters()
): Promise<boolean> {
  try {
    const registrations = await adapters.getRegistrations();
    const controlled = adapters.hasController();
    await Promise.allSettled(registrations.map((registration) => registration.unregister()));

    // A controller can outlive its registration until the current document is
    // reloaded. This also covers the observed edge case where getRegistrations
    // is already empty but WKWebView still reports a legacy controller.
    if (controlled && adapters.getReloadMarker() !== 'done') {
      adapters.setReloadMarker('done');
      adapters.reload();
      return false;
    }

    if (!controlled) adapters.removeReloadMarker();
  } catch {
    // Service workers are optional in the desktop WebView. Cleanup failure
    // must never prevent the native HTTP client from starting.
  }
  return true;
}

function defaultCleanupAdapters(): TauriServiceWorkerCleanupAdapters {
  return {
    getRegistrations: () => navigator.serviceWorker.getRegistrations(),
    hasController: () => navigator.serviceWorker.controller !== null,
    getReloadMarker: () => sessionStorage.getItem(TAURI_SW_CLEANUP_KEY),
    setReloadMarker: (value) => sessionStorage.setItem(TAURI_SW_CLEANUP_KEY, value),
    removeReloadMarker: () => sessionStorage.removeItem(TAURI_SW_CLEANUP_KEY),
    reload: () => window.location.reload()
  };
}
