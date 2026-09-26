import type { DesignDocument, ImageElement } from '@/types/document';
import type { ImageResolver, ResolvedImage } from '@/canvas/render/types';
import { ensureAssets, markAssetsChanged, peekAsset, type LoadedAsset } from '@/assets/cache';
import { documentAssetIds } from '@/assets/repository';
import { THUMB_MAX, type AssetVariant } from '@/assets/types';
import { needsDevelop } from './adjustments';
import { developImage } from './develop';

/**
 * The app's image resolver: picks a resolution for the on-screen size, loads it
 * from the local asset store and runs the develop pipeline when the element has
 * adjustments or a cut-out.
 */
export const resolveImage: ImageResolver = (el: ImageElement, pixelScale: number): ResolvedImage | null | undefined => {
  if (!el.assetId) return null;
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
