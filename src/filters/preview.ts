'use client';

import type { DrawableImage } from '@/canvas/render/types';
import type { ImageElement } from '@/types/document';
import { effectParams, glowRadius } from '@/effects/effects';
import { blurRadius, pixelParams } from '@/images/adjustments';
import { developCpu } from '@/images/develop-cpu';
import { glProcessor, type DevelopInput } from '@/images/gl';
import { effectiveAdjust, effectiveEffects, effectiveLut } from './compose';

/**
 * Small previews of a look on a given photo — the filter picker's thumbnails
 * and the trend cards. Same develop pipeline as the editor (GPU, or the CPU
 * maths synchronously — previews are tiny), cached per image, look and size.
 */

type Look = Pick<ImageElement, 'adjust' | 'curves' | 'filter' | 'effects'>;

const cache = new Map<string, HTMLCanvasElement>();
const ids = new WeakMap<object, number>();
let nextId = 1;
const identity = (o: object) => {
  let v = ids.get(o);
  if (!v) {
    v = nextId++;
    ids.set(o, v);
  }
  return v;
};

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** The photo scaled to fit `size` (long side) — previews are rendered from this. */
function downscale(image: DrawableImage, size: number): HTMLCanvasElement {
  const s = Math.min(1, size / Math.max(image.width, image.height));
  const c = canvas(Math.max(1, Math.round(image.width * s)), Math.max(1, Math.round(image.height * s)));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c;
}

export function renderLookPreview(image: DrawableImage, look: Look, size = 160): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${identity(image)}|${JSON.stringify([look.filter ?? null, look.effects ?? null, look.adjust ?? null])}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const src = downscale(image, size);
  const { width, height } = src;
  const maxDim = Math.max(width, height);
  const a = effectiveAdjust(look);
  const input: DevelopInput = {
    source: src,
    width,
    height,
    // The whole photo is shown, so the vignette is baked in here.
    params: pixelParams(a),
    lut: effectiveLut(look),
    warp: null,
    sharpen: (a?.sharpness ?? 0) / 100,
    blur: blurRadius(a?.blur ?? 0, maxDim),
    effects: effectParams(effectiveEffects(look)),
    glowRadius: glowRadius(maxDim),
    cutout: null,
  };

  const out = canvas(width, height);
  const ctx = out.getContext('2d')!;
  const gpu = glProcessor()?.develop(input);
  if (gpu) {
    ctx.drawImage(gpu, 0, 0);
  } else {
    const pixels = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height);
    const developed = developCpu({ ...input, cutout: null, source: { data: pixels.data, width, height } });
    ctx.putImageData(new ImageData(new Uint8ClampedArray(developed.data), width, height), 0, 0);
  }
  cache.set(key, out);
  if (cache.size > 160) cache.delete(cache.keys().next().value!);
  return out;
}
