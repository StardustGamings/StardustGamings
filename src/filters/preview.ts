'use client';

import type { DrawableImage } from '@/canvas/render/types';
import type { ImageElement } from '@/types/document';
import { effectParams, glowRadius } from '@/effects/effects';
import { blurRadius, pixelParams } from '@/images/adjustments';
import { developPixelsInWorker } from '@/images/develop';
import type { DevelopInput } from '@/images/gl';
import { effectiveAdjust, effectiveEffects, effectiveLut } from './compose';

/**
 * Small previews of a look on a given photo — the filter picker's thumbnails
 * and the trend cards. Same develop maths as the editor, cached per image,
 * look and size.
 */

type Look = Pick<ImageElement, 'adjust' | 'curves' | 'filter' | 'effects'>;

const cache = new Map<string, HTMLCanvasElement>();
const pending = new Map<string, Promise<HTMLCanvasElement | null>>();
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

const small = new WeakMap<object, Map<number, HTMLCanvasElement>>();

/**
 * The photo scaled to fit `size` (long side) — previews are rendered from this.
 * Made once per photo and size: every look's thumbnail shares it, so a big
 * photo is only scaled down once, not once per look.
 */
function downscale(image: DrawableImage, size: number): HTMLCanvasElement {
  let sizes = small.get(image);
  const hit = sizes?.get(size);
  if (hit) return hit;
  const s = Math.min(1, size / Math.max(image.width, image.height));
  const c = canvas(Math.max(1, Math.round(image.width * s)), Math.max(1, Math.round(image.height * s)));
  // Read back with getImageData for the develop worker.
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, c.width, c.height);
  if (!sizes) small.set(image, (sizes = new Map()));
  sizes.set(size, c);
  return c;
}

/**
 * The look applied to `image`, fitted to `size`. Rendered by the CPU pipeline in
 * the develop worker (the same maths as the GPU path), so a panel of 15+ looks
 * costs the page almost nothing. Cached per image, look and size.
 */
export function lookPreview(image: DrawableImage, look: Look, size = 160): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const key = `${identity(image)}|${JSON.stringify([look.filter ?? null, look.effects ?? null, look.adjust ?? null])}|${size}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(key);
  if (running) return running;

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
  const job = developPixelsInWorker(input)
    .then((pixels) => {
      const out = canvas(pixels.width, pixels.height);
      out.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
      cache.set(key, out);
      if (cache.size > 160) cache.delete(cache.keys().next().value!);
      return out;
    })
    .catch(() => null)
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
