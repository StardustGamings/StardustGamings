import { clamp, seededRandom } from '@/utils/math';

/**
 * Classic (no-ML) background removal for plain backgrounds: learn the
 * background colours from the photo's border, flood-fill from the edges
 * through similar colours, and keep everything the fill can't reach.
 * Instant, fully local, and good for product shots, studio portraits and
 * screenshots. Returns foreground alpha (0..1) per pixel.
 */

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

const LINEAR = Float32Array.from({ length: 256 }, (_, i) => srgbToLinear(i));

/** CIE Lab (D65) — perceptual distances make the tolerance behave evenly across colours. */
export function toLab(data: Uint8ClampedArray, count: number): Float32Array {
  const lab = new Float32Array(count * 3);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  for (let i = 0; i < count; i++) {
    const r = LINEAR[data[i * 4]!]!;
    const g = LINEAR[data[i * 4 + 1]!]!;
    const b = LINEAR[data[i * 4 + 2]!]!;
    const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
    lab[i * 3] = 116 * y - 16;
    lab[i * 3 + 1] = 500 * (x - y);
    lab[i * 3 + 2] = 200 * (y - z);
  }
  return lab;
}

const dist = (lab: Float32Array, i: number, c: number[]) =>
  Math.hypot(lab[i * 3]! - c[0]!, lab[i * 3 + 1]! - c[1]!, lab[i * 3 + 2]! - c[2]!);

function borderIndices(w: number, h: number, band: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < band || y < band || x >= w - band || y >= h - band) out.push(y * w + x);
    }
  }
  return out;
}

/** k-means over border colours; tiny clusters (the subject touching the edge) are dropped. */
function backgroundModels(lab: Float32Array, border: number[], k = 3): number[][] {
  const random = seededRandom(border.length);
  const sample =
    border.length > 3000 ? Array.from({ length: 3000 }, () => border[Math.floor(random() * border.length)]!) : border;
  let centers = Array.from({ length: k }, (_, i) => {
    const idx = sample[Math.floor(((i + 0.5) / k) * sample.length)]!;
    return [lab[idx * 3]!, lab[idx * 3 + 1]!, lab[idx * 3 + 2]!];
  });
  let counts = new Array<number>(k).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = new Array<number>(k).fill(0);
    for (const idx of sample) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, ci) => {
        const d = dist(lab, idx, c);
        if (d < bestD) {
          bestD = d;
          best = ci;
        }
      });
      counts[best]!++;
      sums[best]![0]! += lab[idx * 3]!;
      sums[best]![1]! += lab[idx * 3 + 1]!;
      sums[best]![2]! += lab[idx * 3 + 2]!;
    }
    centers = centers.map((c, ci) => (counts[ci]! > 0 ? sums[ci]!.map((v) => v / counts[ci]!) : c));
  }
  const kept = centers.filter((_, ci) => counts[ci]! >= sample.length * 0.08);
  return kept.length ? kept : centers;
}

export interface ColourKeyOptions {
  /** Extra tolerance, -1..1 (negative keeps more of the photo). */
  tolerance?: number;
}

export function colourKeyMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: ColourKeyOptions = {},
): Float32Array {
  const n = width * height;
  const lab = toLab(data, n);
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.01));
  const border = borderIndices(width, height, band);
  const models = backgroundModels(lab, border);

  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (const c of models) best = Math.min(best, dist(lab, i, c));
    d[i] = best;
  }

  // Tolerance adapts to how noisy/gradient the background is.
  const borderD = border.map((i) => d[i]!).sort((a, b) => a - b);
  const p90 = borderD[Math.floor(borderD.length * 0.9)] ?? 0;
  const threshold = clamp(p90 * 1.8 + 7, 7, 38) * (1 + clamp(options.tolerance ?? 0, -1, 1) * 0.5);

  // Flood fill from the border through background-like pixels.
  const background = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (const i of border) {
    if (d[i]! < threshold && !background[i]) {
      background[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % width;
    const y = (i - x) / width;
    const visit = (j: number) => {
      if (!background[j] && d[j]! < threshold) {
        background[j] = 1;
        queue[tail++] = j;
      }
    };
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (y > 0) visit(i - width);
    if (y < height - 1) visit(i + width);
  }

  // Soft alpha: reached pixels fade in as they approach the threshold (anti-aliased edges).
  const alpha = new Float32Array(n);
  const soft = threshold * 0.55;
  for (let i = 0; i < n; i++) {
    if (!background[i]) alpha[i] = 1;
    else {
      const t = clamp((d[i]! - soft) / (threshold - soft), 0, 1);
      alpha[i] = t * t * (3 - 2 * t) * 0.6;
    }
  }
  removeSpecks(alpha, width, height, Math.max(4, Math.round(n * 0.0004)));
  return alpha;
}

/** Drops tiny isolated foreground islands (noise the fill didn't reach). */
export function removeSpecks(alpha: Float32Array, width: number, height: number, minArea: number): void {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (seen[start] || alpha[start]! < 0.5) continue;
    let top = 0;
    const members: number[] = [];
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const i = stack[--top]!;
      members.push(i);
      const x = i % width;
      const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width];
      for (const j of neighbours) {
        if (j < 0 || j >= n || seen[j] || alpha[j]! < 0.5) continue;
        seen[j] = 1;
        stack[top++] = j;
      }
    }
    if (members.length <= minArea) for (const i of members) alpha[i] = 0;
  }
}
