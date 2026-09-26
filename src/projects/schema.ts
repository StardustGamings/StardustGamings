import { z } from 'zod';
import { isValidColor } from '@/utils/color';
import { FORMATS } from './formats';
import { MAX_SLIDES } from './formats';

/**
 * Runtime validation for anything that crosses a trust boundary: bundled JSON
 * templates, trend packs fetched at runtime, and (later) imported project files.
 */

const finite = z.number().finite();
const coord = finite.min(-100_000).max(100_000);
const size = finite.min(0).max(100_000);
const color = z.string().max(64).refine(isValidColor, 'Invalid colour');

const stop = z.object({ offset: finite.min(0).max(1), color });

export const fillSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color }),
  z.object({ type: z.literal('linear'), angle: finite, stops: z.array(stop).min(1).max(16) }),
  z.object({
    type: z.literal('radial'),
    cx: finite.min(-2).max(3),
    cy: finite.min(-2).max(3),
    radius: finite.min(0).max(5),
    stops: z.array(stop).min(1).max(16),
  }),
]);

const shadow = z.object({ color, blur: size.max(500), x: coord, y: coord });
const stroke = z.object({ color, width: size.max(500) });
/** Font family names are interpolated into CSS font strings, so keep them boring. */
export const fontFamilySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\w\- ]+$/u, 'Invalid font family');

const base = {
  id: z.string().min(1).max(64),
  name: z.string().max(80).optional(),
  x: coord,
  y: coord,
  width: size,
  height: size,
  rotation: finite.min(-3600).max(3600),
  opacity: finite.min(0).max(1),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  shadow: shadow.optional(),
  groupId: z.string().min(1).max(64).optional(),
  layout: z
    .object({
      id: z.string().min(1).max(64),
      role: z.enum(['photo', 'decor']),
      locked: z.boolean().optional(),
      index: finite.min(0).max(10_000).optional(),
    })
    .optional(),
};

const textElement = z.object({
  ...base,
  type: z.literal('text'),
  text: z.string().max(5000),
  fontFamily: fontFamilySchema,
  fontSize: size.min(1).max(2000),
  fontWeight: finite.min(1).max(1000),
  fontStyle: z.enum(['normal', 'italic']),
  fill: fillSchema,
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  lineHeight: finite.min(0.1).max(10),
  letterSpacing: finite.min(-1).max(5),
  textTransform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
  stroke: stroke.optional(),
  highlight: z.object({ fill: fillSchema, padding: size.max(500), radius: size.max(1000) }).optional(),
});

const shapeElement = z.object({
  ...base,
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'triangle', 'star', 'polygon', 'line', 'arrow']),
  fill: fillSchema.nullable(),
  stroke: stroke.optional(),
  cornerRadius: size.optional(),
  points: finite.min(3).max(64).optional(),
  innerRadius: finite.min(0).max(1).optional(),
  dash: z.array(size.max(1000)).max(8).optional(),
});

const assetId = z
  .string()
  .max(64)
  .regex(/^[\w-]+$/u, 'Invalid asset id');
const bipolar = finite.min(-100).max(100).optional();
const unipolar = finite.min(0).max(100).optional();

export const adjustmentsSchema = z.object({
  exposure: bipolar,
  brightness: bipolar,
  contrast: bipolar,
  highlights: bipolar,
  shadows: bipolar,
  temperature: bipolar,
  tint: bipolar,
  saturation: bipolar,
  vibrance: bipolar,
  fade: unipolar,
  vignette: bipolar,
  grain: unipolar,
  sharpness: unipolar,
  blur: unipolar,
});

export const filterSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  intensity: finite.min(0).max(100),
});

export const effectsSchema = z.object({
  glow: unipolar,
  leak: unipolar,
  leakStyle: z.enum(['amber', 'rose', 'prism', 'ice']).optional(),
  dust: unipolar,
  rgbSplit: unipolar,
  scanlines: unipolar,
});

const curve = z
  .array(z.object({ x: finite.min(0).max(1), y: finite.min(0).max(1) }))
  .min(2)
  .max(16)
  .optional();

const backdropSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('fill'), fill: fillSchema }),
  z.object({ type: z.literal('blur'), amount: finite.min(0).max(100) }),
  z.object({ type: z.literal('image'), assetId }),
]);

const imageElement = z.object({
  ...base,
  type: z.literal('image'),
  assetId: assetId.nullable(),
  fit: z.enum(['cover', 'contain']),
  focusX: finite.min(0).max(1).optional(),
  focusY: finite.min(0).max(1).optional(),
  zoom: finite.min(1).max(20).optional(),
  straighten: finite.min(-45).max(45).optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  turns: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  adjust: adjustmentsSchema.optional(),
  curves: z.object({ rgb: curve, r: curve, g: curve, b: curve }).optional(),
  filter: filterSchema.optional(),
  effects: effectsSchema.optional(),
  perspective: z.object({ vertical: finite.min(-100).max(100), horizontal: finite.min(-100).max(100) }).optional(),
  cutout: z
    .object({
      maskAssetId: assetId,
      feather: finite.min(0).max(100),
      backdrop: backdropSchema,
      method: z.string().max(32).optional(),
    })
    .optional(),
  clip: z.enum(['rect', 'ellipse', 'arch', 'heart', 'star', 'hexagon']).optional(),
  cornerRadius: size.optional(),
  stroke: stroke.optional(),
  placeholder: z.object({ label: z.string().max(80).optional(), fill: fillSchema }).optional(),
});

const stickerElement = z.object({
  ...base,
  type: z.literal('sticker'),
  stickerId: z
    .string()
    .max(64)
    .regex(/^(vector:[a-z0-9-]+|emoji:.{1,16})$/u),
  tint: color.optional(),
});

const layoutSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1).max(64),
    kind: z.literal('collage'),
    family: z.enum(['grid', 'editorial', 'bento', 'scrapbook', 'polaroid', 'filmstrip']),
    seed: finite.min(0).max(2 ** 32),
    chaos: finite.min(0).max(1),
    gutter: finite.min(0).max(0.1),
    frame: z.object({ x: coord, y: coord, width: size, height: size }),
    decor: z.boolean().optional(),
  }),
  z.object({
    id: z.string().min(1).max(64),
    kind: z.literal('panorama'),
    seed: finite.min(0).max(2 ** 32),
    slides: finite.min(1).max(MAX_SLIDES),
    spacing: finite.min(0).max(0.3),
    margin: finite.min(0).max(0.35),
    align: z.enum(['center', 'top', 'bottom', 'stagger']),
  }),
]);

export const elementSchema = z.discriminatedUnion('type', [textElement, shapeElement, imageElement, stickerElement]);

export const documentSchema = z.object({
  version: z.literal(1),
  slideWidth: size.min(16).max(8000),
  slideHeight: size.min(16).max(8000),
  background: fillSchema,
  slides: z
    .array(z.object({ id: z.string().min(1).max(64), fill: fillSchema.nullable() }))
    .min(1)
    .max(MAX_SLIDES),
  elements: z.array(elementSchema).max(2000),
  guides: z
    .array(z.object({ id: z.string().min(1).max(64), axis: z.enum(['x', 'y']), position: coord }))
    .max(200)
    .optional(),
  layouts: z.array(layoutSchema).max(200).optional(),
});

const formatIds = Object.keys(FORMATS) as [keyof typeof FORMATS, ...(keyof typeof FORMATS)[]];
export const formatSchema = z.enum(formatIds);
export const sizeIdSchema = z.enum([
  'ig-portrait',
  'ig-square',
  'ig-landscape',
  'story',
  'tiktok',
  'yt-thumbnail',
  'pinterest',
  'poster',
  'moodboard',
  'custom',
]);
