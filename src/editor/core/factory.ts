import type {
  DesignDocument,
  Fill,
  ImageClip,
  ImageElement,
  ShapeElement,
  ShapeKind,
  StickerElement,
  TextElement,
} from '@/types/document';
import type { AssetMeta } from '@/assets/types';
import { fillPrimaryColor } from '@/canvas/render/fill';
import { measureTextWidth } from '@/canvas/render/text';
import { clamp } from '@/utils/math';
import { resolveSticker } from '@/stickers/library';
import { supportedWeight } from '@/typography/fonts';
import { createId } from '@/utils/id';
import { readableOn } from '@/utils/color';
import { fitTextHeight } from './ops';
import type { Point } from './geometry';

/** Colour of the canvas behind a point — used to pick legible default colours. */
export function backgroundColorAt(doc: DesignDocument, p: Point): string {
  const index = Math.max(0, Math.min(doc.slides.length - 1, Math.floor(p.x / doc.slideWidth)));
  const fill = doc.slides[index]?.fill ?? doc.background;
  return fillPrimaryColor(fill);
}

export interface TextPreset {
  id: string;
  name: string;
  /** Short label shown in the preset tile. */
  sample: string;
  /** Size relative to the slide width. */
  scale: number;
  style: Partial<TextElement> & { fontFamily: string };
  /** Uses the preset's own colours instead of adapting to the background. */
  fixedColors?: boolean;
}

const solid = (color: string): Fill => ({ type: 'solid', color });

/** The typography styles from the brief — all built on bundled, offline fonts. */
export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'heading',
    name: 'Heading',
    sample: 'Add a heading',
    scale: 0.085,
    style: { fontFamily: 'Bricolage Grotesque', fontWeight: 800, lineHeight: 1, letterSpacing: -0.03 },
  },
  {
    id: 'subheading',
    name: 'Subheading',
    sample: 'Add a subheading',
    scale: 0.052,
    style: { fontFamily: 'Bricolage Grotesque', fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.01 },
  },
  {
    id: 'body',
    name: 'Body',
    sample: 'Add body text',
    scale: 0.034,
    style: { fontFamily: 'Manrope', fontWeight: 500, lineHeight: 1.35 },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    sample: 'the art of less',
    scale: 0.1,
    style: { fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400, lineHeight: 1, letterSpacing: -0.01 },
  },
  {
    id: 'luxury',
    name: 'Luxury',
    sample: 'The Quiet Edit',
    scale: 0.08,
    fixedColors: true,
    style: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontWeight: 400, lineHeight: 1.05, fill: solid('#C9A96E') },
  },
  {
    id: 'streetwear',
    name: 'Streetwear',
    sample: 'NEW DROP',
    scale: 0.16,
    style: { fontFamily: 'Anton', fontWeight: 400, lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: 0.01 },
  },
  {
    id: 'y2k',
    name: 'Y2K',
    sample: 'SUMMER.EXE',
    scale: 0.1,
    fixedColors: true,
    style: {
      fontFamily: 'Unbounded',
      fontWeight: 900,
      lineHeight: 1,
      textTransform: 'uppercase',
      fill: {
        type: 'linear',
        angle: 180,
        stops: [
          { offset: 0, color: '#FFFFFF' },
          { offset: 0.55, color: '#D9E1FF' },
          { offset: 1, color: '#FF9BE6' },
        ],
      },
      shadow: { color: '#6B1FA8', blur: 0, x: 6, y: 6 },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    sample: 'less, but better',
    scale: 0.05,
    style: { fontFamily: 'Manrope', fontWeight: 500, lineHeight: 1.2, letterSpacing: -0.02 },
  },
  {
    id: 'cyber',
    name: 'Cyber',
    sample: 'SYSTEM_ONLINE',
    scale: 0.07,
    fixedColors: true,
    style: {
      fontFamily: 'Space Grotesk',
      fontWeight: 700,
      lineHeight: 1,
      fill: solid('#3CF0FF'),
      shadow: { color: 'rgba(60,240,255,0.8)', blur: 24, x: 0, y: 0 },
    },
  },
  {
    id: 'meme',
    name: 'Meme',
    sample: 'WHEN THE SLIDE HITS',
    scale: 0.09,
    fixedColors: true,
    style: {
      fontFamily: 'Anton',
      fontWeight: 400,
      lineHeight: 1,
      textTransform: 'uppercase',
      fill: solid('#FFFFFF'),
      stroke: { color: '#000000', width: 6 },
    },
  },
  {
    id: 'magazine',
    name: 'Magazine',
    sample: 'The Issue',
    scale: 0.12,
    style: { fontFamily: 'Playfair Display', fontWeight: 900, lineHeight: 0.95, letterSpacing: -0.02 },
  },
  {
    id: 'newspaper',
    name: 'Newspaper',
    sample: 'The Daily Scroll',
    scale: 0.09,
    style: { fontFamily: 'UnifrakturMaguntia', fontWeight: 400, lineHeight: 1 },
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    sample: 'STATE OF 2026',
    scale: 0.11,
    style: { fontFamily: 'Archivo', fontWeight: 900, lineHeight: 0.9, letterSpacing: -0.04, textTransform: 'uppercase' },
  },
  {
    id: 'futuristic',
    name: 'Futuristic',
    sample: 'NEXT WAVE',
    scale: 0.07,
    style: { fontFamily: 'Syne', fontWeight: 800, lineHeight: 1, letterSpacing: 0.08, textTransform: 'uppercase' },
  },
  {
    id: 'soft',
    name: 'Soft',
    sample: 'slow sunday',
    scale: 0.1,
    style: { fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 400, lineHeight: 0.95, letterSpacing: -0.02 },
  },
  {
    id: 'retro',
    name: 'Retro',
    sample: 'Good Vibes',
    scale: 0.09,
    fixedColors: true,
    style: {
      fontFamily: 'Pacifico',
      fontWeight: 400,
      lineHeight: 1.2,
      fill: solid('#FFD23D'),
      shadow: { color: '#FF3D71', blur: 0, x: 5, y: 5 },
    },
  },
  {
    id: 'caption',
    name: 'Caption pill',
    sample: 'tap for more',
    scale: 0.04,
    fixedColors: true,
    style: {
      fontFamily: 'Manrope',
      fontWeight: 700,
      lineHeight: 1.3,
      fill: solid('#0B0A12'),
      highlight: { fill: solid('#FFFFFF'), padding: 18, radius: 22 },
    },
  },
  {
    id: 'handwritten',
    name: 'Handwritten',
    sample: 'best night ever',
    scale: 0.08,
    style: { fontFamily: 'Caveat', fontWeight: 700, lineHeight: 1 },
  },
];

export function createText(
  doc: DesignDocument,
  center: Point,
  preset: TextPreset = TEXT_PRESETS[0]!,
  text?: string,
): TextElement {
  const fontSize = Math.round(doc.slideWidth * preset.scale);
  const color = readableOn(backgroundColorAt(doc, center), '#0B0A12', '#FFFFFF');
  const base: TextElement = {
    id: createId('el'),
    type: 'text',
    x: 0,
    y: 0,
    width: doc.slideWidth * 0.84,
    height: fontSize,
    rotation: 0,
    opacity: 1,
    text: text ?? preset.sample,
    fontSize,
    fontWeight: 400,
    fontStyle: 'normal',
    fill: solid(color),
    align: 'center',
    verticalAlign: 'top',
    lineHeight: 1.1,
    letterSpacing: 0,
    ...preset.style,
  };
  if (!preset.fixedColors) base.fill = solid(color);
  base.fontWeight = supportedWeight(base.fontFamily, base.fontWeight);
  // Hug the content (one line when it fits) instead of a fixed-width box.
  base.width = Math.round(clamp(measureTextWidth(base) * 1.04 + fontSize * 0.1, doc.slideWidth * 0.2, doc.slideWidth * 0.9));
  if (base.highlight) base.highlight = { ...base.highlight, padding: fontSize * 0.45, radius: fontSize * 0.55 };
  if (base.stroke) base.stroke = { ...base.stroke, width: Math.max(2, fontSize * 0.06) };
  const fitted = fitTextHeight(base);
  return { ...fitted, x: Math.round(center.x - fitted.width / 2), y: Math.round(center.y - fitted.height / 2) };
}

export interface ShapePreset {
  id: string;
  name: string;
  shape: ShapeKind;
  ratio: number;
  props?: Partial<ShapeElement>;
}

export const SHAPE_PRESETS: ShapePreset[] = [
  { id: 'rect', name: 'Rectangle', shape: 'rect', ratio: 1.4 },
  { id: 'rounded', name: 'Rounded', shape: 'rect', ratio: 1.4, props: { cornerRadius: 40 } },
  { id: 'pill', name: 'Pill', shape: 'rect', ratio: 3, props: { cornerRadius: 999 } },
  { id: 'ellipse', name: 'Circle', shape: 'ellipse', ratio: 1 },
  { id: 'triangle', name: 'Triangle', shape: 'triangle', ratio: 1.1 },
  { id: 'star', name: 'Star', shape: 'star', ratio: 1, props: { points: 5, innerRadius: 0.45 } },
  { id: 'burst', name: 'Burst', shape: 'star', ratio: 1, props: { points: 14, innerRadius: 0.78 } },
  { id: 'hexagon', name: 'Hexagon', shape: 'polygon', ratio: 1.12, props: { points: 6 } },
  { id: 'line', name: 'Line', shape: 'line', ratio: 12 },
  { id: 'arrow', name: 'Arrow', shape: 'arrow', ratio: 6 },
];

const SHAPE_COLORS = ['#C6FF3D', '#A06BFF', '#FF5CAA', '#3CF0FF', '#FFD23D'];

export function createShape(doc: DesignDocument, center: Point, preset: ShapePreset = SHAPE_PRESETS[0]!): ShapeElement {
  const bg = backgroundColorAt(doc, center);
  const size = doc.slideWidth * 0.36;
  const width = preset.ratio >= 1 ? size * Math.min(preset.ratio, 2.2) : size;
  const height = preset.ratio >= 1 ? width / preset.ratio : size / preset.ratio;
  const open = preset.shape === 'line' || preset.shape === 'arrow';
  const ink = readableOn(bg, '#0B0A12', '#FFFFFF');
  // Rotate through the accent colours, avoiding one that matches the background.
  const color = SHAPE_COLORS.find((c) => c.toUpperCase() !== bg.toUpperCase()) ?? '#A06BFF';
  const h = open ? Math.max(12, doc.slideWidth * 0.02) : height;
  return {
    id: createId('el'),
    type: 'shape',
    shape: preset.shape,
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - h / 2),
    width: Math.round(width),
    height: Math.round(h),
    rotation: 0,
    opacity: 1,
    fill: open ? null : { type: 'solid', color },
    stroke: open ? { color: ink, width: Math.max(4, doc.slideWidth * 0.008) } : undefined,
    ...preset.props,
  };
}

export function createSticker(
  doc: DesignDocument,
  center: Point,
  stickerId: string,
  size = doc.slideWidth * 0.26,
): StickerElement {
  const resolved = resolveSticker(stickerId);
  return {
    id: createId('el'),
    type: 'sticker',
    stickerId,
    x: Math.round(center.x - size / 2),
    y: Math.round(center.y - size / 2),
    width: Math.round(size),
    height: Math.round(size),
    rotation: 0,
    opacity: 1,
    ...(resolved?.kind === 'vector' ? { tint: resolved.sticker.defaultTint } : {}),
  };
}

export const slideCenter = (doc: DesignDocument, index: number): Point => ({
  x: index * doc.slideWidth + doc.slideWidth / 2,
  y: doc.slideHeight / 2,
});

/* ───────────── Photos & frames ───────────── */

export interface FramePreset {
  id: string;
  name: string;
  /** Width ÷ height. */
  ratio: number;
  clip: ImageClip;
  /** Corner radius as a fraction of the short side (rect frames). */
  radius?: number;
}

export const FRAME_PRESETS: FramePreset[] = [
  { id: 'square', name: 'Square', ratio: 1, clip: 'rect' },
  { id: 'portrait', name: 'Portrait', ratio: 4 / 5, clip: 'rect' },
  { id: 'landscape', name: 'Landscape', ratio: 3 / 2, clip: 'rect' },
  { id: 'tall', name: 'Tall', ratio: 9 / 16, clip: 'rect' },
  { id: 'rounded', name: 'Rounded', ratio: 4 / 5, clip: 'rect', radius: 0.12 },
  { id: 'circle', name: 'Circle', ratio: 1, clip: 'ellipse' },
  { id: 'arch', name: 'Arch', ratio: 3 / 4, clip: 'arch' },
  { id: 'heart', name: 'Heart', ratio: 1.08, clip: 'heart' },
  { id: 'star', name: 'Star', ratio: 1, clip: 'star' },
  { id: 'hexagon', name: 'Hexagon', ratio: 1.12, clip: 'hexagon' },
];

/** Empty frame (drop zone) that photos can be dropped into. */
export function createFrame(doc: DesignDocument, center: Point, preset: FramePreset = FRAME_PRESETS[0]!): ImageElement {
  const size = doc.slideWidth * 0.46;
  const width = preset.ratio >= 1 ? size : size * preset.ratio;
  const height = preset.ratio >= 1 ? size / preset.ratio : size;
  const bg = backgroundColorAt(doc, center);
  const placeholder = readableOn(bg, '#E4E0F0', '#3A3550');
  return {
    id: createId('el'),
    type: 'image',
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - height / 2),
    width: Math.round(width),
    height: Math.round(height),
    rotation: 0,
    opacity: 1,
    assetId: null,
    fit: 'cover',
    clip: preset.clip,
    ...(preset.radius ? { cornerRadius: Math.round(Math.min(width, height) * preset.radius) } : {}),
    placeholder: { fill: solid(placeholder) },
  };
}

const layerName = (name: string) => name.replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 40) || 'Photo';

/** A photo (or user sticker) sized to sit comfortably on a slide, keeping its aspect ratio. */
export function createImage(doc: DesignDocument, center: Point, asset: AssetMeta): ImageElement {
  const sticker = asset.kind === 'sticker';
  const maxW = doc.slideWidth * (sticker ? 0.34 : 0.72);
  const maxH = doc.slideHeight * (sticker ? 0.34 : 0.72);
  const scale = Math.min(maxW / asset.width, maxH / asset.height);
  const width = Math.max(8, asset.width * scale);
  const height = Math.max(8, asset.height * scale);
  return {
    id: createId('el'),
    type: 'image',
    name: sticker ? 'Sticker' : layerName(asset.name),
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - height / 2),
    width: Math.round(width),
    height: Math.round(height),
    rotation: 0,
    opacity: 1,
    assetId: asset.id,
    fit: sticker ? 'contain' : 'cover',
  };
}
