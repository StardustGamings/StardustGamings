import type { DesignDocument, ImageElement } from '@/types/document';
import type { ImageResolver, ResolvedImage } from '@/canvas/render/types';
import { ensureAssets, markAssetsChanged, peekAsset, type LoadedAsset } from '@/assets/cache';
import { documentAssetIds } from '@/assets/repository';
import { THUMB_MAX, type AssetVariant } from '@/assets/types';
import { clipTime } from '@/animations/sequence';
import { liveFrame, setVideoFrameListener } from '@/assets/video';
import { needsDevelop } from './adjustments';
import { developFrame, developImage } from './develop';

// New video frames (seeks finishing, playback advancing) redraw whatever shows them.
setVideoFrameListener(markAssetsChanged);

/** Whether videos are playing in real time (vs. being scrubbed or shown at rest). */
let livePlayback = false;
export function setLivePlayback(on: boolean): void {
  livePlayback = on;
}

const frameCanvases = new Map<string, HTMLCanvasElement>();

/** Copies a video frame into a canvas (the GPU develop pass wants a sized source). */
function frameCanvas(id: string, video: HTMLVideoElement, width: number, height: number): HTMLCanvasElement {
  let c = frameCanvases.get(id);
  if (!c) {
    c = document.createElement('canvas');
    frameCanvases.set(id, c);
    if (frameCanvases.size > 8) frameCanvases.delete(frameCanvases.keys().next().value!);
  }
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  c.getContext('2d')!.drawImage(video, 0, 0, width, height);
  return c;
}

/**
 * A video frame for the moment being drawn: the clip's frame at `time` while
 * motion plays, or its first (trimmed) frame at rest. Null until decoded.
 */
function videoFrame(el: ImageElement, time: number | undefined): ResolvedImage | null {
  if (!el.video || !el.assetId || typeof document === 'undefined') return null;
  const moving = time !== undefined && Number.isFinite(time);
  const seconds = moving ? clipTime(el.video, time) : el.video.trimStart;
  const video = liveFrame(el, seconds, livePlayback && moving);
  if (!video || !video.videoWidth) return null;
  const poster = peekAsset(el.assetId, 'preview', { load: false });
  const width = poster?.meta.width ?? video.videoWidth;
  const height = poster?.meta.height ?? video.videoHeight;
  let source: ResolvedImage['source'] = video as unknown as ResolvedImage['source'];
  if (needsDevelop(el) && el.id !== compareId) {
    const w = poster?.image.width ?? Math.min(video.videoWidth, 1280);
    const h = poster?.image.height ?? Math.round((w * video.videoHeight) / video.videoWidth);
    const developed = developFrame(el, frameCanvas(el.id, video, w, h), w, h);
    if (developed) source = developed;
  }
  return { source, width, height, alpha: false };
}

/**
 * The app's image resolver: picks a resolution for the on-screen size, loads it
 * from the local asset store and runs the develop pipeline when the element has
 * adjustments or a cut-out.
 */
export const resolveImage: ImageResolver = (
  el: ImageElement,
  pixelScale: number,
  time?: number,
): ResolvedImage | null | undefined => {
  if (!el.assetId) return null;
  if (el.video) {
    const frame = videoFrame(el, time);
    if (frame) return frame;
    // Not decoded yet: the poster frame stands in.
  }
  const needed = Math.max(el.width, el.height) * pixelScale * Math.max(1, el.zoom ?? 1);
  let variant: AssetVariant = needed <= THUMB_MAX * 0.75 ? 'thumb' : 'preview';
  let base: LoadedAsset | null | undefined = peekAsset(el.assetId, variant);
  if (base === undefined && variant === 'thumb') {
    // Use the bigger version if it's already in memory rather than flashing a placeholder.
    const preview = peekAsset(el.assetId, 'preview', { load: false });
    if (preview) {
      base = preview;
      variant = 'preview';
    }
  }
  if (!base) return base;

  let source = base.image;
  let alpha = base.meta.hasAlpha;
  if (needsDevelop(el) && el.id !== compareId) {
    const mask = el.cutout ? (peekAsset(el.cutout.maskAssetId, 'preview') ?? null) : null;
    const bd = el.cutout?.backdrop;
    const backdrop = bd?.type === 'image' ? (peekAsset(bd.assetId, 'preview') ?? null) : null;
    const developed = developImage(el, variant, base, mask, backdrop);
    if (developed) {
      source = developed.image;
      alpha = alpha || developed.alpha;
    }
  }
  return { source, width: base.meta.width, height: base.meta.height, alpha };
};

/** Preloads every photo a document uses; resolves `true` if new pixels became available. */
export function ensureDocumentAssets(doc: DesignDocument, variant: AssetVariant = 'preview'): Promise<boolean> {
  const ids = documentAssetIds(doc);
  if (ids.size === 0) return Promise.resolve(false);
  return ensureAssets(ids, variant);
}

let compareId: string | null = null;

/** "Hold to compare": show an element's untouched photo while held. */
export function setCompare(id: string | null): void {
  if (compareId === id) return;
  compareId = id;
  markAssetsChanged();
}
