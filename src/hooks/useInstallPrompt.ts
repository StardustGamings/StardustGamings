'use client';

import { useCallback, useEffect, useState } from 'react';
import { isInstalledApp } from '@/native/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallState = 'unavailable' | 'available' | 'installed' | 'ios';

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

function detect(): InstallState {
  if (typeof window === 'undefined') return 'unavailable';
  if (isInstalledApp()) return 'installed';
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  if (deferred) return 'available';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
  return ios ? 'ios' : 'unavailable';
}

/** PWA install prompt (Chromium) with an iOS "Add to Home Screen" fallback state. */
export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>('unavailable');

  useEffect(() => {
    const update = () => setState(detect());
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    setState(detect());
    return outcome === 'accepted';
  }, []);

  return { state, install };
}
