'use client';

import type { DesignDocument, ImageElement } from '@/types/document';
import type { DrawableImage, ImageResolver, Rect, ResolvedImage } from '@/canvas/render/types';
import { elementBounds } from '@/canvas/render/renderer';
import { loadAsset, type LoadedAsset } from '@/assets/cache';
import { getAssetBlob, getAssetMeta } from '@/assets/repository';
import { PREVIEW_MAX } from '@/assets/types';
import { needsDevelop } from '@/images/adjustments';
import { developForExport } from '@/images/develop';
import { VideoFrames } from '@/assets/video';

/** A video's still frame: the first frame of its trimmed clip. */
async function firstFrame(el: ImageElement, maxSize: number): Promise<LoadedAsset | null> {
  const meta = await getAssetMeta(el.assetId!);
  if (!meta || !el.video) return null;
  const frames = new VideoFrames(el.assetId!, maxSize);
  try {
    if (!(await frames.open())) return null;
    const frame = await frames.frame(el.video.trimStart);
    const copy = document.createElement('canvas');
    copy.width = frame.width;
    copy.height = frame.height;
    copy.getContext('2d')!.drawImage(frame, 0, 0);
    return { image: copy, meta };
  } catch {
    return null;
  } finally {
    frames.close();
  }
}

/**
 * Photos for one exported region, fully loaded (and developed) before the
 * synchronous renderer runs. Maximum-quality exports use the original photo
 * wherever the output needs more pixels than the editing preview has; those
 * big decodes bypass the editor's cache and are released right after.
 */

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function release(image: DrawableImage) {
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
  else if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) {
    image.width = 0;
    image.height = 0;
  }
}

async function decodeOriginal(id: string): Promise<LoadedAsset | null> {
  const [meta, blob] = await Promise.all([getAssetMeta(id), getAssetBlob(id, 'original')]);
  if (!meta || !blob) return null;
  try {
    return { image: await createImageBitmap(blob), meta };
  } catch {
    return null;
  }
}

export interface RegionImages {
  resolve: ImageResolver;
  /** Photos that are missing from this device (deleted from the library). */
  missing: number;
  dispose: () => void;
}

export async function prepareRegionImages(
  doc: DesignDocument,
  region: Rect,
  scale: number,
  useOriginals: boolean,
  signal?: AbortSignal,
): Promise<RegionImages> {
  const resolved = new Map<string, ResolvedImage | null>();
  const owned: DrawableImage[] = [];
  let missing = 0;

  const images = doc.elements.filter(
    (e): e is ImageElement => e.type === 'image' && !!e.assetId && !e.hidden && intersects(elementBounds(e), region),
  );
  for (const el of images) {
    signal?.throwIfAborted();
    const needed = Math.max(el.width, el.height) * scale * Math.max(1, el.zoom ?? 1);
    let base: LoadedAsset | null = null;
    if (el.video) {
      base = await firstFrame(el, Math.min(4096, Math.max(PREVIEW_MAX, Math.ceil(needed))));
      if (base) owned.push(base.image);
    } else if (useOriginals && needed > PREVIEW_MAX * 0.9) {
      base = await decodeOriginal(el.assetId!);
      if (base) owned.push(base.image);
    }
    base ??= await loadAsset(el.assetId!, 'preview');
    if (!base) {
      missing++;
      resolved.set(el.id, null);
      continue;
    }
    let source: DrawableImage = base.image;
    let alpha = base.meta.hasAlpha;
    if (needsDevelop(el)) {
      const mask = el.cutout ? await loadAsset(el.cutout.maskAssetId, 'preview') : null;
      const bd = el.cutout?.backdrop;
      const backdrop = bd?.type === 'image' ? await loadAsset(bd.assetId, 'preview') : null;
      const developed = await developForExport(el, base, mask, backdrop);
      if (developed) {
        source = developed.image;
        alpha = alpha || developed.alpha;
        owned.push(developed.image);
      }
    }
    resolved.set(el.id, { source, width: base.meta.width, height: base.meta.height, alpha });
  }

  return {
    resolve: (el) => (resolved.has(el.id) ? resolved.get(el.id)! : null),
    missing,
    dispose: () => owned.forEach(release),
  };
}
