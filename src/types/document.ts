/**
 * The Stardeck document model.
 *
 * A design is a single continuous "strip": `slides.length` artboards of
 * `slideWidth × slideHeight` laid out left-to-right. Elements live in strip
 * coordinates, so an element may straddle a slide boundary — this is what makes
 * seamless carousels (panoramas that continue across swipes) a first-class
 * feature instead of a special case. Single-page formats simply have one slide.
 */

export type Id = string;

export interface GradientStop {
  /** 0..1 position along the gradient. */
  offset: number;
  color: string;
}

export type Fill =
  | { type: 'solid'; color: string }
  /** `angle` follows CSS: 0 = bottom→top, 90 = left→right. */
  | { type: 'linear'; angle: number; stops: GradientStop[] }
  /** Centre and radius are relative (0..1) to the filled box. */
  | { type: 'radial'; cx: number; cy: number; radius: number; stops: GradientStop[] };

export interface Stroke {
  color: string;
  width: number;
}

export interface Shadow {
  color: string;
  blur: number;
  x: number;
  y: number;
}

interface ElementBase {
  id: Id;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, around the element centre. */
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  shadow?: Shadow;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fill: Fill;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  /** Multiplier of font size. */
  lineHeight: number;
  /** In em. */
  letterSpacing: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  stroke?: Stroke;
  /** Per-line highlight behind the text (the "caption pill" look). */
  highlight?: { fill: Fill; padding: number; radius: number };
}

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'star' | 'polygon' | 'line' | 'arrow';

export interface ShapeElement extends ElementBase {
  type: 'shape';
  shape: ShapeKind;
  fill: Fill | null;
  stroke?: Stroke;
  cornerRadius?: number;
  /** Star points / polygon sides. */
  points?: number;
  /** Star inner radius ratio (0..1). */
  innerRadius?: number;
  dash?: number[];
}

export interface ImageElement extends ElementBase {
  type: 'image';
  /** Reference into the local asset store. `null` renders a drop-zone frame. */
  assetId: Id | null;
  fit: 'cover' | 'contain';
  /** Focal point used by `cover` cropping, 0..1. */
  focusX?: number;
  focusY?: number;
  cornerRadius?: number;
  stroke?: Stroke;
  placeholder?: { label?: string; fill: Fill };
}

export interface StickerElement extends ElementBase {
  type: 'sticker';
  /** `emoji:<char>` or `vector:<id>` from the sticker library. */
  stickerId: string;
  /** Recolour for vector stickers. */
  tint?: string;
}

export type DesignElement = TextElement | ShapeElement | ImageElement | StickerElement;
export type ElementType = DesignElement['type'];

export interface Slide {
  id: Id;
  /** `null` lets the strip-wide background show through. */
  fill: Fill | null;
}

export interface DesignDocument {
  version: 1;
  slideWidth: number;
  slideHeight: number;
  /** Painted across the whole strip, so gradients flow seamlessly between slides. */
  background: Fill;
  slides: Slide[];
  /** Bottom-most first. */
  elements: DesignElement[];
}
