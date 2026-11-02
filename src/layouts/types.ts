import type { DesignElement, ImageClip, Shadow, Stroke } from '@/types/document';

/** What a layout needs to know about a photo. */
export interface PhotoRef {
  assetId: string;
  width: number;
  height: number;
  /** Dominant colours (from the asset library), used for backgrounds. */
  palette?: string[];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where (and how) one photo sits. */
export interface Slot extends Box {
  rotation: number;
  clip?: ImageClip;
  cornerRadius?: number;
  stroke?: Stroke;
  shadow?: Shadow;
}

export type Layer = { slot: number } | { decor: DesignElement };

export interface LayoutResult {
  /** One slot per photo. */
  slots: Slot[];
  /** `assign[photoIndex]` = slot index the generator picked for that photo. */
  assign: number[];
  /** Paint order, bottom first: photo slots interleaved with decor (polaroid cards, film, tape…). */
  layers: Layer[];
}

export const aspectOf = (p: { width: number; height: number }) => (p.height > 0 ? p.width / p.height : 1);
