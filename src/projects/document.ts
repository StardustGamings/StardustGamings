import type { DesignDocument, DesignElement, Fill, Slide } from '@/types/document';
import { clamp } from '@/utils/math';
import { createId } from '@/utils/id';
import { MAX_SLIDES } from './formats';

export const DEFAULT_BACKGROUND: Fill = { type: 'solid', color: '#F4F1EA' };

export function createSlide(fill: Fill | null = null): Slide {
  return { id: createId('sl'), fill };
}

export function createDocument(options: {
  width: number;
  height: number;
  slideCount?: number;
  background?: Fill;
}): DesignDocument {
  const count = clamp(Math.round(options.slideCount ?? 1), 1, MAX_SLIDES);
  return {
    version: 1,
    slideWidth: options.width,
    slideHeight: options.height,
    background: options.background ?? DEFAULT_BACKGROUND,
    slides: Array.from({ length: count }, () => createSlide()),
    elements: [],
  };
}

export const stripWidth = (doc: DesignDocument): number => doc.slideWidth * doc.slides.length;

/** The slide an element "belongs" to is the one containing its centre point. */
export function slideIndexOf(el: Pick<DesignElement, 'x' | 'width'>, doc: DesignDocument): number {
  const centre = el.x + el.width / 2;
  return clamp(Math.floor(centre / doc.slideWidth), 0, doc.slides.length - 1);
}

const shiftX = <T extends DesignElement>(el: T, dx: number): T => (dx === 0 ? el : { ...el, x: el.x + dx });

export function insertSlide(doc: DesignDocument, index: number, fill: Fill | null = null): DesignDocument {
  if (doc.slides.length >= MAX_SLIDES) return doc;
  const at = clamp(index, 0, doc.slides.length);
  const slides = [...doc.slides];
  slides.splice(at, 0, createSlide(fill));
  const elements = doc.elements.map((el) => (slideIndexOf(el, doc) >= at ? shiftX(el, doc.slideWidth) : el));
  return { ...doc, slides, elements };
}

export function removeSlide(doc: DesignDocument, index: number): DesignDocument {
  if (doc.slides.length <= 1 || index < 0 || index >= doc.slides.length) return doc;
  const slides = doc.slides.filter((_, i) => i !== index);
  const elements: DesignElement[] = [];
  for (const el of doc.elements) {
    const owner = slideIndexOf(el, doc);
    if (owner === index) continue;
    elements.push(owner > index ? shiftX(el, -doc.slideWidth) : el);
  }
  return { ...doc, slides, elements };
}

export function duplicateSlide(doc: DesignDocument, index: number): DesignDocument {
  if (doc.slides.length >= MAX_SLIDES || index < 0 || index >= doc.slides.length) return doc;
  const source = doc.slides[index]!;
  const slides = [...doc.slides];
  slides.splice(index + 1, 0, { ...createSlide(source.fill) });
  const elements: DesignElement[] = [];
  const copies: DesignElement[] = [];
  for (const el of doc.elements) {
    const owner = slideIndexOf(el, doc);
    if (owner > index) elements.push(shiftX(el, doc.slideWidth));
    else elements.push(el);
    if (owner === index) copies.push({ ...shiftX(el, doc.slideWidth), id: createId('el') });
  }
  return { ...doc, slides, elements: [...elements, ...copies] };
}

export function moveSlide(doc: DesignDocument, from: number, to: number): DesignDocument {
  const n = doc.slides.length;
  if (from === to || from < 0 || from >= n || to < 0 || to >= n) return doc;
  const order = doc.slides.map((_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved!);
  // order[newIndex] = oldIndex → invert to oldIndex → newIndex.
  const newIndexOf = new Array<number>(n);
  order.forEach((oldIndex, newIndex) => {
    newIndexOf[oldIndex] = newIndex;
  });
  const slides = order.map((oldIndex) => doc.slides[oldIndex]!);
  const elements = doc.elements.map((el) => {
    const owner = slideIndexOf(el, doc);
    return shiftX(el, (newIndexOf[owner]! - owner) * doc.slideWidth);
  });
  return { ...doc, slides, elements };
}

/** Deep clone with fresh ids — used when instantiating templates or duplicating projects. */
export function cloneDocument(doc: DesignDocument): DesignDocument {
  const copy = structuredClone(doc);
  copy.slides = copy.slides.map((s) => ({ ...s, id: createId('sl') }));
  copy.elements = copy.elements.map((el) => ({ ...el, id: createId('el') }));
  return copy;
}

/** Every font family referenced by text elements. */
export function documentFonts(doc: DesignDocument): { family: string; weight: number; style: string }[] {
  const seen = new Map<string, { family: string; weight: number; style: string }>();
  for (const el of doc.elements) {
    if (el.type !== 'text') continue;
    const key = `${el.fontFamily}|${el.fontWeight}|${el.fontStyle}`;
    if (!seen.has(key)) seen.set(key, { family: el.fontFamily, weight: el.fontWeight, style: el.fontStyle });
  }
  return [...seen.values()];
}
