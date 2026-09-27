'use client';

import { useSettings } from '@/settings/store';

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * App background texture ("Background effects" in Settings): a faint, static paper grain.
 * Nothing moves and nothing is coloured, so it never competes with the work on screen.
 */
export function Backdrop() {
  const ambient = useSettings((s) => s.ambientEffects);
  const highContrast = useSettings((s) => s.highContrast);
  if (!ambient || highContrast) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 mix-blend-overlay"
      style={{ backgroundImage: GRAIN, opacity: 'var(--texture-opacity)' }}
    />
  );
}
