import { describe, expect, it } from 'vitest';
import type { DesignDocument, ShapeElement } from '@/types/document';
import {
  cloneDocument,
  createDocument,
  documentFonts,
  duplicateSlide,
  insertSlide,
  moveSlide,
  removeSlide,
  slideIndexOf,
  stripWidth,
} from './document';
import { MAX_SLIDES } from './formats';

const box = (id: string, x: number, width = 100): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'rect',
  x,
  y: 0,
  width,
  height: 100,
  rotation: 0,
  opacity: 1,
  fill: { type: 'solid', color: '#000' },
});

function docWith(slides: number, elements = [box('a', 10), box('b', 1090), box('c', 2170)]): DesignDocument {
  return { ...createDocument({ width: 1080, height: 1350, slideCount: slides }), elements };
}

describe('document model', () => {
  it('creates slides within limits', () => {
    expect(createDocument({ width: 1080, height: 1080, slideCount: 0 }).slides).toHaveLength(1);
    expect(createDocument({ width: 1080, height: 1080, slideCount: 999 }).slides).toHaveLength(MAX_SLIDES);
    expect(stripWidth(docWith(3))).toBe(3240);
  });

  it('assigns elements to the slide containing their centre', () => {
    const doc = docWith(3);
    expect(slideIndexOf(box('x', 1030, 100), doc)).toBe(1); // centre exactly on the boundary belongs to the right slide
    expect(slideIndexOf(box('x', 1020, 100), doc)).toBe(0);
    expect(slideIndexOf(box('x', 1040, 100), doc)).toBe(1);
    expect(slideIndexOf(box('x', 99999), doc)).toBe(2);
  });

  it('inserts a slide and shifts later elements right', () => {
    const next = insertSlide(docWith(3), 1);
    expect(next.slides).toHaveLength(4);
    expect(next.elements.map((e) => e.x)).toEqual([10, 2170, 3250]);
  });

  it('removes a slide, its elements, and shifts later elements left', () => {
    const next = removeSlide(docWith(3), 1);
    expect(next.slides).toHaveLength(2);
    expect(next.elements.map((e) => e.id)).toEqual(['a', 'c']);
    expect(next.elements.find((e) => e.id === 'c')?.x).toBe(1090);
  });

  it('never removes the last slide', () => {
    const single = docWith(1, [box('a', 10)]);
    expect(removeSlide(single, 0)).toBe(single);
  });

  it('duplicates a slide including its elements with fresh ids', () => {
    const next = duplicateSlide(docWith(3), 0);
    expect(next.slides).toHaveLength(4);
    const xs = next.elements.map((e) => e.x).sort((a, b) => a - b);
    expect(xs).toEqual([10, 1090, 2170, 3250]);
    const ids = next.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('moves a slide and carries its elements along', () => {
    const doc = docWith(3);
    const next = moveSlide(doc, 0, 2);
    expect(next.slides.map((s) => s.id)).toEqual([doc.slides[1]!.id, doc.slides[2]!.id, doc.slides[0]!.id]);
    const byId = Object.fromEntries(next.elements.map((e) => [e.id, e.x]));
    expect(byId).toEqual({ a: 2170, b: 10, c: 1090 });
  });

  it('treats out-of-range moves as no-ops', () => {
    const doc = docWith(3);
    expect(moveSlide(doc, 0, 5)).toBe(doc);
    expect(moveSlide(doc, 1, 1)).toBe(doc);
  });

  it('clones with new ids and no shared references', () => {
    const doc = docWith(2);
    const copy = cloneDocument(doc);
    expect(copy.slides[0]!.id).not.toBe(doc.slides[0]!.id);
    expect(copy.elements[0]!.id).not.toBe(doc.elements[0]!.id);
    (copy.elements[0] as ShapeElement).x = 999;
    expect(doc.elements[0]!.x).toBe(10);
  });

  it('lists the fonts used by text elements', () => {
    const doc = docWith(1, []);
    doc.elements = [
      {
        ...box('t', 0),
        type: 'text',
        text: 'hi',
        fontFamily: 'Anton',
        fontSize: 40,
        fontWeight: 400,
        fontStyle: 'normal',
        fill: { type: 'solid', color: '#000' },
        align: 'left',
        verticalAlign: 'top',
        lineHeight: 1,
        letterSpacing: 0,
      } as never,
    ];
    expect(documentFonts(doc)).toEqual([{ family: 'Anton', weight: 400, style: 'normal' }]);
  });
});
