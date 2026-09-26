import { describe, expect, it } from 'vitest';
import type { CollageFamily, DesignDocument, ImageElement } from '@/types/document';
import { createDocument, duplicateSlide, slideIndexOf } from '@/projects/document';
import { documentSchema } from '@/projects/schema';
import { duplicateElements } from '@/editor/core/ops';
import { seededRandom } from '@/utils/math';
import {
  createCollage,
  createPanorama,
  getLayout,
  regenerateCollage,
  regeneratePanorama,
  removeLayout,
  setPhotoLocked,
  shuffleCollage,
} from './apply';
import { generateCollage, linearPartition, moodParams } from './collage';
import { DUMP_STYLES, getDumpStyle } from './dump-styles';
import { generatePhotoDump, planSlides } from './dump';
import { generatePanorama, panoramaFit, suggestedSlides } from './panorama';
import type { Box, PhotoRef } from './types';

const photos = (n: number, seed = 1): PhotoRef[] => {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, (_, i) => ({
    assetId: `as_${i}`,
    width: Math.round(600 + rnd() * 1400),
    height: Math.round(600 + rnd() * 1400),
    palette: ['#E86A5A', '#2C6FD0'],
  }));
};
const box: Box = { x: 100, y: 50, width: 900, height: 1200 };
const inside = (b: Box, outer: Box, eps = 1e-6) =>
  b.x >= outer.x - eps &&
  b.y >= outer.y - eps &&
  b.x + b.width <= outer.x + outer.width + eps &&
  b.y + b.height <= outer.y + outer.height + eps;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6;
const dims = (id: string) => {
  const i = Number(id.split('_')[1]);
  return Number.isFinite(i) ? photos(20)[i]! : null;
};

describe('linear partition', () => {
  it('splits into contiguous, balanced groups', () => {
    expect(linearPartition([1, 1, 1, 1], 2)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(linearPartition([3, 1, 1, 1], 2)).toEqual([[0], [1, 2, 3]]);
    expect(linearPartition([1, 2, 3], 5).flat()).toEqual([0, 1, 2]);
  });
});

describe('collage generators', () => {
  const families: CollageFamily[] = ['grid', 'editorial', 'bento', 'scrapbook', 'polaroid', 'filmstrip'];

  it.each(families)('%s: one slot per photo, a real assignment, deterministic per seed', (family) => {
    for (const n of [1, 2, 3, 5, 8, 13, 20]) {
      const p = photos(n);
      const a = generateCollage(p, box, { family, seed: 42, chaos: 0.5, gutter: 0.02, decor: true });
      expect(a.slots).toHaveLength(n);
      expect([...a.assign].sort((x, y) => x - y)).toEqual(p.map((_, i) => i));
      expect(a.layers.filter((l) => 'slot' in l)).toHaveLength(n);
      const b = generateCollage(p, box, { family, seed: 42, chaos: 0.5, gutter: 0.02, decor: true });
      expect(b.slots).toEqual(a.slots);
      for (const s of a.slots) {
        expect(s.width).toBeGreaterThan(0);
        expect(s.height).toBeGreaterThan(0);
      }
    }
  });

  it.each(['grid', 'editorial', 'bento'] as const)('%s tiles the area without overlaps', (family) => {
    for (const n of [2, 4, 7, 12]) {
      const r = generateCollage(photos(n, n), box, { family, seed: n, chaos: 0.2, gutter: 0.02 });
      r.slots.forEach((s, i) => {
        expect(inside(s, box)).toBe(true);
        r.slots.slice(i + 1).forEach((t) => expect(overlaps(s, t)).toBe(false));
      });
      // Nearly all of the area is used (only gutters are empty).
      const used = r.slots.reduce((sum, s) => sum + s.width * s.height, 0);
      expect(used / (box.width * box.height)).toBeGreaterThan(0.8);
    }
  });

  it('gives the editorial hero the biggest cell', () => {
    const p = photos(5);
    const r = generateCollage(p, box, { family: 'editorial', seed: 3, chaos: 0, gutter: 0.01 });
    const areas = r.slots.map((s) => s.width * s.height);
    expect(areas[r.assign[0]!]).toBe(Math.max(...areas));
  });

  it('keeps tilted photos entirely inside the area (nothing spills onto the next slide)', () => {
    for (const family of ['scrapbook', 'polaroid'] as const) {
      for (const n of [1, 2, 3, 6]) {
        for (const seed of [1, 2, 3, 4, 5]) {
          const r = generateCollage(photos(n, seed), box, { family, seed, chaos: 1, gutter: 0.02 });
          for (const s of r.slots) {
            const rad = (s.rotation * Math.PI) / 180;
            const hw = (Math.abs(s.width * Math.cos(rad)) + Math.abs(s.height * Math.sin(rad))) / 2;
            const hh = (Math.abs(s.width * Math.sin(rad)) + Math.abs(s.height * Math.cos(rad))) / 2;
            const cx = s.x + s.width / 2;
            const cy = s.y + s.height / 2;
            expect(cx - hw).toBeGreaterThanOrEqual(box.x - 1);
            expect(cx + hw).toBeLessThanOrEqual(box.x + box.width + 1);
            expect(cy - hh).toBeGreaterThanOrEqual(box.y - 1);
            expect(cy + hh).toBeLessThanOrEqual(box.y + box.height + 1);
          }
        }
      }
    }
  });

  it('keeps scattered photos on the page and adds decor when asked', () => {
    const r = generateCollage(photos(9), box, { family: 'scrapbook', seed: 9, chaos: 1, gutter: 0.02, decor: true });
    for (const s of r.slots) {
      const cx = s.x + s.width / 2;
      const cy = s.y + s.height / 2;
      expect(cx).toBeGreaterThanOrEqual(box.x);
      expect(cx).toBeLessThanOrEqual(box.x + box.width);
      expect(cy).toBeGreaterThanOrEqual(box.y);
      expect(cy).toBeLessThanOrEqual(box.y + box.height);
    }
    expect(r.layers.some((l) => 'decor' in l && l.decor.type === 'sticker')).toBe(true);
    // Polaroid cards sit directly under their photo.
    const pol = generateCollage(photos(4), box, { family: 'polaroid', seed: 2, chaos: 0.4, gutter: 0.02 });
    pol.layers.forEach((l, i) => {
      if ('slot' in l) expect('decor' in pol.layers[i - 1]! && pol.layers[i - 1]).toBeTruthy();
    });
  });

  it('maps moods to styles', () => {
    expect(moodParams('minimal', { family: 'scrapbook', chaos: 0.8, gutter: 0.02 }).family).toBe('grid');
    expect(moodParams('chaotic', { family: 'grid', chaos: 0, gutter: 0.02 }).chaos).toBeGreaterThan(0.4);
    expect(moodParams('genz', { family: 'grid', chaos: 0, gutter: 0.02 }).decor).toBe(true);
    expect(moodParams('editorial', { family: 'grid', chaos: 0, gutter: 0.02 }).family).toBe('editorial');
  });
});

describe('collages in a document', () => {
  const base = (): DesignDocument => createDocument({ width: 1080, height: 1350, slideCount: 3 });

  it('creates a collage on a slide and regenerates it without losing photo edits', () => {
    const made = createCollage(base(), { slide: 1, family: 'grid', seed: 1, photos: photos(4), dims });
    const doc = made.doc;
    expect(getLayout(doc, made.layoutId)?.kind).toBe('collage');
    const imgs = doc.elements.filter((e) => e.type === 'image');
    expect(imgs).toHaveLength(4);
    imgs.forEach((e) => {
      expect(e.layout).toMatchObject({ id: made.layoutId, role: 'photo' });
      expect(slideIndexOf(e, doc)).toBe(1);
    });
    expect(documentSchema.safeParse(doc).success).toBe(true);

    // Edit one photo, restyle: same element, same edit, new frame.
    const target = imgs[0]!.id;
    const edited = {
      ...doc,
      elements: doc.elements.map((e) => (e.id === target ? { ...e, adjust: { contrast: 30 } } : e)),
    };
    const restyled = regenerateCollage(edited, made.layoutId, { family: 'scrapbook', chaos: 0.8 }, dims);
    const after = restyled.elements.find((e) => e.id === target) as ImageElement;
    expect(after.adjust).toEqual({ contrast: 30 });
    expect(after.stroke).toBeDefined();
    expect(restyled.elements.filter((e) => e.type === 'image')).toHaveLength(4);
  });

  it('shuffle keeps locked photos exactly where they are', () => {
    const made = createCollage(base(), { slide: 0, family: 'bento', seed: 5, photos: photos(5), dims });
    const lockedId = made.ids[2]!;
    const locked = setPhotoLocked(made.doc, lockedId, true);
    const before = locked.elements.find((e) => e.id === lockedId)!;
    const shuffled = shuffleCollage(locked, made.layoutId, 99, dims);
    const after = shuffled.elements.find((e) => e.id === lockedId)!;
    expect([after.x, after.y, after.width, after.height]).toEqual([before.x, before.y, before.width, before.height]);
    // Every unlocked photo moved.
    for (const id of made.ids.filter((id) => id !== lockedId)) {
      const a = locked.elements.find((e) => e.id === id)!;
      const b = shuffled.elements.find((e) => e.id === id)!;
      expect([a.x, a.y]).not.toEqual([b.x, b.y]);
    }
  });

  it('restyling keeps locked photos near their spot', () => {
    const made = createCollage(base(), { slide: 0, family: 'grid', seed: 2, photos: photos(6), dims });
    const lockedId = made.ids[5]!;
    const doc = setPhotoLocked(made.doc, lockedId, true);
    const before = doc.elements.find((e) => e.id === lockedId)!;
    const next = regenerateCollage(doc, made.layoutId, { family: 'editorial', seed: 8 }, dims);
    const after = next.elements.find((e) => e.id === lockedId)!;
    const dist = Math.hypot(
      after.x + after.width / 2 - (before.x + before.width / 2),
      after.y + after.height / 2 - (before.y + before.height / 2),
    );
    expect(dist).toBeLessThan(700);
    expect(after.layout?.locked).toBe(true);
  });

  it('shuffling without locks produces a new arrangement', () => {
    const made = createCollage(base(), { slide: 0, family: 'editorial', seed: 2, photos: photos(5), dims });
    const next = shuffleCollage(made.doc, made.layoutId, 1234, dims);
    const pos = (d: DesignDocument) => made.ids.map((id) => d.elements.find((e) => e.id === id)!).map((e) => `${e.x},${e.y}`);
    expect(pos(next)).not.toEqual(pos(made.doc));
  });

  it('turns existing photos into a collage and detaches cleanly', () => {
    const doc0 = base();
    const loose: ImageElement[] = [0, 1, 2].map((i) => ({
      id: `el_${i}`,
      type: 'image',
      x: 10 * i,
      y: 10,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      assetId: `as_${i}`,
      fit: 'cover',
    }));
    const doc = { ...doc0, elements: loose };
    const made = createCollage(doc, { slide: 0, family: 'grid', seed: 1, elementIds: loose.map((e) => e.id), dims });
    expect(made.doc.elements.map((e) => e.id).sort()).toEqual(loose.map((e) => e.id));
    const freed = removeLayout(made.doc, made.layoutId);
    expect(freed.elements.every((e) => !e.layout)).toBe(true);
    expect(freed.layouts).toBeUndefined();
  });

  it('duplicating a slide makes an independent collage; copied elements leave the layout', () => {
    const made = createCollage(base(), { slide: 0, family: 'grid', seed: 1, photos: photos(3), dims });
    const dup = duplicateSlide(made.doc, 0);
    expect(dup.layouts).toHaveLength(2);
    const ids = new Set(dup.elements.map((e) => e.layout?.id));
    expect(ids.size).toBe(2);
    const copy = duplicateElements(made.doc, [made.ids[0]!], { x: 5, y: 5 });
    expect(copy.doc.elements.find((e) => e.id === copy.ids[0])!.layout).toBeUndefined();
  });
});

describe('seamless panorama', () => {
  const slide = { width: 1080, height: 1350 };

  it('splits one photo across all slides', () => {
    const r = generatePanorama(photos(1), slide, 0, { slides: 4, spacing: 0, margin: 0, align: 'center' });
    expect(r.slots[0]).toMatchObject({ x: 0, y: 0, width: 4320, height: 1350 });
  });

  it('flows several photos edge to edge with even gaps', () => {
    const p = photos(5);
    const r = generatePanorama(p, slide, 1080, { slides: 5, spacing: 0.05, margin: 0.1, align: 'center' });
    const gap = 1080 * 0.05;
    expect(r.slots[0]!.x).toBeCloseTo(1080 + gap);
    for (let i = 1; i < 5; i++) expect(r.slots[i]!.x).toBeCloseTo(r.slots[i - 1]!.x + r.slots[i - 1]!.width + gap);
    const last = r.slots[4]!;
    expect(last.x + last.width + gap).toBeCloseTo(1080 + 5 * 1080);
    expect(r.slots.every((s) => s.height === 1350 * 0.8)).toBe(true);
    const stagger = generatePanorama(p, slide, 0, { slides: 5, spacing: 0.05, margin: 0.1, align: 'stagger' });
    expect(stagger.slots[1]!.height).toBeLessThan(stagger.slots[0]!.height);
  });

  it('suggests a slide count that keeps photos close to their shape', () => {
    const p = photos(6);
    const n = suggestedSlides(p, slide, { spacing: 0.03, margin: 0.08, align: 'center' });
    const r = generatePanorama(p, slide, 0, { slides: n, spacing: 0.03, margin: 0.08, align: 'center' });
    expect(panoramaFit(r, p)).toBeLessThan(1.6);
  });

  it('adds and removes slides when the slide count changes, moving later content', () => {
    let doc = createDocument({ width: 1080, height: 1350, slideCount: 4 });
    doc = {
      ...doc,
      elements: [
        {
          id: 'after',
          type: 'shape',
          shape: 'rect',
          x: 3 * 1080 + 100,
          y: 100,
          width: 50,
          height: 50,
          rotation: 0,
          opacity: 1,
          fill: null,
        },
      ],
    };
    const made = createPanorama(doc, {
      startSlide: 0,
      photos: photos(3),
      params: { slides: 3, spacing: 0, margin: 0, align: 'center' },
      seed: 1,
    });
    expect(made.doc.slides).toHaveLength(4);
    const wider = regeneratePanorama(made.doc, made.layoutId, { slides: 5 }, dims);
    expect(wider.slides).toHaveLength(6);
    expect(wider.elements.find((e) => e.id === 'after')!.x).toBe(5 * 1080 + 100);
    const panoRight = Math.max(...wider.elements.filter((e) => e.type === 'image').map((e) => e.x + e.width));
    expect(panoRight).toBeCloseTo(5 * 1080);
    const narrower = regeneratePanorama(wider, made.layoutId, { slides: 2 }, dims);
    expect(narrower.slides).toHaveLength(3);
    expect(narrower.elements.find((e) => e.id === 'after')!.x).toBe(2 * 1080 + 100);
  });
});

describe('smart photo dump', () => {
  it('plans slides following the style rhythm', () => {
    const plan = planSlides(10, getDumpStyle('clean'));
    expect(plan.cover).toBe(1);
    expect(plan.groups.reduce((a, b) => a + b, 1)).toBe(10);
    expect(plan.groups.every((g) => g >= 1)).toBe(true);
  });

  it.each(DUMP_STYLES.map((s) => s.id))('%s: every photo used once in a valid document', (id) => {
    const style = getDumpStyle(id);
    const p = photos(11, 3);
    const doc = generatePhotoDump({ photos: p, style, width: 1080, height: 1350, seed: 7 });
    const parsed = documentSchema.safeParse(doc);
    expect(parsed.success, JSON.stringify(parsed.error?.issues[0])).toBe(true);
    const used = doc.elements.filter((e): e is ImageElement => e.type === 'image').map((e) => e.assetId);
    expect([...used].sort()).toEqual(p.map((x) => x.assetId).sort());
    expect(doc.slides.length).toBe(1 + planSlides(11, style).groups.length);
    // Every photo sits on some slide and inside the strip.
    for (const e of doc.elements) {
      expect(e.x + e.width / 2).toBeGreaterThanOrEqual(0);
      expect(e.x + e.width / 2).toBeLessThanOrEqual(1080 * doc.slides.length);
    }
    // Content slides are shuffle-able collages (except full-bleed cinematic singles).
    if (!style.letterbox) expect((doc.layouts ?? []).length).toBeGreaterThan(0);
    if (style.adjust) expect(doc.elements.find((e) => e.type === 'image') as ImageElement).toHaveProperty('adjust');
    // There's a title.
    expect(doc.elements.some((e) => e.type === 'text')).toBe(true);
  });
});
