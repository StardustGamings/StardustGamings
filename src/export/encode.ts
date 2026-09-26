'use client';

import { MIME, type ImageFormat } from './plan';

/** Encodes a canvas; rejects if the browser silently fell back to another format (e.g. WebP on older Safari). */
export function encodeCanvas(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  const type = MIME[format];
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('The browser couldn’t encode this image (it may be too large).'));
          else if (blob.type !== type) reject(new Error(`This browser can’t save ${format.toUpperCase()} files.`));
          else resolve(blob);
        },
        type,
        format === 'png' ? undefined : quality,
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Encoding failed'));
    }
  });
}

const support = new Map<ImageFormat, Promise<boolean>>();

/** Whether this browser can encode the format (checked once with a 1×1 canvas). */
export function canEncode(format: ImageFormat): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  let hit = support.get(format);
  if (!hit) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    hit = encodeCanvas(c, format, 0.9).then(
      () => true,
      () => false,
    );
    support.set(format, hit);
  }
  return hit;
}
