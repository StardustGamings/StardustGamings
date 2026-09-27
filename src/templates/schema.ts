import * as z from 'zod';
import { documentSchema, formatSchema, sizeIdSchema } from '@/projects/schema';
import { isValidColor } from '@/utils/color';

/** The look a template goes for — used by the browser's style filter. */
export const TEMPLATE_STYLES = [
  'editorial',
  'minimal',
  'bold',
  'scrapbook',
  'cinematic',
  'y2k',
  'streetwear',
  'retro',
  'soft',
  'luxury',
  'brutalist',
  'playful',
] as const;

export type TemplateStyle = (typeof TEMPLATE_STYLES)[number];

export const STYLE_LABELS: Record<TemplateStyle, string> = {
  editorial: 'Editorial',
  minimal: 'Minimal',
  bold: 'Big type',
  scrapbook: 'Scrapbook',
  cinematic: 'Cinematic',
  y2k: 'Y2K',
  streetwear: 'Streetwear',
  retro: 'Retro',
  soft: 'Soft',
  luxury: 'Luxury',
  brutalist: 'Brutalist',
  playful: 'Playful',
};

export const templateIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

/**
 * A template is plain JSON: metadata plus a complete design document. The
 * document carries the canvas size (`slideWidth`/`slideHeight`), slides,
 * backgrounds and every element with its position, fonts, colours and photo
 * slots (image elements without a photo), plus optional motion (element
 * animations, slide lengths, the transition between slides).
 */
export const templateSchema = z.object({
  id: templateIdSchema,
  name: z.string().min(1).max(60),
  format: formatSchema,
  sizeId: sizeIdSchema,
  style: z.enum(TEMPLATE_STYLES).default('editorial'),
  description: z.string().max(240),
  tags: z.array(z.string().max(32)).max(12),
  palette: z.array(z.string().refine(isValidColor)).max(8),
  doc: documentSchema,
});

export type TemplateDefinition = z.infer<typeof templateSchema>;
