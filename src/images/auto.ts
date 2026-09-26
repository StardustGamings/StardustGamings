import type { ImageAdjustments } from '@/types/document';
import type { DrawableImage } from '@/canvas/render/types';
import { clamp } from '@/utils/math';

export interface ImageStats {
  mean: number;
  p02: number;
  p10: number;
  p98: number;
  saturation: number;
  red: number;
  blue: number;
}

/** Luminance percentiles, mean saturation and channel balance of RGBA pixels. */
export function imageStats(data: Uint8ClampedArray): ImageStats | null {
  const hist = new Uint32Array(256);
  let n = 0;
  let sum = 0;
  let sat = 0;
  let red = 0;
  let blue = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist[l]!++;
    sum += l;
    sat += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    red += r;
    blue += b;
    n++;
  }
  if (n === 0) return null;
  const pct = (p: number) => {
    const target = n * p;
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i]!;
      if (acc >= target) return i / 255;
    }
    return 1;
  };
  return {
    mean: sum / n / 255,
    p02: pct(0.02),
    p10: pct(0.1),
    p98: pct(0.98),
    saturation: sat / n,
    red: red / n / 255,
    blue: blue / n / 255,
  };
}

/** Gentle, conservative corrections — a starting point people can tweak. */
export function adjustmentsFromStats(s: ImageStats): ImageAdjustments | null {
  const out: ImageAdjustments = {};
  const range = s.p98 - s.p02;
  if (range < 0.85) out.contrast = Math.round(clamp((1 / Math.max(range, 0.2) - 1) * 30, 0, 35));
  const diff = 0.48 - s.mean;
  if (Math.abs(diff) > 0.05) out.exposure = Math.round(clamp(diff * 110, -35, 40));
  if (s.p10 < 0.07) out.shadows = 15;
  if (s.p98 > 0.97) out.highlights = -15;
  if (s.saturation < 0.22) out.vibrance = Math.round(clamp((0.3 - s.saturation) * 120, 8, 30));
  const cast = s.blue - s.red;
  if (Math.abs(cast) > 0.04) out.temperature = Math.round(clamp(cast * 160, -25, 25));
  return Object.values(out).some((v) => v) ? out : null;
}

export function autoAdjustments(image: DrawableImage): ImageAdjustments | null {
  if (typeof document === 'undefined') return null;
  const s = Math.min(1, 128 / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * s));
  const h = Math.max(1, Math.round(image.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);
  const stats = imageStats(ctx.getImageData(0, 0, w, h).data);
  return stats ? adjustmentsFromStats(stats) : null;
}
