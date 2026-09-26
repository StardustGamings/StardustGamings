import { extractPalette } from './palette';
import { RASTER_MIME, type ImageFormat } from './sniff';
import { ORIGINAL_MAX, PREVIEW_MAX, THUMB_MAX } from './types';

/**
 * Decode → orient → downscale → encode for imported photos. Runs inside a Web
 * Worker (OffscreenCanvas) where supported, otherwise on the main thread with
 * a DOM canvas — the logic is identical either way.
 */

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export interface CanvasFactory {
  create(width: number, height: number): AnyCanvas;
  toBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob | null>;
}

export const offscreenFactory: CanvasFactory = {
  create: (w, h) => new OffscreenCanvas(w, h),
  toBlob: async (canvas, type, quality) => {
    try {
      return await (canvas as OffscreenCanvas).convertToBlob({ type, quality });
    } catch {
      return null;
    }
  },
};

export const domFactory: CanvasFactory = {
  create: (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },
  toBlob: (canvas, type, quality) =>
    new Promise((resolve) => {
      try {
        (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality);
      } catch {
        resolve(null);
      }
    }),
};

export type ImportErrorCode =
  'unsupported' | 'heic' | 'too-large' | 'decode' | 'empty' | 'storage' | 'video-too-long' | 'video-unplayable';

export class ImportError extends Error {
  constructor(readonly code: ImportErrorCode) {
    super(code);
    this.name = 'ImportError';
  }
}

export interface ProcessInput {
  bytes: ArrayBuffer;
  format: Exclude<ImageFormat, 'svg'>;
  /** Keep the imported bytes as the original variant when possible. */
  keepOriginal: boolean;
}

export interface ProcessOutput {
  width: number;
  height: number;
  /** Size before any downscaling. */
  sourceWidth: number;
  sourceHeight: number;
  previewWidth: number;
  previewHeight: number;
  hasAlpha: boolean;
  palette: string[];
  original: Blob;
  originalMime: string;
  preview: Blob;
  thumb: Blob;
  hash: string;
}

const ctx2d = (canvas: AnyCanvas): Ctx => {
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new ImportError('decode');
  return ctx;
};

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type Source = CanvasImageSource & { width: number; height: number };

/** High-quality downscale: halve repeatedly, then one final smooth step (avoids aliasing on big ratios). */
export function drawScaled(factory: CanvasFactory, source: Source, width: number, height: number): AnyCanvas {
  let current: Source = source;
  let cw = source.width;
  let ch = source.height;
  while (cw / 2 >= width && ch / 2 >= height) {
    const nw = Math.max(width, Math.floor(cw / 2));
    const nh = Math.max(height, Math.floor(ch / 2));
    const step = factory.create(nw, nh);
    const c = ctx2d(step);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(current, 0, 0, nw, nh);
    current = step as Source;
    cw = nw;
    ch = nh;
  }
  const out = factory.create(width, height);
  const c = ctx2d(out);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(current, 0, 0, width, height);
  return out;
}

async function encode(factory: CanvasFactory, canvas: AnyCanvas, alpha: boolean, quality: number): Promise<Blob> {
  const webp = await factory.toBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp' && webp.size > 0) return webp;
  const fallback = await factory.toBlob(canvas, alpha ? 'image/png' : 'image/jpeg', quality);
  if (!fallback || fallback.size === 0) throw new ImportError('decode');
  return fallback;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Insecure contexts have no SubtleCrypto; a length-salted FNV-1a is enough for de-duplication.
    const view = new Uint8Array(bytes);
    let h = 2166136261;
    for (let i = 0; i < view.length; i++) {
      h ^= view[i]!;
      h = Math.imul(h, 16777619);
    }
    return `fnv${(h >>> 0).toString(16)}-${view.length}`;
  }
}

export async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(blob);
    } catch {
      throw new ImportError('decode');
    }
  }
}

function anyTransparent(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return true;
  return false;
}

export async function processImage(input: ProcessInput, factory: CanvasFactory): Promise<ProcessOutput> {
  if (input.bytes.byteLength === 0) throw new ImportError('empty');
  const mime = RASTER_MIME[input.format];
  const hash = await sha256Hex(input.bytes);
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeBitmap(new Blob([input.bytes], { type: mime }));
  } catch {
    throw new ImportError(input.format === 'heic' ? 'heic' : 'decode');
  }
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    if (!sourceWidth || !sourceHeight) throw new ImportError('decode');

    const full = fitWithin(sourceWidth, sourceHeight, ORIGINAL_MAX);
    const prev = fitWithin(sourceWidth, sourceHeight, PREVIEW_MAX);
    const th = fitWithin(sourceWidth, sourceHeight, THUMB_MAX);

    const previewCanvas = drawScaled(factory, bitmap, prev.width, prev.height);
    const thumbCanvas = drawScaled(factory, previewCanvas as Source, th.width, th.height);
    const thumbPixels = ctx2d(thumbCanvas).getImageData(0, 0, th.width, th.height).data;
    const hasAlpha = input.format !== 'jpeg' && anyTransparent(thumbPixels);
    const palette = extractPalette(thumbPixels);

    const downscaled = full.width !== sourceWidth || full.height !== sourceHeight;
    const reusable =
      input.keepOriginal && !downscaled && (input.format === 'jpeg' || input.format === 'png' || input.format === 'webp');
    let original: Blob;
    if (reusable) {
      original = new Blob([input.bytes], { type: mime });
    } else {
      const canvas = downscaled
        ? drawScaled(factory, bitmap, full.width, full.height)
        : drawScaled(factory, bitmap, sourceWidth, sourceHeight);
      const encoded = await factory.toBlob(canvas, hasAlpha ? 'image/png' : 'image/jpeg', 0.92);
      if (!encoded) throw new ImportError('decode');
      original = encoded;
    }

    const [preview, thumb] = await Promise.all([
      encode(factory, previewCanvas, hasAlpha, 0.9),
      encode(factory, thumbCanvas, hasAlpha, 0.82),
    ]);

    return {
      width: full.width,
      height: full.height,
      sourceWidth,
      sourceHeight,
      previewWidth: prev.width,
      previewHeight: prev.height,
      hasAlpha,
      palette,
      original,
      originalMime: original.type || mime,
      preview,
      thumb,
      hash,
    };
  } finally {
    bitmap.close();
  }
}
