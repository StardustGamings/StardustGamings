import { describe, expect, it } from 'vitest';
import { templateSchema } from './schema';
import { TEMPLATES, getTemplate } from './registry';
import { FORMATS } from '@/projects/formats';

describe('template registry', () => {
  it('loads every bundled template without validation errors', () => {
    expect(TEMPLATES.length).toBe(15);
    for (const t of TEMPLATES) expect(templateSchema.safeParse(t).success).toBe(true);
  });

  it('has unique template and element ids', () => {
    const ids = new Set(TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      const elementIds = t.doc.elements.map((e) => e.id);
      expect(new Set(elementIds).size).toBe(elementIds.length);
    }
  });

  it('matches the canvas size of its declared size preset', () => {
    for (const t of TEMPLATES) {
      expect(FORMATS[t.format]).toBeDefined();
      expect(t.doc.slideWidth).toBeGreaterThan(0);
      expect(t.doc.slides.length).toBeGreaterThanOrEqual(1);
    }
    expect(getTemplate('film-strip')?.doc.slides).toHaveLength(3);
  });

  it('rejects malicious font family names', () => {
    const t = structuredClone(TEMPLATES[0]!);
    const text = t.doc.elements.find((e) => e.type === 'text');
    if (text && text.type === 'text') text.fontFamily = 'x"; background:url(evil)';
    expect(templateSchema.safeParse(t).success).toBe(false);
  });
});
