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

const imageElement = z.object({
  ...base,
  type: z.literal('image'),
  assetId: z.string().max(64).nullable(),
  fit: z.enum(['cover', 'contain']),
  focusX: finite.min(0).max(1).optional(),
  focusY: finite.min(0).max(1).optional(),
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
