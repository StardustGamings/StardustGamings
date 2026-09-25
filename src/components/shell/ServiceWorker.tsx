'use client';

import { useEffect } from 'react';
import { toast } from '@/components/ui/toast-store';

/** Registers the offline service worker in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let reloading = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && hadController) {
              toast({
                title: 'A fresh version of Stardeck is ready',
                description: 'Your projects are safe — reload whenever you like.',
                tone: 'info',
                duration: 0,
                action: {
                  label: 'Reload',
                  onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }),
                },
              });
            }
          });
        });
      })
      .catch(() => {
        /* Offline support is progressive: the app works without it. */
      });

    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  return null;
}
