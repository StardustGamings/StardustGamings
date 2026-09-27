import type { ImageElement } from '@/types/document';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Something drawable with intrinsic dimensions (HTMLImageElement, ImageBitmap, canvas…). */
export type DrawableImage = CanvasImageSource & { width: number; height: number };

export interface ResolvedImage {
  source: DrawableImage;
  /**
   * Canonical pixel size of the asset. Layout uses this rather than the
   * drawable's own size so switching between thumbnail/preview/original
   * resolutions never shifts the crop.
   */
  width: number;
  height: number;
  /** The drawn pixels may be transparent (PNG sticker, cut-out subject). */
  alpha: boolean;
}

/**
 * Supplies the pixels for an image element. `pixelScale` is device pixels per
 * design unit, so resolvers can pick an appropriate resolution.
 * Returns `undefined` while loading and `null` if the photo is missing.
 * `time` is ms into the element's slide when motion is being played (videos
 * then show the matching frame); omitted for the resting design.
 */
export type ImageResolver = (el: ImageElement, pixelScale: number, time?: number) => ResolvedImage | null | undefined;
