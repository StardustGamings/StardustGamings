import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DesignDocument, DesignElement, ImageElement, TextElement } from '@/types/document';
import { setStorageForTesting } from '@/storage/db';
import { createDocument, slideIndexOf } from '@/projects/document';
import { MAX_SLIDES } from '@/projects/formats';
import { documentSchema } from '@/projects/schema';
import { assetUsage } from '@/assets/repository';
import { derivePalette, describeTemplate, photoSlots } from './describe';
import { fillPhotoSlots, insertTemplate, instantiateTemplate, remapIds, replaceWithTemplate } from './instantiate';
import { loadBundledTemplate } from './registry';
import { deleteUserTemplate, listUserTemplates, putUserTemplate } from './repository';
import { templateSchema } from './schema';
import { buildUserTemplate, parseTemplateFile, serializeTemplateFile, stripPhotos, TemplateFileError } from './user';

const base = { rotation: 0, opacity: 1 };
const slot = (id: string, x: number, y: number, over: Partial<ImageElement> = {}): ImageElement => ({
  ...base,
  id,
  type: 'image',
  x,
  y,
  width: 200,
  height: 200,
  assetId: null,
  fit: 'cover',
  ...over,
});
const text = (id: string, x: number, y: number, over: Partial<TextElement> = {}): TextElement => ({
  ...base,
  id,
  type: 'text',
  x,
  y,
  width: 400,
  height: 100,
  text: 'Hello',
  fontFamily: 'Manrope',
  fontSize: 40,
  fontWeight: 700,
  fontStyle: 'normal',
  fill: { type: 'solid', color: '#111111' },
  align: 'left',
  verticalAlign: 'top',
  lineHeight: 1.1,
  letterSpacing: 0,
  ...over,
});

function doc(elements: DesignElement[], slides = 2, w = 1080, h = 1350): DesignDocument {
  const d = createDocument({ width: w, height: h, slideCount: slides, background: { type: 'solid', color: '#F4F1EA' } });
  d.elements = elements;
  return d;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setStorageForTesting(null);
});

describe('describing templates', () => {
  it('orders photo slots slide by slide, top to bottom, left to right', () => {
    const d = doc([slot('b', 600, 100), slot('c', 1200, 50), slot('a', 100, 110), slot('d', 100, 900)]);
    expect(photoSlots(d).map((e) => e.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('lists fonts, stickers, photo slots and a palette weighted by area', () => {
    const d = doc([
      text('t', 0, 0, { fontFamily: 'Anton' }),
      slot('p', 0, 200),
      { ...base, id: 's', type: 'sticker', x: 0, y: 0, width: 50, height: 50, stickerId: 'vector:sparkle', tint: '#FF00AA' },
    ]);
    const facts = describeTemplate(d);
    expect(facts).toMatchObject({ slides: 2, fonts: ['Anton'], stickers: ['vector:sparkle'], photoSlots: 1, texts: 1 });
    expect(derivePalette(d)[0]).toBe('#F4F1EA');
    expect(derivePalette(d)).toContain('#111111');
  });
});

describe('placing templates', () => {
  it('gives every slide, element, group and layout a fresh id', () => {
    const d = doc([
      { ...slot('p', 0, 0), groupId: 'g1', layout: { id: 'L', role: 'photo', index: 0 } },
      { ...text('t', 0, 300), groupId: 'g1' },
    ]);
    d.layouts = [
      {
        id: 'L',
        kind: 'collage',
        family: 'grid',
        seed: 1,
        chaos: 0,
        gutter: 0.02,
        frame: { x: 0, y: 0, width: 1080, height: 1350 },
      },
    ];
    const copy = remapIds(d);
    expect(copy.elements.map((e) => e.id)).not.toContain('p');
    expect(copy.slides[0]!.id).not.toBe(d.slides[0]!.id);
    expect(copy.elements[0]!.groupId).toBe(copy.elements[1]!.groupId);
    expect(copy.elements[0]!.groupId).not.toBe('g1');
    expect(copy.elements[0]!.layout!.id).toBe(copy.layouts![0]!.id);
    expect(copy.layouts![0]!.id).not.toBe('L');
    expect(d.elements[0]!.id).toBe('p'); // the template itself is untouched
  });

  it('fills photo frames in reading order and keeps the frame look', () => {
    const d = doc([slot('b', 600, 100, { adjust: { contrast: 20 } }), slot('a', 100, 100)]);
    const { doc: filled, filled: count } = fillPhotoSlots(d, ['ast_1', 'ast_2', 'ast_3']);
    expect(count).toBe(2);
    const byId = new Map(filled.elements.map((e) => [e.id, e as ImageElement]));
    expect(byId.get('a')!.assetId).toBe('ast_1');
    expect(byId.get('b')!.assetId).toBe('ast_2');
    expect(byId.get('b')!.adjust).toEqual({ contrast: 20 });
  });

  it('instantiates a bundled template with photos and a new palette', async () => {
    const t = (await loadBundledTemplate('scrapbook-dump'))!;
    const slots = describeTemplate(t.doc).photoSlots;
    const out = instantiateTemplate(t, { photos: ['ast_a', 'ast_b'], palette: ['#101010', '#FAFAFA', '#FF3366', '#33CCFF'] });
    expect(documentSchema.safeParse(out).success).toBe(true);
    expect(out.elements.filter((e) => e.type === 'image' && e.assetId)).toHaveLength(2);
    expect(photoSlots(out)).toHaveLength(slots - 2);
    expect(JSON.stringify(out.background)).not.toBe(JSON.stringify(t.doc.background));
  });

  it('inserts template slides into a design, moving later content along', () => {
    const target = doc([text('first', 100, 100), text('second', 1180, 100)], 2);
    const template = doc([text('tpl', 50, 50), slot('tp', 1130, 60)], 2);
    template.slides[1]!.fill = { type: 'solid', color: '#222222' };
    const out = insertTemplate(target, template, 1)!;
    expect(out.slides).toHaveLength(4);
    const byText = (s: string) => out.elements.find((e) => e.type === 'text' && e.text === 'Hello' && e.id !== s);
    expect(byText).toBeDefined();
    const second = out.elements.find((e) => e.id === 'second')!;
    expect(slideIndexOf(second, out)).toBe(3);
    const placed = out.elements.filter((e) => !['first', 'second'].includes(e.id));
    expect(placed.map((e) => slideIndexOf(e, out)).sort()).toEqual([1, 2]);
    expect(out.slides[1]!.fill).toEqual({ type: 'solid', color: '#F4F1EA' });
    expect(out.slides[2]!.fill).toEqual({ type: 'solid', color: '#222222' });
    expect(documentSchema.safeParse(out).success).toBe(true);
  });

  it('scales a template to a different slide size and centres it', () => {
    const target = doc([], 1, 1080, 1080);
    const template = doc([text('t', 0, 0, { width: 1080, height: 1350, fontSize: 100 })], 1, 1080, 1350);
    const out = insertTemplate(target, template, 1)!;
    const t = out.elements[0] as TextElement;
    const s = 1080 / 1350;
    expect(t.fontSize).toBeCloseTo(100 * s);
    expect(t.height).toBeCloseTo(1080);
    expect(t.x).toBeCloseTo(1080 + (1080 - 1080 * s) / 2);
    expect(t.y).toBeCloseTo(0);
  });

  it('keeps a gradient flowing across template slides as one locked backdrop', () => {
    const template = doc([text('t', 10, 10)], 3);
    template.background = {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#FFFFFF' },
      ],
    };
    const out = insertTemplate(doc([], 1), template, 1)!;
    const backdrop = out.elements.find((e) => e.name === 'Background')!;
    expect(backdrop).toMatchObject({ type: 'shape', locked: true, x: 1080, width: 3 * 1080 });
    expect(out.elements.indexOf(backdrop)).toBeLessThan(out.elements.findIndex((e) => e.type === 'text'));
  });

  it('refuses to go past the slide limit', () => {
    expect(insertTemplate(doc([], MAX_SLIDES - 1), doc([], 2), 0)).toBeNull();
  });

  it('replaces a design with a template, keeping the canvas size and guides', () => {
    const target = doc([text('old', 0, 0)], 3, 1080, 1080);
    target.guides = [{ id: 'g', axis: 'x', position: 540 }];
    const template = doc([text('new', 0, 0)], 2, 1080, 1080);
    template.background = { type: 'solid', color: '#123456' };
    const out = replaceWithTemplate(target, template);
    expect(out.slides).toHaveLength(2);
    expect(out.background).toEqual({ type: 'solid', color: '#123456' });
    expect(out.elements.map((e) => e.id)).not.toContain('old');
    expect(out.guides).toEqual(target.guides);
    expect([out.slideWidth, out.slideHeight]).toEqual([1080, 1080]);
  });
});

describe('saving your own templates', () => {
  const photoDoc = () => {
    const d = doc([
      slot('photo', 0, 0, {
        assetId: 'ast_photo',
        name: 'IMG_2044 beach',
        focusX: 0.2,
        zoom: 1.4,
        adjust: { saturation: 30 },
        clip: 'arch',
        cutout: { maskAssetId: 'ast_mask', feather: 10, backdrop: { type: 'none' } },
        layout: { id: 'L', role: 'photo', index: 0 },
      }),
      {
        ...base,
        id: 'tape',
        type: 'sticker',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        stickerId: 'vector:tape',
        layout: { id: 'L', role: 'decor' },
      },
      slot('mysticker', 400, 400, { assetId: 'ast_sticker' }),
      text('t', 0, 600),
    ]);
    d.layouts = [
      {
        id: 'L',
        kind: 'collage',
        family: 'scrapbook',
        seed: 3,
        chaos: 0.5,
        gutter: 0.02,
        frame: { x: 0, y: 0, width: 1080, height: 1350 },
      },
    ];
    return d;
  };

  it('turns photos into empty frames that keep their look but not their crop or file name', () => {
    const out = stripPhotos(photoDoc(), { keep: new Set(['ast_sticker']) });
    const photo = out.elements.find((e) => e.id === 'photo') as ImageElement;
    expect(photo.assetId).toBeNull();
    expect(photo.adjust).toEqual({ saturation: 30 });
    expect(photo.clip).toBe('arch');
    expect(photo.cutout).toBeUndefined();
    expect(photo.focusX).toBeUndefined();
    expect(photo.zoom).toBeUndefined();
    expect(photo.name).toBeUndefined();
    expect(photo.placeholder).toBeDefined();
    // The collage can't re-generate without photos, so it's detached everywhere.
    expect(out.layouts).toBeUndefined();
    expect(out.elements.some((e) => e.layout)).toBe(false);
    expect((out.elements.find((e) => e.id === 'mysticker') as ImageElement).assetId).toBe('ast_sticker');
  });

  it('drops the photo from photo-filled text, which keeps its colour', () => {
    const d = photoDoc();
    d.elements = d.elements.map((e) => (e.type === 'text' ? { ...e, photoFill: { assetId: 'ast_1', zoom: 2 } } : e));
    const t = stripPhotos(d).elements.find((e) => e.type === 'text') as TextElement;
    expect(t.photoFill).toBeUndefined();
    expect(t.fill).toEqual((d.elements.find((e) => e.type === 'text') as TextElement).fill);
  });

  it('builds a validated template with a derived palette and clean tags', () => {
    const t = buildUserTemplate({
      name: '  My   dump  ',
      description: 'a'.repeat(300),
      style: 'scrapbook',
      tags: ['Summer!!', 'summer', '  beach ', ''],
      format: 'carousel',
      sizeId: 'ig-portrait',
      doc: { ...photoDoc(), guides: [{ id: 'g', axis: 'x', position: 3 }] },
      keepPhotos: false,
    });
    expect(templateSchema.safeParse(t).success).toBe(true);
    expect(t.id).toMatch(/^my-[a-z0-9]+$/);
    expect(t.name).toBe('My dump');
    expect(t.description).toHaveLength(240);
    expect(t.tags).toEqual(['summer', 'beach']);
    expect(t.palette.length).toBeGreaterThan(0);
    expect(t.doc.guides).toBeUndefined();
    expect(t.keepsPhotos).toBe(false);
    expect(describeTemplate(t.doc).photoSlots).toBe(2);
  });

  it('can keep photos (they stay on this device) — and those photos count as in use', async () => {
    const t = buildUserTemplate({
      name: 'Kept',
      style: 'soft',
      format: 'post',
      sizeId: 'ig-portrait',
      doc: photoDoc(),
      keepPhotos: true,
    });
    expect((t.doc.elements[0] as ImageElement).assetId).toBe('ast_photo');
    expect(t.doc.layouts).toHaveLength(1);
    await putUserTemplate(t);
    expect((await listUserTemplates()).map((x) => x.id)).toEqual([t.id]);
    const usage = await assetUsage();
    expect(usage.get('ast_photo')).toEqual([`template:${t.id}`]);
    expect(usage.get('ast_mask')).toEqual([`template:${t.id}`]);
    await deleteUserTemplate(t.id);
    expect(await listUserTemplates()).toEqual([]);
  });

  it('exports files without photos or personal stickers, and imports them as new templates', () => {
    const t = buildUserTemplate({
      name: 'Share me',
      style: 'soft',
      format: 'post',
      sizeId: 'ig-portrait',
      doc: photoDoc(),
      keepPhotos: true,
    });
    const file = serializeTemplateFile(t, { stickerAssetIds: new Set(['ast_sticker']) });
    expect(file).not.toContain('ast_photo');
    expect(file).not.toContain('ast_mask');
    expect(file).not.toContain('ast_sticker');
    expect(file).not.toContain('IMG_2044');
    const imported = parseTemplateFile(file);
    expect(imported.id).not.toBe(t.id);
    expect(imported.name).toBe('Share me');
    expect(imported.keepsPhotos).toBe(false);
    expect(describeTemplate(imported.doc).photoSlots).toBe(1);
  });

  it('rejects files that aren’t templates, and never trusts asset ids inside them', () => {
    expect(() => parseTemplateFile('not json')).toThrow(TemplateFileError);
    expect(() => parseTemplateFile('{"kind":"something-else"}')).toThrow('isn’t a Stardeck template');
    expect(() => parseTemplateFile('{"kind":"stardeck-template","version":1,"template":{}}')).toThrow('damaged');
    const evil = JSON.parse(
      serializeTemplateFile(
        buildUserTemplate({
          name: 'x',
          style: 'soft',
          format: 'post',
          sizeId: 'ig-portrait',
          doc: doc([text('t', 0, 0)]),
          keepPhotos: false,
        }),
      ),
    );
    evil.template.doc.elements.push(slot('sneaky', 0, 0, { assetId: 'ast_someone_elses' }));
    expect(parseTemplateFile(JSON.stringify(evil)).doc.elements.some((e) => e.type === 'image' && e.assetId)).toBe(false);
    evil.template.doc.elements[0].fontFamily = 'x;}body{background:url(evil)}';
    expect(() => parseTemplateFile(JSON.stringify(evil))).toThrow(TemplateFileError);
  });
});
