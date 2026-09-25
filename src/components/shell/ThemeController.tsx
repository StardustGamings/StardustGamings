'use client';

import { useEffect } from 'react';
import { useSettings } from '@/settings/store';
import { THEME_COLORS } from '@/settings/resolve';
import { useResolvedMotion, useResolvedTheme } from '@/hooks/usePreferences';

/**
 * Mirrors settings onto <html> data attributes (read by CSS tokens). The inline
 * head script sets the same attributes before first paint; this keeps them in
 * sync afterwards and reacts to OS-level theme / motion changes.
 */
export function ThemeController() {
  const hydrated = useSettings((s) => s.hasHydrated);
  const theme = useResolvedTheme();
  const motion = useResolvedMotion();
  const highContrast = useSettings((s) => s.highContrast);
  const glass = useSettings((s) => s.glass);
  const ambient = useSettings((s) => s.ambientEffects);
  const uiScale = useSettings((s) => s.uiScale);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = motion;
    root.dataset.contrast = highContrast ? 'high' : 'normal';
    root.dataset.glass = glass ? 'on' : 'off';
    root.dataset.ambient = ambient ? 'on' : 'off';
    root.style.fontSize = `${uiScale * 100}%`;
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }, [hydrated, theme, motion, highContrast, glass, ambient, uiScale]);

  return null;
}
