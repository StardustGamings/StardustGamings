'use client';

import { useEffect } from 'react';
import { useResolvedTheme } from '@/hooks/usePreferences';
import { isNativeApp } from '@/native/platform';

/** Android-app behaviour (back button, status bar). Does nothing in browsers. */
export function NativeApp() {
  const theme = useResolvedTheme();

  useEffect(() => {
    if (!isNativeApp()) return;
    let cleanup: (() => void) | undefined;
    let live = true;
    void import('@/native/app').then(({ handleBackButton }) => {
      if (live) cleanup = handleBackButton();
    });
    return () => {
      live = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    void import('@/native/app').then(({ matchSystemBars }) => matchSystemBars(theme));
  }, [theme]);

  return null;
}
