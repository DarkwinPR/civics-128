/**
 * Registers the offline service worker (production builds only) and shows a
 * small banner when a new version is ready, instead of reloading mid-study.
 */
export function registerServiceWorker(onUpdateReady: (apply: () => void) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        const offer = (worker: ServiceWorker | null) => {
          if (!worker || !navigator.serviceWorker.controller) return;
          onUpdateReady(() => {
            worker.postMessage('SKIP_WAITING');
          });
        };

        if (registration.waiting) offer(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') offer(installing);
          });
        });

        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });
      })
      .catch(() => {
        // Offline support is a progressive enhancement; ignore failures.
      });
  });
}
