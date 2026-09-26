import type { CurvePoint, ImageAdjustments, ImageCurves, ImageElement, ImagePerspective } from '@/types/document';
import { clamp } from '@/utils/math';

/**
 * Photo adjustment definitions and the per-pixel maths. The WebGL shader in
 * `gl.ts` implements exactly these formulas; the CPU fallback and the tests
 * use the TypeScript versions below.
 */

export type AdjustmentKey = keyof ImageAdjustments;

export interface AdjustmentDef {
  key: AdjustmentKey;
  label: string;
  min: number;
  max: number;
}

export const ADJUSTMENT_GROUPS: { title: string; items: AdjustmentDef[] }[] = [
  {
    title: 'Light',
    items: [
      { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
      { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
      { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
      { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
      { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
    ],
  },
  {
    title: 'Colour',
    items: [
      { key: 'temperature', label: 'Temperature', min: -100, max: 100 },
      { key: 'tint', label: 'Tint', min: -100, max: 100 },
      { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
      { key: 'vibrance', label: 'Vibrance', min: -100, max: 100 },
    ],
  },
  {
    title: 'Effects',
    items: [
      { key: 'fade', label: 'Fade', min: 0, max: 100 },
      { key: 'vignette', label: 'Vignette', min: -100, max: 100 },
      { key: 'grain', label: 'Grain', min: 0, max: 100 },
    ],
  },
  {
    title: 'Detail',
    items: [
      { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
      { key: 'blur', label: 'Blur', min: 0, max: 100 },
    ],
  },
];

export const ADJUSTMENT_KEYS = ADJUSTMENT_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export function hasAdjustments(a: ImageAdjustments | undefined): boolean {
  return !!a && ADJUSTMENT_KEYS.some((k) => (a[k] ?? 0) !== 0);
}

/** Removes zero values so documents stay small and "untouched" stays detectable. */
export function cleanAdjustments(a: ImageAdjustments): ImageAdjustments | undefined {
  const out: ImageAdjustments = {};
  for (const k of ADJUSTMENT_KEYS) {
    const v = a[k];
    if (v !== undefined && v !== 0) out[k] = Math.round(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/* ───────────── Curves ───────────── */

export type CurveChannel = keyof ImageCurves;
export const IDENTITY_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

export function isIdentityCurve(points: CurvePoint[] | undefined): boolean {
  return !points || points.every((p) => Math.abs(p.x - p.y) < 1e-3);
}

export function hasCurves(c: ImageCurves | undefined): boolean {
  return !!c && (['rgb', 'r', 'g', 'b'] as const).some((ch) => !isIdentityCurve(c[ch]));
}

/**
 * Monotone cubic (Fritsch–Carlson) interpolation through the control points,
 * sampled into a 256-entry table — smooth, and never overshoots.
 */
export function curveTable(points: CurvePoint[] | undefined): Uint8Array {
  const table = new Uint8Array(256);
  const pts = [...(points && points.length >= 2 ? points : IDENTITY_CURVE)]
    .map((p) => ({ x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }))
    .sort((a, b) => a.x - b.x)
    .filter((p, i, arr) => i === 0 || p.x - arr[i - 1]!.x > 1e-4);
  const n = pts.length;
  if (n < 2) {
    for (let i = 0; i < 256; i++) table[i] = i;
    return table;
  }
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]!.x - pts[i]!.x);
    slope.push((pts[i + 1]!.y - pts[i]!.y) / dx[i]!);
  }
  const m: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    m.push(slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2);
  }
  m.push(slope[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / slope[i]!;
    const b = m[i + 1]! / slope[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i]!;
      m[i + 1] = t * b * slope[i]!;
    }
  }
  let seg = 0;
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    let y: number;
    if (x <= pts[0]!.x) y = pts[0]!.y;
    else if (x >= pts[n - 1]!.x) y = pts[n - 1]!.y;
    else {
      while (seg < n - 2 && x > pts[seg + 1]!.x) seg++;
      const h = dx[seg]!;
      const t = (x - pts[seg]!.x) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      y =
        (2 * t3 - 3 * t2 + 1) * pts[seg]!.y +
        (t3 - 2 * t2 + t) * h * m[seg]! +
        (-2 * t3 + 3 * t2) * pts[seg + 1]!.y +
        (t3 - t2) * h * m[seg + 1]!;
    }
    table[i] = Math.round(clamp(y, 0, 1) * 255);
  }
  return table;
}

/** RGBA lookup table (256×1): each channel = channel curve ∘ master curve. */
export function curvesLut(c: ImageCurves | undefined): Uint8Array {
  const master = curveTable(c?.rgb);
  const r = curveTable(c?.r);
  const g = curveTable(c?.g);
  const b = curveTable(c?.b);
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const v = master[i]!;
    lut[i * 4] = r[v]!;
    lut[i * 4 + 1] = g[v]!;
    lut[i * 4 + 2] = b[v]!;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

/* ───────────── Perspective ───────────── */

export function hasPerspective(p: ImagePerspective | undefined): boolean {
  return !!p && (p.vertical !== 0 || p.horizontal !== 0);
}

/**
 * Keystone correction as a projective map from output uv (0..1) to source uv.
 * Positive `vertical` narrows the sampled top edge (fixing buildings that lean
 * back); the sampled quad always lies inside the photo so no empty corners appear.
 * Returns a row-major 3×3 matrix.
 */
export function perspectiveMatrix(p: ImagePerspective | undefined): number[] {
  const v = clamp((p?.vertical ?? 0) / 100, -1, 1) * 0.3;
  const h = clamp((p?.horizontal ?? 0) / 100, -1, 1) * 0.3;
  const top = v > 0 ? v : 0;
  const bottom = v < 0 ? -v : 0;
  const left = h > 0 ? h : 0;
  const right = h < 0 ? -h : 0;
  // Source quad for output corners (0,0) (1,0) (1,1) (0,1).
  return squareToQuad([
    [top, left],
    [1 - top, right],
    [1 - bottom, 1 - right],
    [bottom, 1 - left],
  ]);
}

/** Heckbert's square→quad projective mapping. */
export function squareToQuad(q: [number, number][]): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q as [[number, number], [number, number], [number, number], [number, number]];
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1];
  }
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

export function applyMatrix(m: number[], u: number, v: number): [number, number] {
  const x = m[0]! * u + m[1]! * v + m[2]!;
  const y = m[3]! * u + m[4]! * v + m[5]!;
  const w = m[6]! * u + m[7]! * v + m[8]!;
  return [x / w, y / w];
}

/* ───────────── Per-pixel maths (mirrors the GLSL) ───────────── */

export interface PixelParams {
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  fade: number;
  vignette: number;
  grain: number;
}

/** Normalised (-1..1 / 0..1) parameters from the stored -100..100 values. */
export function pixelParams(a: ImageAdjustments | undefined): PixelParams {
  const n = (k: AdjustmentKey) => clamp((a?.[k] ?? 0) / 100, -1, 1);
  return {
    exposure: n('exposure'),
    brightness: n('brightness'),
    contrast: n('contrast'),
    highlights: n('highlights'),
    shadows: n('shadows'),
    temperature: n('temperature'),
    tint: n('tint'),
    saturation: n('saturation'),
    vibrance: n('vibrance'),
    fade: n('fade'),
    vignette: n('vignette'),
    grain: n('grain'),
  };
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Stateless per-pixel noise in [-0.5, 0.5] (same hash as the shader). */
export function grainNoise(x: number, y: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v) - 0.5;
}

/**
 * Tone & colour adjustments for one pixel (channels 0..1, straight alpha).
 * `u, v` are the pixel's position (0..1) for the vignette; `px, py` its integer
 * coordinates for the grain; `aspect` = width / height.
 */
export function adjustPixel(
  rgb: [number, number, number],
  p: PixelParams,
  u: number,
  v: number,
  px: number,
  py: number,
  aspect: number,
): [number, number, number] {
  let [r, g, b] = rgb;

  // Exposure: in (approximately) linear light, ±1.5 stops.
  if (p.exposure !== 0) {
    const k = Math.pow(2, p.exposure * 1.5);
    r = Math.pow(Math.pow(r, 2.2) * k, 1 / 2.2);
    g = Math.pow(Math.pow(g, 2.2) * k, 1 / 2.2);
    b = Math.pow(Math.pow(b, 2.2) * k, 1 / 2.2);
  }
  // Brightness: a midtone gamma curve (keeps pure black & white anchored).
  if (p.brightness !== 0) {
    const gamma = Math.exp(-p.brightness * 0.8);
    r = Math.pow(clamp(r, 0, 1), gamma);
    g = Math.pow(clamp(g, 0, 1), gamma);
    b = Math.pow(clamp(b, 0, 1), gamma);
  }
  // Contrast around mid-grey.
  if (p.contrast !== 0) {
    const f = p.contrast > 0 ? 1 + p.contrast * 1.2 : 1 + p.contrast * 0.8;
    r = (r - 0.5) * f + 0.5;
    g = (g - 0.5) * f + 0.5;
    b = (b - 0.5) * f + 0.5;
  }
  // Highlights / shadows: luminance-masked lifts that stay within range.
  if (p.highlights !== 0 || p.shadows !== 0) {
    const l = clamp(luma(r, g, b), 0, 1);
    const amt = p.shadows * 0.6 * (1 - smoothstep(0, 0.55, l)) + p.highlights * 0.6 * smoothstep(0.45, 1, l);
    const lift = (c: number) => c + amt * (amt > 0 ? 1 - clamp(c, 0, 1) : clamp(c, 0, 1));
    r = lift(r);
    g = lift(g);
    b = lift(b);
  }
  // White balance.
  if (p.temperature !== 0 || p.tint !== 0) {
    r *= 1 + p.temperature * 0.18 + p.tint * 0.05;
    g *= 1 - p.tint * 0.12;
    b *= 1 - p.temperature * 0.18 + p.tint * 0.05;
  }
  // Saturation & vibrance.
  if (p.saturation !== 0 || p.vibrance !== 0) {
    const l = luma(r, g, b);
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const f = 1 + p.saturation + p.vibrance * (1 - clamp(sat, 0, 1)) * 1.2;
    r = l + (r - l) * f;
    g = l + (g - l) * f;
    b = l + (b - l) * f;
  }
  // Fade: lifted blacks, softened whites.
  if (p.fade > 0) {
    r = r * (1 - 0.22 * p.fade) + 0.16 * p.fade;
    g = g * (1 - 0.22 * p.fade) + 0.16 * p.fade;
    b = b * (1 - 0.22 * p.fade) + 0.16 * p.fade;
  }
  // Vignette (aspect-corrected distance from centre).
  if (p.vignette !== 0) {
    const dx = (u - 0.5) * Math.min(1, aspect);
    const dy = (v - 0.5) * Math.min(1, 1 / aspect);
    const d = Math.sqrt(dx * dx + dy * dy) / 0.7071;
    const m = smoothstep(0.35, 1.05, d) * Math.abs(p.vignette) * 0.8;
    if (p.vignette > 0) {
      r *= 1 - m;
      g *= 1 - m;
      b *= 1 - m;
    } else {
      r += (1 - r) * m;
      g += (1 - g) * m;
      b += (1 - b) * m;
    }
  }
  if (p.grain > 0) {
    const n = grainNoise(px, py) * p.grain * 0.22;
    r += n;
    g += n;
    b += n;
  }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

/* ───────────── Pipeline keys ───────────── */

/** Adjustments baked into developed pixels. The vignette is drawn by the renderer so it follows the frame. */
function pixelAdjustments(a: ImageAdjustments | undefined): ImageAdjustments | null {
  if (!a) return null;
  const { vignette: _v, ...rest } = a;
  return hasAdjustments(rest) ? rest : null;
}

/** Does this element need the develop pipeline (vs. drawing the photo directly)? */
export function needsDevelop(el: ImageElement): boolean {
  return !!pixelAdjustments(el.adjust) || hasCurves(el.curves) || hasPerspective(el.perspective) || !!el.cutout;
}

/** Everything that affects developed pixels (not geometry or vignette — the renderer does those). */
export function developSignature(el: ImageElement): string {
  return JSON.stringify([el.assetId, pixelAdjustments(el.adjust), el.curves ?? null, el.perspective ?? null, el.cutout ?? null]);
}

/** Blur radius in source pixels for a 0..100 slider on an image of `maxDim` pixels. */
export const blurRadius = (amount: number, maxDim: number) => (clamp(amount, 0, 100) / 100) * 0.025 * maxDim;
export const featherRadius = (amount: number, maxDim: number) => (clamp(amount, 0, 100) / 100) * 0.012 * maxDim;
export const backdropBlurRadius = (amount: number, maxDim: number) => (clamp(amount, 0, 100) / 100) * 0.05 * maxDim;
