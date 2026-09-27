import type { DesignDocument, ImageElement } from '@/types/document';
import { getStorage } from '@/storage/db';
import { createId } from '@/utils/id';
import { createWorkerClient, WorkerCallError, type WorkerClient } from '@/utils/worker-rpc';
import {
  domFactory,
  drawScaled,
  fitWithin,
  ImportError,
  offscreenFactory,
  processImage,
  sha256Hex,
  type AnyCanvas,
  type CanvasFactory,
  type ProcessInput,
  type ProcessOutput,
} from './process-core';
import { cleanFileName, sniffImageFormat } from './sniff';
import { LARGE_IMAGE_EDGE, MAX_FILE_BYTES, THUMB_MAX, type AssetKind, type AssetMeta, type AssetVariant } from './types';

type Processor = (input: ProcessInput) => Promise<ProcessOutput>;

let workerClient: WorkerClient<ProcessInput, ProcessOutput> | null | undefined;

function canUseWorker(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined' &&
    'convertToBlob' in OffscreenCanvas.prototype
  );
}

/** Built by scripts/build-workers.mjs into public/workers/. */
function spawnProcessWorker(): Worker {
  return new Worker('/workers/process.js', { name: 'photo-import' });
}

const defaultProcessor: Processor = async (input) => {
  if (workerClient === undefined) {
    workerClient = canUseWorker() ? createWorkerClient(spawnProcessWorker) : null;
  }
  if (workerClient) {
    try {
      return await workerClient.call(input);
    } catch (err) {
      if (!(err instanceof WorkerCallError)) throw err;
      if (err.code === 'heic' || err.code === 'empty') throw new ImportError(err.code);
      if (err.code !== 'decode') {
        // The worker itself is broken (crashed, blocked by the browser…): stop using it.
        workerClient.terminate();
        workerClient = null;
      }
      // Some browsers expose OffscreenCanvas but can't decode or encode inside workers,
      // so retry on the main thread rather than failing the import.
    }
  }
  return processImage(input, domFactory);
};

let processor: Processor = defaultProcessor;

/** Test hook: replace the decode/encode pipeline (jsdom has no image codecs). */
export function setImageProcessorForTesting(fn: Processor | null): void {
  processor = fn ?? defaultProcessor;
}

/** Rasterises an SVG through an <img> (scripts never run in image context). */
async function rasterizeSvg(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof document === 'undefined') throw new ImportError('unsupported');
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode().catch(() => {
      throw new ImportError('decode');
    });
    const natural = { width: img.naturalWidth || 512, height: img.naturalHeight || 512 };
    const target = fitWithin(natural.width, natural.height, 1024);
    // Small SVGs are rendered up to 1024px so they stay crisp when scaled up.
    const scale = Math.max(1, 1024 / Math.max(natural.width, natural.height));
    const w = Math.round(Math.min(target.width * scale, 2048));
    const h = Math.round(Math.min(target.height * scale, 2048));
    const canvas = domFactory.create(w, h) as HTMLCanvasElement;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const blob = await domFactory.toBlob(canvas, 'image/png');
    if (!blob) throw new ImportError('decode');
    return blob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ImportResult {
  meta: AssetMeta;
  /** The same file was already in the library. */
  reused: boolean;
  /** The photo was larger than the editor needs and was optimised. */
  optimized: boolean;
}

export async function importImageFile(
  file: Blob & { name?: string },
  kind: Exclude<AssetKind, 'mask'> = 'photo',
): Promise<ImportResult> {
  if (file.size === 0) throw new ImportError('empty');
  if (file.size > MAX_FILE_BYTES) throw new ImportError('too-large');
  const format = sniffImageFormat(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
  if (!format) throw new ImportError('unsupported');

  const storage = await getStorage();
  const findExisting = async (hash: string) => (await storage.findAssetByHash(hash)).find((a) => a.kind === kind);
  let out: ProcessOutput;
  let hash: string;
  if (format === 'svg') {
    // SVGs are small: hash the source here, so a re-import is found before rasterising.
    const svg = await file.arrayBuffer();
    hash = await sha256Hex(svg);
    const existing = await findExisting(hash);
    if (existing) return { meta: existing, reused: true, optimized: false };
    out = await processor({ bytes: await rasterizeSvg(svg), format: 'png', keepOriginal: true });
  } else {
    // Photos go to the worker as the file itself: it reads, hashes and scales them, so a
    // big photo is never copied or hashed on the page. A re-import is found by that hash.
    out = await processor({ bytes: file, format, keepOriginal: true });
    hash = out.hash;
    const existing = await findExisting(hash);
    if (existing) return { meta: existing, reused: true, optimized: false };
  }
  const meta: AssetMeta = {
    id: createId('as'),
    kind,
    name: cleanFileName(file.name ?? (kind === 'sticker' ? 'Sticker' : 'Photo')),
    mime: out.originalMime,
    width: out.width,
    height: out.height,
    previewWidth: out.previewWidth,
    previewHeight: out.previewHeight,
    bytes: out.original.size + out.preview.size + out.thumb.size,
    createdAt: Date.now(),
    hash,
    hasAlpha: out.hasAlpha,
    palette: out.palette,
  };
  try {
    await storage.putAsset(meta, { original: out.original, preview: out.preview, thumb: out.thumb });
  } catch {
    throw new ImportError('storage');
  }
  return {
    meta,
    reused: false,
    optimized: Math.max(out.sourceWidth, out.sourceHeight) > LARGE_IMAGE_EDGE || file.size > 15 * 1024 * 1024,
  };
}

/**
 * Stores an image the app generated (e.g. a cut-out mask). Masks are kept as
 * lossless PNG at preview resolution; the same blob serves every variant.
 */
export async function saveGeneratedAsset(kind: AssetKind, canvas: AnyCanvas, name: string): Promise<AssetMeta> {
  const factory: CanvasFactory = typeof OffscreenCanvas !== 'undefined' ? offscreenFactory : domFactory;
  const png = (c: AnyCanvas) =>
    typeof HTMLCanvasElement !== 'undefined' && c instanceof HTMLCanvasElement
      ? domFactory.toBlob(c, 'image/png')
      : offscreenFactory.toBlob(c, 'image/png');
  const preview = await png(canvas);
  if (!preview) throw new ImportError('decode');
  const size = fitWithin(canvas.width, canvas.height, THUMB_MAX);
  const thumb = (await png(drawScaled(factory, canvas, size.width, size.height))) ?? preview;
  const meta: AssetMeta = {
    id: createId('as'),
    kind,
    name,
    mime: 'image/png',
    width: canvas.width,
    height: canvas.height,
    previewWidth: canvas.width,
    previewHeight: canvas.height,
    bytes: preview.size + thumb.size,
    createdAt: Date.now(),
    hash: await sha256Hex(await preview.arrayBuffer()),
    hasAlpha: kind !== 'mask',
    palette: [],
  };
  try {
    await (await getStorage()).putAsset(meta, { original: preview, preview, thumb });
  } catch {
    throw new ImportError('storage');
  }
  return meta;
}

export async function listAssets(): Promise<AssetMeta[]> {
  const all = await (await getStorage()).getAllAssetMeta();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAssetMeta(id: string): Promise<AssetMeta | undefined> {
  return (await getStorage()).getAssetMeta(id);
}

export async function getAssetBlob(id: string, variant: AssetVariant): Promise<Blob | undefined> {
  return (await getStorage()).getAssetBlob(id, variant);
}

export async function deleteAssets(ids: string[]): Promise<void> {
  await (await getStorage()).deleteAssets(ids);
}

/** Every asset id an element depends on (photo, mask, backdrop photo). */
export function elementAssetIds(el: ImageElement): string[] {
  const ids: string[] = [];
  if (el.assetId) ids.push(el.assetId);
  if (el.cutout) {
    ids.push(el.cutout.maskAssetId);
    if (el.cutout.backdrop.type === 'image') ids.push(el.cutout.backdrop.assetId);
  }
  return ids;
}

export function documentAssetIds(doc: DesignDocument): Set<string> {
  const ids = new Set<string>();
  for (const el of doc.elements) {
    if (el.type === 'image') elementAssetIds(el).forEach((id) => ids.add(id));
    else if (el.type === 'text' && el.photoFill) ids.add(el.photoFill.assetId);
  }
  return ids;
}

export const TEMPLATE_USAGE_PREFIX = 'template:';
export const VERSION_USAGE_PREFIX = 'version:';

/**
 * assetId → ids of the projects (including trashed ones) that use it. Saved
 * templates that kept their photos count too, as `template:<id>`, and so do
 * saved versions (`version:<id>`), so restoring one never finds its photos gone.
 */
export async function assetUsage(): Promise<Map<string, string[]>> {
  const storage = await getStorage();
  const [docs, templates, versions] = await Promise.all([
    storage.getAllDocuments(),
    storage.getAllTemplates(),
    storage.getAllVersions(),
  ]);
  const usage = new Map<string, string[]>();
  const sources = [
    ...docs,
    ...templates.map((t) => ({ id: `${TEMPLATE_USAGE_PREFIX}${t.id}`, doc: t.doc })),
    ...versions.map((v) => ({ id: `${VERSION_USAGE_PREFIX}${v.id}`, doc: v.doc })),
  ];
  for (const { id, doc } of sources) {
    for (const assetId of documentAssetIds(doc)) {
      const list = usage.get(assetId) ?? [];
      list.push(id);
      usage.set(assetId, list);
    }
  }
  return usage;
}

/**
 * Deletes assets no project references. User stickers are a library, so they're
 * kept unless `includeStickers` is set. `keep` protects ids still needed in memory
 * (e.g. by the open editor's undo history). Returns the number of bytes freed.
 */
export async function cleanupUnusedAssets(
  options: { includeStickers?: boolean; keep?: Iterable<string>; olderThan?: number } = {},
): Promise<{ count: number; bytes: number }> {
  const [all, usage] = await Promise.all([listAssets(), assetUsage()]);
  const keep = new Set(options.keep ?? []);
  const cutoff = options.olderThan ?? Infinity;
  const unused = all.filter(
    (a) => !usage.has(a.id) && !keep.has(a.id) && a.createdAt < cutoff && (a.kind !== 'sticker' || options.includeStickers),
  );
  await deleteAssets(unused.map((a) => a.id));
  return { count: unused.length, bytes: unused.reduce((sum, a) => sum + a.bytes, 0) };
}

const MESSAGES: Record<ImportError['code'], { title: string; description: string }> = {
  unsupported: {
    title: 'That file isn’t a photo we can open',
    description: 'Try a JPG, PNG, WebP, GIF, AVIF or SVG.',
  },
  heic: {
    title: 'This browser can’t open HEIC photos',
    description: 'Share it as “Most compatible” / JPG from your phone, or open Stardeck in Safari.',
  },
  'too-large': {
    title: 'Oops — that file is over 60 MB',
    description: 'Try a smaller export of the photo.',
  },
  decode: {
    title: 'We couldn’t read that photo',
    description: 'The file may be damaged. Try saving it again as JPG or PNG.',
  },
  empty: { title: 'That file is empty', description: 'Pick another photo.' },
  storage: {
    title: 'Your device is out of space for photos',
    description: 'Free up space in Settings → Storage, then try again.',
  },
  'video-too-long': {
    title: 'That video is a bit long',
    description: 'Designs take clips up to 2 minutes (and 300 MB). Trim it on your phone first, then add it again.',
  },
  'video-unplayable': {
    title: 'This browser can’t play that video',
    description: 'Try an MP4 (H.264) or WebM file — most phones can save or share videos in that format.',
  },
};

export function describeImportError(err: unknown): { title: string; description: string } {
  if (err instanceof ImportError) return MESSAGES[err.code];
  return MESSAGES.decode;
}

export { ImportError };
