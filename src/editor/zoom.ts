import { ZOOM_MAX, ZOOM_MIN } from './camera';

export const ZOOM_STEPS = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

/** Next preset zoom level in `direction` (used by zoom buttons and shortcuts). */
export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > current + 1e-3) ?? ZOOM_MAX;
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-3) ?? ZOOM_MIN;
}
