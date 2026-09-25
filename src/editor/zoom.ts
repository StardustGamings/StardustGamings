import { clamp } from '@/utils/math';

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 4;
export const ZOOM_STEPS = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4];

export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > current + 1e-3) ?? ZOOM_MAX;
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-3) ?? ZOOM_MIN;
}

/** Zoom that fits a slide strip inside a viewport (with padding), never above 100%. */
export function fitZoom(
  viewport: { width: number; height: number },
  slide: { width: number; height: number },
  slidesAcross: number,
  padding = 48,
): number {
  const w = Math.max(1, viewport.width - padding * 2);
  const h = Math.max(1, viewport.height - padding * 2);
  const across = Math.max(1, slidesAcross);
  return clamp(Math.min(w / (slide.width * across), h / slide.height, 1), ZOOM_MIN, ZOOM_MAX);
}
