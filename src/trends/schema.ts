import { z } from 'zod';
import { fontFamilySchema } from '@/projects/schema';
import { isValidColor } from '@/utils/color';

const color = z.string().refine(isValidColor, 'Invalid colour');
const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(48);
const heat = z.number().min(0).max(100);
const label = (max = 60) => z.string().min(1).max(max);

const typeSpec = z.object({
  family: fontFamilySchema,
  weight: z.number().min(100).max(1000),
  style: z.enum(['normal', 'italic']).optional(),
  transform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
});

/**
 * A trend pack is plain JSON so new drops can be published by dropping a file
 * into /trends and listing it in /trends/index.json — no app rebuild required.
 * Only safe primitives are accepted: CSS filters are restricted to an allowlist
 * of functions and every string is length-capped.
 */
export const trendPackSchema = z.object({
  version: z.literal(1),
  id: z
    .string()
    .regex(/^[0-9a-z-]+$/)
    .max(32),
  title: label(),
  subtitle: label(200),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accent: z.tuple([color, color]),
  templates: z.array(z.object({ templateId: slug, label: label(), heat })).max(40),
  layouts: z.array(z.object({ id: slug, name: label(), templateId: slug, description: label(200), heat })).max(40),
  typography: z
    .array(z.object({ id: slug, name: label(), vibe: label(24), sample: label(40), heading: typeSpec, body: typeSpec, heat }))
    .max(40),
  palettes: z.array(z.object({ id: slug, name: label(), mood: label(24), colors: z.array(color).min(2).max(8) })).max(40),
  effects: z
    .array(
      z.object({
        id: slug,
        name: label(),
        description: label(200),
        css: z
          .string()
          .max(200)
          .regex(/^((grayscale|sepia|saturate|contrast|brightness|hue-rotate|invert|blur)\(-?[\d.]+(deg|px|%)?\)\s*)+$/),
        overlay: z.enum(['none', 'grain', 'bloom', 'scanlines', 'leak', 'vignette', 'fade']),
        heat,
      }),
    )
    .max(40),
  stickers: z
    .array(
      z
        .string()
        .max(64)
        .regex(/^(vector:[a-z0-9-]+|emoji:.{1,16})$/u),
    )
    .max(60),
  formats: z.array(z.object({ id: slug, name: label(), kind: label(24), description: label(200), templateId: slug })).max(40),
});

export const trendIndexSchema = z.object({
  version: z.literal(1),
  packs: z
    .array(z.object({ id: z.string().max(32), path: z.string().regex(/^\/trends\/[\w/-]+\.json$/) }))
    .min(1)
    .max(24),
});

export type TrendPack = z.infer<typeof trendPackSchema>;
export type TrendTypography = TrendPack['typography'][number];
export type TrendPalette = TrendPack['palettes'][number];
export type TrendEffect = TrendPack['effects'][number];
