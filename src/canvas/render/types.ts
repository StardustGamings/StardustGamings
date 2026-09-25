export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Something drawable with intrinsic dimensions (HTMLImageElement, ImageBitmap, canvas…). */
export type DrawableImage = CanvasImageSource & { width: number; height: number };

export type ImageResolver = (assetId: string) => DrawableImage | null | undefined;
