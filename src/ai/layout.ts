import { toHex } from '@/utils/color';
import type { LayoutPlan, LayoutRequest, PhotoFacts } from './schemas';

/**
 * "Create a carousel from these photos", on the device. Each photo is measured
 * from its small thumbnail (brightness, colour, warmth, sharpness and a
 * difference hash for near-duplicates); the plan then skips duplicates, picks
 * the strongest cover, orders the rest so colours flow from slide to slide,
 * and chooses a photo-dump style and title from the overall mood. The photos
 * themselves never leave the device — the optional AI server only ever sees
 * these numbers.
 */

export interface PixelFacts {
  brightness: number;
  saturation: number;
  warmth: number;
  sharpness: number;
  hash: bigint;
  /** Average colour, for ordering and telling near-duplicates apart. */
  mean: [number, number, number];
}

/** Measures an RGBA buffer (a thumbnail drawn at a small size). */
export function analyzePixels(data: Uint8ClampedArray, width: number, height: number): PixelFacts {
  const n = width * height;
  const gray = new Float32Array(n);
  let sumL = 0;
  let sumS = 0;
  let sumW = 0;
  let r0 = 0;
  let g0 = 0;
  let b0 = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]! / 255;
    const g = data[i * 4 + 1]! / 255;
    const b = data[i * 4 + 2]! / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[i] = l;
    sumL += l;
    sumS += max === 0 ? 0 : (max - min) / max;
    sumW += r - b;
    r0 += r;
    g0 += g;
    b0 += b;
  }
  // Sharpness: variance of the Laplacian (edges), squashed into 0..1.
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - width]! - gray[i + width]!;
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const mean = count ? lapSum / count : 0;
  const variance = count ? lapSq / count - mean * mean : 0;
  const sharpness = 1 - Math.exp(-variance * 60);
  return {
    brightness: sumL / n,
    saturation: sumS / n,
    warmth: Math.max(-1, Math.min(1, (sumW / n) * 2.5)),
    sharpness,
    hash: differenceHash(gray, width, height),
    mean: [(r0 / n) * 255, (g0 / n) * 255, (b0 / n) * 255],
  };
}

/** 64-bit difference hash: 9×8 box-sampled grayscale, left/right comparisons. */
export function differenceHash(gray: Float32Array, width: number, height: number): bigint {
  const sample = (gx: number, gy: number) => {
    const x0 = Math.floor((gx / 9) * width);
    const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) / 9) * width));
    const y0 = Math.floor((gy / 8) * height);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) / 8) * height));
    let s = 0;
    let c = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        s += gray[y * width + x] ?? 0;
        c++;
      }
    return c ? s / c : 0;
  };
  let hash = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) hash = (hash << 1n) | (sample(x, y) > sample(x + 1, y) ? 1n : 0n);
  return hash;
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Near-duplicates: at most this many of 64 hash bits differ… */
export const DUPLICATE_BITS = 6;
/** …and the average colours are this close (RGB distance) — the hash only sees brightness. */
export const DUPLICATE_COLOUR = 40;

const colourDistance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Facts for the plan (and the AI server) from measured pixels. */
export function toFacts(measured: (PixelFacts & { width: number; height: number; palette: string[] })[]): PhotoFacts[] {
  return measured.map((m, index) => {
    const dup = measured.findIndex(
      (o, j) => j < index && hamming(o.hash, m.hash) <= DUPLICATE_BITS && colourDistance(o.mean, m.mean) <= DUPLICATE_COLOUR,
    );
    return {
      index,
      width: Math.max(1, Math.round(m.width)),
      height: Math.max(1, Math.round(m.height)),
      brightness: round(m.brightness),
      saturation: round(m.saturation),
      warmth: round(m.warmth),
      sharpness: round(m.sharpness),
      palette: m.palette.slice(0, 5),
      ...(dup >= 0 ? { duplicateOf: dup } : {}),
    };
  });
}

const round = (v: number) => Math.round(v * 1000) / 1000;

function coverScore(p: PhotoFacts): number {
  const exposure = 1 - Math.min(1, Math.abs(p.brightness - 0.55) * 2);
  return p.sharpness * 0.5 + p.saturation * 0.3 + exposure * 0.2;
}

/** Colour position of a photo for ordering: its palette's lead colour, else its tone. */
function tone(p: PhotoFacts): [number, number, number] {
  return [p.warmth, p.brightness, p.saturation];
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, (a[2]! - b[2]!) * 0.7);

interface StyleChoice {
  id: string;
  title: string;
  why: string;
}

/** A style for the whole set, from its mood. Only styles offered in `styles` are chosen. */
function chooseStyle(photos: PhotoFacts[], styles: LayoutRequest['styles']): StyleChoice {
  const avg = (f: (p: PhotoFacts) => number) => photos.reduce((n, p) => n + f(p), 0) / photos.length;
  const brightness = avg((p) => p.brightness);
  const saturation = avg((p) => p.saturation);
  const warmth = avg((p) => p.warmth);
  const spread = Math.sqrt(avg((p) => (p.saturation - saturation) ** 2 + (p.brightness - brightness) ** 2));
  const has = (id: string) => styles.some((s) => s.id === id);
  const candidates: StyleChoice[] = [];
  if (brightness < 0.32) candidates.push({ id: 'night-out', title: 'after dark', why: 'mostly low-light photos' });
  if (warmth > 0.12 && saturation > 0.35)
    candidates.push({ id: 'vacation', title: 'golden hours', why: 'warm, colourful photos' });
  if (saturation < 0.18) candidates.push({ id: 'minimal', title: 'quiet frames', why: 'soft, muted colours' });
  if (brightness < 0.5 && saturation < 0.35)
    candidates.push({ id: 'cinematic', title: 'scenes from a week', why: 'moody, low-saturation tones' });
  if (spread > 0.22 || photos.length >= 12)
    candidates.push({ id: 'chaotic', title: 'photo dump', why: 'lots of variety between photos' });
  if (brightness > 0.62 && saturation < 0.3) candidates.push({ id: 'aesthetic', title: 'soft days', why: 'bright, airy photos' });
  candidates.push({ id: 'clean', title: 'recent favourites', why: 'a balanced mix of photos' });
  return candidates.find((c) => has(c.id)) ?? { id: styles[0]!.id, title: 'photo dump', why: 'your photos' };
}

export function planCarousel(request: LayoutRequest): LayoutPlan {
  const photos = request.photos;
  const unique = photos.filter((p) => p.duplicateOf === undefined);
  const skipped = photos.length - unique.length;
  const pool = unique.length ? unique : photos;
  const cover = pool.reduce((best, p) => (coverScore(p) > coverScore(best) ? p : best), pool[0]!);

  // Greedy colour chain from the cover: always the closest remaining photo next.
  const order: number[] = [cover.index];
  const left = pool.filter((p) => p.index !== cover.index);
  let current = cover;
  while (left.length) {
    let bestI = 0;
    for (let i = 1; i < left.length; i++)
      if (dist(tone(left[i]!), tone(current)) < dist(tone(left[bestI]!), tone(current))) bestI = i;
    current = left.splice(bestI, 1)[0]!;
    order.push(current.index);
  }

  const style = chooseStyle(pool, request.styles);
  const styleName = request.styles.find((s) => s.id === style.id)?.name ?? style.id;
  const reason = [
    `${styleName} because of ${style.why}`,
    `cover: photo ${cover.index + 1} (sharpest and best exposed)`,
    'ordered so colours flow from slide to slide',
    ...(skipped ? [`${skipped} near-duplicate${skipped === 1 ? '' : 's'} left out`] : []),
  ].join('; ');
  return { order, cover: cover.index, styleId: style.id, title: style.title, reason: `${reason}.`.slice(0, 240) };
}

/** Checks a plan (e.g. from the AI server) against the photos it's for; null if it doesn't fit. */
export function validPlan(plan: LayoutPlan, request: LayoutRequest): LayoutPlan | null {
  const indices = new Set(request.photos.map((p) => p.index));
  const order = plan.order.filter((i, k, all) => indices.has(i) && all.indexOf(i) === k);
  if (order.length === 0 || !indices.has(plan.cover) || !request.styles.some((s) => s.id === plan.styleId)) return null;
  return {
    ...plan,
    order: order.includes(plan.cover) ? [plan.cover, ...order.filter((i) => i !== plan.cover)] : [plan.cover, ...order],
  };
}

/* ───────────── In the browser ───────────── */

/** Measures a drawable (a photo thumbnail) at 64 px. */
export function measureImage(image: CanvasImageSource & { width: number; height: number }): PixelFacts | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const scale = size / Math.max(image.width, image.height);
  const w = Math.max(8, Math.round(image.width * scale));
  const h = Math.max(8, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);
  return analyzePixels(ctx.getImageData(0, 0, w, h).data, w, h);
}

export const meanHex = (f: PixelFacts) => toHex({ r: f.mean[0], g: f.mean[1], b: f.mean[2], a: 1 }).toUpperCase();
