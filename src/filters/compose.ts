import type { ImageAdjustments, ImageEffects, ImageElement } from '@/types/document';
import { ADJUSTMENT_GROUPS, cleanAdjustments, curvesLut, hasCurves, type AdjustmentKey } from '@/images/adjustments';
import { EFFECT_KEYS, hasEffects } from '@/effects/effects';
import { clamp } from '@/utils/math';
import { resolveLook, type LookDefinition } from './looks';

/**
 * How a look combines with the photo's own edits: every slider is the user's
 * value plus the look's value × intensity (clamped to the slider's range);
 * tone curves apply the look's curve (blended toward identity by intensity)
 * after the user's; effects add up the same way as sliders.
 */

type Photo = Pick<ImageElement, 'adjust' | 'curves' | 'filter' | 'effects'>;

const RANGES = new Map(ADJUSTMENT_GROUPS.flatMap((g) => g.items.map((d) => [d.key, [d.min, d.max] as const])));

/** The active look and its strength (0..1), if any. */
export function activeLook(el: Photo): { look: LookDefinition; t: number } | null {
  const look = resolveLook(el.filter);
  const t = clamp((el.filter?.intensity ?? 0) / 100, 0, 1);
  return look && t > 0 ? { look, t } : null;
}

export function effectiveAdjust(el: Photo): ImageAdjustments | undefined {
  const active = activeLook(el);
  if (!active) return el.adjust;
  const out: ImageAdjustments = { ...el.adjust };
  for (const [key, value] of Object.entries(active.look.adjust) as [AdjustmentKey, number][]) {
    const [min, max] = RANGES.get(key) ?? [-100, 100];
    out[key] = clamp((el.adjust?.[key] ?? 0) + value * active.t, min, max);
  }
  return cleanAdjustments(out);
}

export function effectiveEffects(el: Photo): ImageEffects | undefined {
  const active = activeLook(el);
  if (!active?.look.effects) return el.effects;
  const out: ImageEffects = { ...el.effects };
  for (const key of EFFECT_KEYS) {
    const add = (active.look.effects[key] ?? 0) * active.t;
    if (add) out[key] = clamp((el.effects?.[key] ?? 0) + add, 0, 100);
  }
  out.leakStyle = el.effects?.leak ? (el.effects.leakStyle ?? 'amber') : (active.look.effects.leakStyle ?? el.effects?.leakStyle);
  return out;
}

/** Vignette including the look's (the renderer draws it so it follows the frame). */
export const effectiveVignette = (el: Photo): number => effectiveAdjust(el)?.vignette ?? 0;

/** Does the look (or do the effects) change the pixels at all? */
export function hasLookOrEffects(el: Photo): boolean {
  return activeLook(el) !== null || hasEffects(el.effects);
}

/** Combined RGBA curves table (user curves, then the look's), or null when both are identity. */
export function effectiveLut(el: Photo): Uint8Array | null {
  const user = hasCurves(el.curves) ? curvesLut(el.curves) : null;
  const active = activeLook(el);
  const lookCurves = active?.look.curves && hasCurves(active.look.curves) ? curvesLut(active.look.curves) : null;
  if (!lookCurves) return user;
  const t = active!.t;
  const out = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    for (let c = 0; c < 3; c++) {
      const x = user ? user[i * 4 + c]! : i;
      const y = lookCurves[x * 4 + c]!;
      out[i * 4 + c] = Math.round(x + (y - x) * t);
    }
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Stable key for everything the look contributes (for develop caching). */
export function lookSignature(el: Photo): unknown {
  const active = activeLook(el);
  return [active ? [active.look.id, Math.round(active.t * 1000)] : null, hasEffects(el.effects) ? el.effects : null];
}

export { EFFECT_KEYS };
