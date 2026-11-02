'use client';

import { useSettings } from '@/settings/store';
import { resolveMotion, resolveTheme } from '@/settings/resolve';
import type { ResolvedMotion, ResolvedTheme } from '@/types/settings';
import { useMediaQuery } from './useMediaQuery';

export function useResolvedTheme(): ResolvedTheme {
  const pref = useSettings((s) => s.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', true);
  return resolveTheme(pref, systemDark);
}

export function useResolvedMotion(): ResolvedMotion {
  const pref = useSettings((s) => s.motion);
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)', false);
  return resolveMotion(pref, systemReduced);
}

/** True when decorative motion (parallax, magnetic, particles) should run. */
export function useFullMotion(): boolean {
  return useResolvedMotion() === 'full';
}
