interface ServiceWorkerEnvironment {
  isTauri: boolean;
  protocol: string;
  serviceWorkerSupported: boolean;
}

const TAURI_SW_CLEANUP_KEY = 'notesflash.tauri-sw-cleanup.v1';

export function shouldRegisterPwaServiceWorker(environment: ServiceWorkerEnvironment): boolean {
  if (environment.isTauri || !environment.serviceWorkerSupported) return false;
  return environment.protocol === 'https:' || environment.protocol === 'http:';
}

export function shouldClearTauriServiceWorkers(environment: ServiceWorkerEnvironment): boolean {
  return environment.isTauri && environment.serviceWorkerSupported;
}

export function registerPwaServiceWorker(): void {
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const environment = {
    isTauri: '__TAURI_INTERNALS__' in window,
    protocol: window.location.protocol,
    serviceWorkerSupported
  };

  if (shouldClearTauriServiceWorkers(environment)) {
    void clearLegacyTauriServiceWorkers();
    return;
  }

  if (
    !shouldRegisterPwaServiceWorker(environment)
  ) {
    return;
  }

  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    },
    { once: true }
  );
}

async function clearLegacyTauriServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      sessionStorage.removeItem(TAURI_SW_CLEANUP_KEY);
      return;
    }

    const controlled = navigator.serviceWorker.controller !== null;
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (controlled && sessionStorage.getItem(TAURI_SW_CLEANUP_KEY) !== 'done') {
      sessionStorage.setItem(TAURI_SW_CLEANUP_KEY, 'done');
      window.location.reload();
    }
  } catch {
    // Service workers are optional in the desktop WebView. Cleanup failure
    // must never prevent the native app from starting.
  }
}
