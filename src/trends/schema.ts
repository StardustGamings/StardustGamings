import { z } from 'zod';
import {
  adjustmentsSchema,
  curvesSchema,
  effectsSchema,
  fillSchema,
  fontFamilySchema,
  stickerArtSchema,
} from '@/projects/schema';
import { isValidColor } from '@/utils/color';

const color = z.string().refine(isValidColor, 'Invalid colour');
const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(48);
const heat = z.number().min(0).max(100);
const label = (max = 60) => z.string().min(1).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A sticker from the built-in library (`vector:` / `emoji:`) or from this pack's `stickerArt` (`art:`). */
export const stickerRefSchema = z
  .string()
  .max(64)
  .regex(/^(vector:[a-z0-9-]+|emoji:.{1,16}|art:[a-z0-9-]+)$/u);

const typeSpec = z.object({
  family: fontFamilySchema,
  weight: z.number().min(100).max(1000),
  style: z.enum(['normal', 'italic']).optional(),
  transform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
});

export const COLLAGE_FAMILIES = ['grid', 'editorial', 'bento', 'scrapbook', 'polaroid', 'filmstrip'] as const;
export const FORMAT_CATEGORIES = ['carousel', 'meme', 'social'] as const;
export const MOTION_VIBES = ['smooth', 'playful', 'glitchy'] as const;

/**
 * Layout rules: a photo-dump recipe — backgrounds, photos per slide, collage
 * style, cover, title and caption type, stickers and a photo look. Runs through
 * the same generator as the built-in Smart photo dump styles, on the device.
 */
export const layoutRuleSchema = z.object({
  background: z.union([fillSchema, z.enum(['palette-light', 'palette-dark'])]),
  tintSlides: z.boolean().optional(),
  cover: z.enum(['full-bleed', 'framed', 'collage']),
  perSlide: z.array(z.number().int().min(1).max(6)).min(1).max(8),
  collage: z.object({
    family: z.enum(COLLAGE_FAMILIES),
    chaos: z.number().min(0).max(1),
    gutter: z.number().min(0).max(0.1),
    decor: z.boolean().optional(),
  }),
  margin: z.number().min(0).max(0.2),
  title: z.object({ preset: slug, text: label(40), placement: z.enum(['top', 'bottom', 'center']) }),
  caption: z.object({ preset: slug, kind: z.enum(['counter', 'text']), text: label(40).optional() }).optional(),
  stickers: z.array(stickerRefSchema).max(12),
  coverStickers: z.number().int().min(0).max(4),
  adjust: adjustmentsSchema.optional(),
  letterbox: z.boolean().optional(),
});

/**
 * A trend pack is plain JSON so new drops can be published by dropping a file
 * into /trends and listing it in /trends/index.json — no app rebuild required.
 * Only safe primitives are accepted: colours are parsed, fonts and templates
 * must exist in the app, sticker art is path data only, CSS filters are an
 * allowlist of functions, and every string and list is length-capped.
 *
 * Version 2 adds looks, sticker art, layout rules, trend kits (`styles`), a
 * cover and format categories; version 1 packs still load (those are empty).
 */
export const trendPackSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  id: z
    .string()
    .regex(/^[0-9a-z-]+$/)
    .max(32),
  title: label(),
  subtitle: label(200),
  publishedAt: date,
  accent: z.tuple([color, color]),
  /** The drop's cover: a headline set in one of its typography pairings, on one of its palettes. */
  cover: z
    .object({
      headline: label(32),
      typography: slug.optional(),
      palette: slug.optional(),
      stickers: z.array(stickerRefSchema).max(4).default([]),
    })
    .optional(),
  templates: z.array(z.object({ templateId: slug, label: label(), heat })).max(40),
  layouts: z.array(z.object({ id: slug, name: label(), templateId: slug, description: label(200), heat })).max(40),
  layoutRules: z
    .array(
      z.object({ id: slug.max(32), name: label(40), emoji: z.string().max(8), blurb: label(120), heat, rule: layoutRuleSchema }),
    )
    .max(12)
    .default([]),
  typography: z
    .array(z.object({ id: slug, name: label(), vibe: label(24), sample: label(40), heading: typeSpec, body: typeSpec, heat }))
    .max(40),
  palettes: z
    .array(z.object({ id: slug, name: label(), mood: label(24), colors: z.array(color).min(2).max(8), heat: heat.optional() }))
    .max(40),
  /** Filters as data: the same adjustments, curves and effects as the built-in looks. */
  looks: z
    .array(
      z.object({
        id: slug.max(32),
        name: label(40),
        description: label(200),
        swatch: z.tuple([color, color]),
        adjust: adjustmentsSchema,
        curves: curvesSchema.optional(),
        effects: effectsSchema.optional(),
        heat,
      }),
    )
    .max(24)
    .default([]),
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
        /** A filter that recreates this effect: a built-in look id, or one of this pack's `looks`. */
        look: slug.optional(),
        /** Filter intensity for this effect, 0..100. */
        intensity: z.number().min(0).max(100).optional(),
        heat,
      }),
    )
    .max(40),
  stickers: z.array(stickerRefSchema).max(60),
  /** New vector stickers (path data on a 100×100 grid) — referenced as `art:<id>`. */
  stickerArt: z
    .array(stickerArtSchema.extend({ id: slug.max(32) }))
    .max(24)
    .default([]),
  formats: z
    .array(
      z.object({
        id: slug,
        name: label(),
        kind: label(24),
        /** Carousel style, meme format or social format (derived from `kind` when missing). */
        category: z.enum(FORMAT_CATEGORIES).optional(),
        description: label(200),
        templateId: slug,
        heat: heat.optional(),
      }),
    )
    .max(40),
  /** Trend kits: a palette, a type pairing, a look, stickers and motion that restyle a whole design. */
  styles: z
    .array(
      z.object({
        id: slug.max(32),
        name: label(40),
        vibe: label(24),
        description: label(160),
        palette: slug,
        typography: slug,
        look: slug.optional(),
        lookIntensity: z.number().min(0).max(100).optional(),
        stickers: z.array(stickerRefSchema).max(6).default([]),
        animate: z.enum(MOTION_VIBES).optional(),
        heat,
      }),
    )
    .max(16)
    .default([]),
});

/**
 * The list of drops. `path` is under /trends/ or relative to the index (so a
 * feed hosted elsewhere works); `publishedAt` schedules a drop — it goes live
 * on that day without a new build.
 */
export const trendIndexSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  packs: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[0-9a-z-]+$/)
          .max(32),
        path: z
          .string()
          .max(200)
          .regex(/^(?:\/trends\/|(?!\/))[\w-][\w/-]*\.json$/),
        publishedAt: date.optional(),
        title: label().optional(),
      }),
    )
    .min(1)
    .max(48),
});

export type TrendPack = z.infer<typeof trendPackSchema>;
export type TrendPackInput = z.input<typeof trendPackSchema>;
export type TrendIndex = z.infer<typeof trendIndexSchema>;
export type TrendTypography = TrendPack['typography'][number];
export type TrendPalette = TrendPack['palettes'][number];
export type TrendEffect = TrendPack['effects'][number];
export type TrendLook = TrendPack['looks'][number];
export type TrendFormat = TrendPack['formats'][number];
export type TrendStyle = TrendPack['styles'][number];
export type TrendLayoutRule = TrendPack['layoutRules'][number];
export type TrendStickerArt = TrendPack['stickerArt'][number];
export type FormatCategory = (typeof FORMAT_CATEGORIES)[number];
