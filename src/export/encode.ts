'use client';

import { createWorkerClient, type WorkerClient } from '@/utils/worker-rpc';
import type { EncodeRequest } from './encode.worker';
import { MIME, type ImageFormat } from './plan';

let client: WorkerClient<EncodeRequest, Blob> | null | undefined;

const workerEncodes = () =>
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  'convertToBlob' in OffscreenCanvas.prototype &&
  typeof createImageBitmap !== 'undefined';

/**
 * Encodes a canvas; rejects if the browser silently fell back to another format (e.g. WebP on
 * older Safari). Big exports are encoded in a worker from a snapshot of the canvas, so reading
 * a 12-megapixel image back and compressing it doesn't freeze the page; where that isn't
 * available (or fails), the canvas encodes itself.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  const type = MIME[format];
  const lossy = format === 'png' ? undefined : quality;
  if (client === undefined)
    client = workerEncodes() ? createWorkerClient(() => new Worker('/workers/encode.js', { name: 'export-encode' })) : null;
  if (client && canvas.width * canvas.height > 1_000_000) {
    try {
      const bitmap = await createImageBitmap(canvas);
      const blob = await client.call({ bitmap, type, quality: lossy }, [bitmap]);
      if (blob.type !== type) throw new Error(`This browser can’t save ${format.toUpperCase()} files.`);
      return blob;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('This browser')) throw error;
      // The worker couldn't do it (no OffscreenCanvas encoder, out of memory…): encode here instead.
      client.terminate();
      client = null;
    }
  }
  return encodeHere(canvas, format, type, lossy);
}

function encodeHere(canvas: HTMLCanvasElement, format: ImageFormat, type: string, quality: number | undefined): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('The browser couldn’t encode this image (it may be too large).'));
          else if (blob.type !== type) reject(new Error(`This browser can’t save ${format.toUpperCase()} files.`));
          else resolve(blob);
        },
        type,
        quality,
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
