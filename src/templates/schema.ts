import { z } from 'zod';
import { documentSchema, formatSchema, sizeIdSchema } from '@/projects/schema';
import { isValidColor } from '@/utils/color';

export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  format: formatSchema,
  sizeId: sizeIdSchema,
  description: z.string().max(240),
  tags: z.array(z.string().max(32)).max(12),
  palette: z.array(z.string().refine(isValidColor)).max(8),
  doc: documentSchema,
});

export type TemplateDefinition = z.infer<typeof templateSchema>;
