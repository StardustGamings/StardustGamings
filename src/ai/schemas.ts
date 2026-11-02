import * as z from 'zod';
import { fillSchema, fontFamilySchema } from '@/projects/schema';
import { isValidColor } from '@/utils/color';

/**
 * Requests and results of the AI tools, shared by the on-device versions, the
 * browser client and the optional AI server. Everything the server returns is
 * validated against these before it touches a design — model output is data,
 * never trusted as-is.
 */

const color = z.string().max(16).refine(isValidColor, 'Invalid colour');
const unit = z.number().min(0).max(1);

export const CAPTION_TONES = ['casual', 'hype', 'minimal', 'witty', 'aesthetic', 'professional'] as const;
export type CaptionTone = (typeof CAPTION_TONES)[number];

export const captionRequestSchema = z.object({
  /** The design's text, headline first. */
  texts: z.array(z.string().max(300)).max(40),
  format: z.string().max(24),
  slides: z.number().int().min(1).max(30),
  tone: z.enum(CAPTION_TONES),
  /** Colour mood of the design, e.g. "warm · vivid". */
  mood: z.string().max(40).optional(),
});
export type CaptionRequest = z.infer<typeof captionRequestSchema>;

export const hashtagSchema = z.string().regex(/^#[\p{L}\p{N}_]{1,40}$/u);

export const captionResultSchema = z.object({
  captions: z
    .array(z.object({ text: z.string().min(1).max(2200), hashtags: z.array(hashtagSchema).max(30) }))
    .min(1)
    .max(6),
});
export type CaptionResult = z.infer<typeof captionResultSchema>;

export const fontRequestSchema = z.object({
  headline: z.string().max(120).optional(),
  /** The headline's current font, to pair with. */
  current: fontFamilySchema.optional(),
  vibe: z.string().max(40).optional(),
});
export type FontRequest = z.infer<typeof fontRequestSchema>;

export const fontPairingSchema = z.object({
  heading: fontFamilySchema,
  body: fontFamilySchema,
  headingWeight: z.number().int().min(100).max(1000),
  bodyWeight: z.number().int().min(100).max(1000),
  reason: z.string().min(1).max(200),
});
export type FontPairing = z.infer<typeof fontPairingSchema>;

export const fontResultSchema = z.object({ pairings: z.array(fontPairingSchema).min(1).max(6) });
export type FontResult = z.infer<typeof fontResultSchema>;

/** A decorative shape of a background concept, in fractions of the slide (so it fits any size). */
export const conceptShapeSchema = z.object({
  shape: z.enum(['ellipse', 'rect', 'star', 'polygon']),
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
  w: z.number().min(0.01).max(3),
  h: z.number().min(0.01).max(3),
  rotation: z.number().min(-180).max(180),
  opacity: unit,
  fill: fillSchema,
  /** Corner radius as a fraction of the shorter side (rects). */
  radius: unit.optional(),
  points: z.number().int().min(3).max(24).optional(),
});
export type ConceptShape = z.infer<typeof conceptShapeSchema>;

export const backgroundConceptSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(160),
  fill: fillSchema,
  shapes: z.array(conceptShapeSchema).max(8),
});
export type BackgroundConcept = z.infer<typeof backgroundConceptSchema>;

export const backgroundRequestSchema = z.object({
  palette: z.array(color).min(1).max(8),
  vibe: z.string().max(40).optional(),
  /** Slide aspect ratio (width / height). */
  aspect: z.number().min(0.2).max(5),
});
export type BackgroundRequest = z.infer<typeof backgroundRequestSchema>;

export const backgroundResultSchema = z.object({ concepts: z.array(backgroundConceptSchema).min(1).max(6) });
export type BackgroundResult = z.infer<typeof backgroundResultSchema>;

/** What the layout tool knows about a photo — measured on the device; the photo itself never leaves it. */
export const photoFactsSchema = z.object({
  index: z.number().int().min(0).max(49),
  width: z.number().int().min(1).max(100_000),
  height: z.number().int().min(1).max(100_000),
  brightness: unit,
  saturation: unit,
  /** -1 (cool) … 1 (warm). */
  warmth: z.number().min(-1).max(1),
  sharpness: unit,
  palette: z.array(color).max(5),
  /** Index of an earlier photo this one nearly duplicates. */
  duplicateOf: z.number().int().min(0).max(49).optional(),
});
export type PhotoFacts = z.infer<typeof photoFactsSchema>;

export const layoutRequestSchema = z.object({
  photos: z.array(photoFactsSchema).min(1).max(30),
  styles: z
    .array(z.object({ id: z.string().max(48), name: z.string().max(40), blurb: z.string().max(160) }))
    .min(1)
    .max(30),
});
export type LayoutRequest = z.infer<typeof layoutRequestSchema>;

export const layoutPlanSchema = z.object({
  /** Photo indices in carousel order (duplicates left out). */
  order: z.array(z.number().int().min(0).max(49)).min(1).max(30),
  cover: z.number().int().min(0).max(49),
  styleId: z.string().max(48),
  title: z.string().min(1).max(40),
  reason: z.string().max(240),
});
export type LayoutPlan = z.infer<typeof layoutPlanSchema>;

export const AI_TASKS = {
  caption: { request: captionRequestSchema, result: captionResultSchema },
  fonts: { request: fontRequestSchema, result: fontResultSchema },
  background: { request: backgroundRequestSchema, result: backgroundResultSchema },
  layout: { request: layoutRequestSchema, result: layoutPlanSchema },
} as const;
export type AiTask = keyof typeof AI_TASKS;
export type AiRequest<T extends AiTask> = z.infer<(typeof AI_TASKS)[T]['request']>;
export type AiResult<T extends AiTask> = z.infer<(typeof AI_TASKS)[T]['result']>;
