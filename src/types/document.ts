/**
 * The Stardeck document model.
 *
 * A design is a single continuous "strip": `slides.length` artboards of
 * `slideWidth × slideHeight` laid out left-to-right. Elements live in strip
 * coordinates, so an element may straddle a slide boundary — this is what makes
 * seamless carousels (panoramas that continue across swipes) a first-class
 * feature instead of a special case. Single-page formats simply have one slide.
 */

import type { DesignMotion, ElementAnimation, VideoClip } from './animation';

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
  /** Elements sharing a groupId select, move and transform together. */
  groupId?: Id;
  /** Membership in a generated layout (collage / seamless panorama) that can be re-generated. */
  layout?: LayoutMembership;
  /** Entrance, exit and loop motion (videos and GIFs; stills show the resting state). */
  animation?: ElementAnimation;
}

export interface LayoutMembership {
  /** `DesignDocument.layouts[].id`. */
  id: Id;
  /** Photos are re-arranged when the layout is shuffled; decor (frames, tape, stickers) is re-created. */
  role: 'photo' | 'decor';
  /** Locked photos keep their spot when the layout is shuffled or restyled. */
  locked?: boolean;
  /** Photo order within the layout (kept stable so regenerating is repeatable). */
  index?: number;
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

/**
 * Non-destructive photo adjustments. Every value is optional and 0 means
 * "untouched"; bipolar sliders run -100..100, one-sided ones 0..100.
 */
export interface ImageAdjustments {
  exposure?: number;
  brightness?: number;
  contrast?: number;
  highlights?: number;
  shadows?: number;
  temperature?: number;
  tint?: number;
  saturation?: number;
  vibrance?: number;
  /** 0..100 — lifts the blacks for a matte, faded-film look. */
  fade?: number;
  /** -100..100 — negative values brighten the edges instead. */
  vignette?: number;
  grain?: number;
  sharpness?: number;
  blur?: number;
}

export interface CurvePoint {
  /** Input level 0..1. */
  x: number;
  /** Output level 0..1. */
  y: number;
}

/** Tone curves: `rgb` applies to all channels, then the per-channel curves. */
export interface ImageCurves {
  rgb?: CurvePoint[];
  r?: CurvePoint[];
  g?: CurvePoint[];
  b?: CurvePoint[];
}

/** Keystone correction, -100..100 per axis. */
export interface ImagePerspective {
  vertical: number;
  horizontal: number;
}

/** What shows behind a cut-out subject. */
export type CutoutBackdrop =
  | { type: 'none' }
  | { type: 'fill'; fill: Fill }
  /** The original photo, blurred — a "portrait mode" look. `amount` 0..100. */
  | { type: 'blur'; amount: number }
  | { type: 'image'; assetId: Id };

/** Background removal result: a grayscale mask asset plus how to composite it. */
export interface Cutout {
  maskAssetId: Id;
  /** Edge softness 0..100. */
  feather: number;
  backdrop: CutoutBackdrop;
  /** Provider that produced the mask (informational). */
  method?: string;
}

export type ImageClip = 'rect' | 'ellipse' | 'arch' | 'heart' | 'star' | 'hexagon';

/** A look that isn't built into the app (from a trend pack): its full recipe, carried with the photo. */
export interface CustomLook {
  name: string;
  adjust: ImageAdjustments;
  curves?: ImageCurves;
  effects?: ImageEffects;
}

/** A one-tap look (see src/filters/looks.ts), blended over the photo's own edits by `intensity` (0..100). */
export interface ImageFilter {
  id: string;
  intensity: number;
  /**
   * Set for looks from a trend pack: the recipe travels with the design, so it
   * renders the same offline, after the pack is gone, and on other devices.
   */
  look?: CustomLook;
}

export type LeakStyle = 'amber' | 'rose' | 'prism' | 'ice';

/** Creative effects on top of the adjustments; each 0..100 (0 = off). */
export interface ImageEffects {
  /** Soft bloom around bright areas. */
  glow?: number;
  /** Light leak washing in from the edges. */
  leak?: number;
  leakStyle?: LeakStyle;
  /** Film dust and scratches. */
  dust?: number;
  /** Chromatic aberration: red and blue drift apart. */
  rgbSplit?: number;
  /** CRT / VHS scanlines. */
  scanlines?: number;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  /** Reference into the local asset store. `null` renders a drop-zone frame. */
  assetId: Id | null;
  fit: 'cover' | 'contain';
  /**
   * Which point of the photo lines up with the same point of the frame, 0..1
   * (like CSS `object-position`). Panning in crop mode moves this.
   */
  focusX?: number;
  focusY?: number;
  /** Extra scale on top of the fit, ≥ 1. */
  zoom?: number;
  /** Fine rotation of the photo inside its frame, -45..45°; it scales up to keep the frame covered. */
  straighten?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Quarter turns (clockwise) applied to the source photo. */
  turns?: 0 | 1 | 2 | 3;
  adjust?: ImageAdjustments;
  curves?: ImageCurves;
  filter?: ImageFilter;
  effects?: ImageEffects;
  perspective?: ImagePerspective;
  cutout?: Cutout;
  /** Frame shape the photo is clipped to. */
  clip?: ImageClip;
  cornerRadius?: number;
  stroke?: Stroke;
  placeholder?: { label?: string; fill: Fill };
  /** Set when the frame holds a video clip (its asset is a video). */
  video?: VideoClip;
}

/** One path of vector sticker art on a 100×100 grid; `'tint'` takes the sticker's recolour. */
export interface StickerArtLayer {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/** Vector sticker art that isn't built into the app (from a trend pack), carried with the design. */
export interface StickerArt {
  name: string;
  defaultTint: string;
  layers: StickerArtLayer[];
}

export interface StickerElement extends ElementBase {
  type: 'sticker';
  /** `emoji:<char>` or `vector:<id>` from the sticker library, or `art:<id>` with its `art` inline. */
  stickerId: string;
  /** Recolour for vector stickers. */
  tint?: string;
  /** The drawing for `art:` stickers. */
  art?: StickerArt;
}

export type DesignElement = TextElement | ShapeElement | ImageElement | StickerElement;
export type ElementType = DesignElement['type'];

export type CollageFamily = 'grid' | 'editorial' | 'bento' | 'scrapbook' | 'polaroid' | 'filmstrip';

/** A collage that fills an area of one slide. */
export interface CollageLayout {
  id: Id;
  kind: 'collage';
  family: CollageFamily;
  seed: number;
  /** 0 (tidy) … 1 (wild): rotation, overlap and size variety. */
  chaos: number;
  /** Space between photos as a fraction of the area's short side (0 … 0.1). */
  gutter: number;
  /** Area filled, relative to the slide the collage sits on (so slide moves don't break it). */
  frame: { x: number; y: number; width: number; height: number };
  /** Scatter stickers and tape (Gen-Z looks). */
  decor?: boolean;
}

/** Photos flowing continuously across several slides — a seamless swipe. */
export interface PanoramaLayout {
  id: Id;
  kind: 'panorama';
  seed: number;
  /** Number of slides the panorama spans. */
  slides: number;
  /** Gap between photos (and at both ends), as a fraction of the slide width (0 … 0.3). */
  spacing: number;
  /** Space above and below, as a fraction of the slide height (0 … 0.35). */
  margin: number;
  align: 'center' | 'top' | 'bottom' | 'stagger';
}

export type LayoutSpec = CollageLayout | PanoramaLayout;

export interface Slide {
  id: Id;
  /** `null` lets the strip-wide background show through. */
  fill: Fill | null;
  /** How long the slide plays in a video, ms (default 3000). */
  duration?: number;
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
  /** Ruler guides (editor-only, never exported). Positions are in strip coordinates. */
  guides?: Guide[];
  /** Generated layouts that can be shuffled or restyled later. */
  layouts?: LayoutSpec[];
  /** Transitions between slides in videos (defaults to a swipe). */
  motion?: DesignMotion;
}

export interface Guide {
  id: Id;
  axis: 'x' | 'y';
  position: number;
}
