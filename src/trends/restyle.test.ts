import { describe, expect, it } from 'vitest';
import type { DesignDocument, ImageElement, TextElement } from '@/types/document';
import { createDocument } from '@/projects/document';
import { resolveLook } from '@/filters/looks';
import { effectiveAdjust } from '@/filters/compose';
import { documentSchema } from '@/projects/schema';
import { luminance } from '@/utils/color';
import { BUNDLED_PACK } from './loader';
import { findLook, resolveStyle, ruleToDumpStyle } from './pack';
import { headlineIds, restyleDocument } from './restyle';
import { suggestTrends } from './suggest';

const text = (id: string, over: Partial<TextElement>): TextElement => ({
  id,
  type: 'text',
  x: 80,
  y: 100,
  width: 920,
  height: 100,
  rotation: 0,
  opacity: 1,
  text: 'Hello',
  fontFamily: 'Manrope',
  fontSize: 48,
  fontWeight: 400,
  fontStyle: 'normal',
  fill: { type: 'solid', color: '#111111' },
  align: 'left',
  verticalAlign: 'top',
  lineHeight: 1.1,
  letterSpacing: 0,
  ...over,
});

const photo = (id: string, over: Partial<ImageElement> = {}): ImageElement => ({
  id,
  type: 'image',
  x: 80,
  y: 400,
  width: 400,
  height: 400,
  rotation: 0,
  opacity: 1,
  assetId: `as-${id}`,
  fit: 'cover',
  ...over,
});

function design(): DesignDocument {
  const doc = createDocument({ width: 1080, height: 1350, background: { type: 'solid', color: '#FAFAFA' } });
  doc.elements = [
    text('h', { text: 'Big news', fontSize: 120 }),
    text('b', { y: 300, text: 'A quieter line', fontSize: 40 }),
    photo('p1'),
    photo('p2', { x: 520 }),
    photo('p3', { x: 80, y: 850 }),
  ];
  return doc;
}

const kit = BUNDLED_PACK.styles[0]!;

describe('trend kits', () => {
  it('finds the headline on each slide', () => {
    expect([...headlineIds(design())]).toEqual(['h']);
  });

  it('restyles colours, fonts, filter and motion in one pass — and stays a valid design', () => {
    const { palette, typography, look } = resolveStyle(BUNDLED_PACK, kit);
    const doc = restyleDocument(design(), {
      palette: palette.colors,
      typography,
      look,
      lookIntensity: kit.lookIntensity,
      animate: kit.animate,
    });
    const h = doc.elements.find((e) => e.id === 'h') as TextElement;
    const b = doc.elements.find((e) => e.id === 'b') as TextElement;
    expect(h.fontFamily).toBe(typography.heading.family);
    expect(b.fontFamily).toBe(typography.body.family);
    // Light background stays the lightest colour, dark text the darkest.
    const bg = doc.background.type === 'solid' ? doc.background.color : '';
    const ink = h.fill.type === 'solid' ? h.fill.color : '';
    expect(palette.colors).toContain(bg);
    expect(luminance(bg)).toBeGreaterThan(luminance(ink));
    const photos = doc.elements.filter((e): e is ImageElement => e.type === 'image');
    expect(photos.every((p) => resolveLook(p.filter)?.id === look!.id)).toBe(true);
    expect(doc.elements.every((e) => e.animation?.enter)).toBe(true);
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });

  it('can restyle just one part', () => {
    const { typography } = resolveStyle(BUNDLED_PACK, kit);
    const doc = restyleDocument(design(), { typography, animate: 'playful' }, { motion: false });
    expect(doc.elements.some((e) => e.animation)).toBe(false);
    expect((doc.elements[0] as TextElement).fontFamily).toBe(typography.heading.family);
  });

  it('carries pack looks inside the photo, so they render without the pack', () => {
    const own = BUNDLED_PACK.looks[0]!;
    const doc = restyleDocument(design(), { look: findLook(BUNDLED_PACK, own.id), lookIntensity: 100 });
    const p = doc.elements.find((e) => e.id === 'p1') as ImageElement;
    expect(p.filter?.look?.name).toBe(own.name);
    const json = JSON.parse(JSON.stringify(p)) as ImageElement;
    expect(effectiveAdjust(json)).toMatchObject({ temperature: own.adjust.temperature });
  });
});

describe('trend suggestions', () => {
  it('suggests a kit, a filter for bare photos, trending type, motion and a dump', () => {
    const kinds = suggestTrends(design(), BUNDLED_PACK, 10).map((s) => s.kind);
    expect(kinds).toEqual(expect.arrayContaining(['kit', 'look', 'fonts', 'motion', 'dump', 'format']));
  });

  it('stops suggesting what the design already has', () => {
    const { palette, typography, look } = resolveStyle(BUNDLED_PACK, kit);
    const styled = restyleDocument(design(), { palette: palette.colors, typography, look, animate: 'smooth' });
    const top = BUNDLED_PACK.typography.find((t) => t.heading.family === typography.heading.family);
    const kinds = suggestTrends(styled, BUNDLED_PACK, 10).map((s) => s.kind);
    expect(kinds).not.toContain('look');
    expect(kinds).not.toContain('motion');
    if (top) expect(kinds).not.toContain('fonts');
  });

  it('turns layout rules into photo-dump styles', () => {
    const rule = BUNDLED_PACK.layoutRules[0]!;
    const style = ruleToDumpStyle(rule);
    expect(style.id).toBe(`trend-${rule.id}`);
    expect(style.perSlide).toEqual(rule.rule.perSlide);
  });
});
