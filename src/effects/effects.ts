import type { ImageEffects, LeakStyle } from '@/types/document';
import { clamp } from '@/utils/math';

/**
 * Creative photo effects. The maths here is the reference implementation: the
 * CPU develop path calls these functions directly and the WebGL shader in
 * src/images/gl.ts mirrors them line for line. Everything is expressed in
 * normalised photo coordinates (u, v in 0..1), so effects look the same at
 * every resolution — thumbnails, the editor and exports.
 */

export type EffectKey = 'glow' | 'leak' | 'dust' | 'rgbSplit' | 'scanlines';

export interface EffectDef {
  key: EffectKey;
  label: string;
  hint: string;
}

export const EFFECT_DEFS: EffectDef[] = [
  { key: 'glow', label: 'Glow', hint: 'Soft bloom around the bright parts' },
  { key: 'leak', label: 'Light leak', hint: 'Warm light washing in from the edge' },
  { key: 'dust', label: 'Dust & scratches', hint: 'Specks and hairline scratches, like old film' },
  { key: 'rgbSplit', label: 'RGB split', hint: 'Red and blue drift apart' },
  { key: 'scanlines', label: 'Scanlines', hint: 'CRT / VHS lines' },
];

export const EFFECT_KEYS = EFFECT_DEFS.map((d) => d.key);

export const LEAK_STYLES: { id: LeakStyle; label: string; swatch: string }[] = [
  { id: 'amber', label: 'Amber', swatch: 'linear-gradient(135deg, #FF7A1A, #FFC04D)' },
  { id: 'rose', label: 'Rose', swatch: 'linear-gradient(135deg, #FF4D73, #FF9A6B)' },
  { id: 'prism', label: 'Prism', swatch: 'linear-gradient(135deg, #FF5A3C, #FFE14D, #4D7BFF)' },
  { id: 'ice', label: 'Ice', swatch: 'linear-gradient(135deg, #59C2FF, #B28CFF)' },
];

/** A light blob: centre (u, v — may sit outside the frame), radius (in frame heights) and colour. */
export interface LeakBlob {
  x: number;
  y: number;
  radius: number;
  color: [number, number, number];
}

/** Always three blobs (unused ones are black) so the shader loop has a fixed size. */
export const LEAK_BLOBS: Record<LeakStyle, [LeakBlob, LeakBlob, LeakBlob]> = {
  amber: [
    { x: -0.08, y: 0.18, radius: 0.85, color: [1, 0.42, 0.08] },
    { x: 1.06, y: 0.92, radius: 0.5, color: [1, 0.72, 0.28] },
    { x: 0.2, y: -0.12, radius: 0.35, color: [1, 0.85, 0.45] },
  ],
  rose: [
    { x: 1.08, y: 0.04, radius: 0.85, color: [1, 0.26, 0.42] },
    { x: -0.1, y: 1.02, radius: 0.55, color: [1, 0.52, 0.32] },
    { x: 0.5, y: -0.2, radius: 0.3, color: [1, 0.6, 0.7] },
  ],
  prism: [
    { x: -0.08, y: 0.5, radius: 0.62, color: [1, 0.28, 0.18] },
    { x: 0.32, y: -0.1, radius: 0.5, color: [1, 0.86, 0.28] },
    { x: 1.1, y: 0.62, radius: 0.62, color: [0.3, 0.48, 1] },
  ],
  ice: [
    { x: 1.06, y: 0.1, radius: 0.8, color: [0.32, 0.72, 1] },
    { x: -0.04, y: 1.06, radius: 0.55, color: [0.66, 0.48, 1] },
    { x: 0.5, y: 1.2, radius: 0.3, color: [0.6, 0.9, 1] },
  ],
};

/** Normalised effect strengths (0..1) handed to the develop pipeline. */
export interface EffectParams {
  glow: number;
  leak: number;
  leakStyle: LeakStyle;
  dust: number;
  rgbSplit: number;
  scanlines: number;
}

export const NO_EFFECTS: EffectParams = { glow: 0, leak: 0, leakStyle: 'amber', dust: 0, rgbSplit: 0, scanlines: 0 };

export function effectParams(e: ImageEffects | undefined): EffectParams {
  const n = (v: number | undefined) => clamp((v ?? 0) / 100, 0, 1);
  return {
    glow: n(e?.glow),
    leak: n(e?.leak),
    leakStyle: e?.leakStyle ?? 'amber',
    dust: n(e?.dust),
    rgbSplit: n(e?.rgbSplit),
    scanlines: n(e?.scanlines),
  };
}

export function hasEffects(e: ImageEffects | undefined): boolean {
  return !!e && EFFECT_KEYS.some((k) => (e[k] ?? 0) > 0);
}

export const anyEffect = (p: EffectParams) => p.glow > 0 || p.leak > 0 || p.dust > 0 || p.rgbSplit > 0 || p.scanlines > 0;

/* ───────────── Shared maths ───────────── */

/** Horizontal channel offset for the RGB split, in u units. */
export const rgbSplitOffset = (amount: number) => amount * 0.008;

/** Glow blur radius in pixels for an image whose long side is `maxDim`. */
export const glowRadius = (maxDim: number) => 0.035 * maxDim;

/** Bright-pass weight used to build the glow source. */
export const glowWeight = (luma: number) => smoothstep(0.45, 1, luma);

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Screen blend of `c` with `light` (both 0..1). */
const screen = (c: number, light: number) => 1 - (1 - c) * (1 - clamp(light, 0, 1));

/** Hash in [0, 1) of an integer cell — the shader uses the same formula. */
export function hash2(x: number, y: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Light-leak colour at (u, v) before strength is applied. */
export function leakColor(style: LeakStyle, u: number, v: number, aspect: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const blob of LEAK_BLOBS[style]) {
    const dx = (u - blob.x) * aspect;
    const dy = v - blob.y;
    const f = 1 - smoothstep(0, blob.radius, Math.sqrt(dx * dx + dy * dy));
    const w = f * f;
    r += blob.color[0] * w;
    g += blob.color[1] * w;
    b += blob.color[2] * w;
  }
  return [r, g, b];
}

/** Scanline darkening factor (1 = untouched) at vertical position v. 320 lines per frame height. */
export function scanlineFactor(v: number, amount: number): number {
  const m = 0.5 + 0.5 * Math.cos(v * 320 * 2 * Math.PI);
  return 1 - amount * 0.38 * m;
}

/**
 * Dust and scratches at (u, v): returns a signed amount to add to each channel
 * (specks are light or dark; scratches are light).
 */
export function dustAt(u: number, v: number, aspect: number, amount: number): number {
  if (amount <= 0) return 0;
  // Specks live in a grid of ~140 cells per frame height.
  const sx = u * aspect * 140;
  const sy = v * 140;
  const cx = Math.floor(sx);
  const cy = Math.floor(sy);
  let out = 0;
  const h = hash2(cx, cy);
  if (h > 1 - 0.035 * amount) {
    const ox = hash2(cx + 17, cy + 3) * 0.5 - 0.25;
    const oy = hash2(cx + 5, cy + 29) * 0.5 - 0.25;
    const r = 0.12 + 0.22 * hash2(cx + 11, cy + 7);
    const dx = sx - cx - 0.5 - ox;
    const dy = sy - cy - 0.5 - oy;
    const m = 1 - smoothstep(r * 0.4, r, Math.sqrt(dx * dx + dy * dy));
    out += (hash2(cx + 3, cy + 13) > 0.3 ? 0.55 : -0.45) * m;
  }
  // A few hairline vertical scratches; more appear as the amount goes up.
  for (let k = 0; k < 4; k++) {
    if (amount <= k * 0.25) break;
    const x = 0.08 + 0.84 * hash2(k * 7 + 1, 13);
    const width = 0.0009 + 0.0007 * hash2(k, 5);
    const d = Math.abs(u - x);
    const along = 0.5 + 0.5 * Math.sin(v * (9 + k * 5) + k * 1.7);
    out += (1 - smoothstep(0, width, d)) * 0.35 * along;
  }
  return out * amount;
}

/**
 * Applies glow, light leak, scanlines and dust to one pixel (after tone,
 * colour, curves and fade; before grain). `glowRgb` is the blurred bright-pass
 * colour at this pixel (or null without glow).
 */
export function applyEffects(
  rgb: [number, number, number],
  p: EffectParams,
  u: number,
  v: number,
  aspect: number,
  glowRgb: [number, number, number] | null,
): [number, number, number] {
  let [r, g, b] = rgb;
  if (p.glow > 0 && glowRgb) {
    const k = p.glow * 1.3;
    r = screen(r, glowRgb[0] * k);
    g = screen(g, glowRgb[1] * k);
    b = screen(b, glowRgb[2] * k);
  }
  if (p.leak > 0) {
    const [lr, lg, lb] = leakColor(p.leakStyle, u, v, aspect);
    const k = p.leak * 1.35;
    r = screen(r, lr * k);
    g = screen(g, lg * k);
    b = screen(b, lb * k);
  }
  if (p.scanlines > 0) {
    const f = scanlineFactor(v, p.scanlines);
    r *= f;
    g *= f;
    b *= f;
  }
  if (p.dust > 0) {
    const d = dustAt(u, v, aspect, p.dust);
    r += d;
    g += d;
    b += d;
  }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}
