import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORMATS, SIZE_PRESETS } from '@/projects/formats';
import { documentSchema } from '@/projects/schema';
import { resolveSticker } from '@/stickers/library';
import { findBundledFont } from '@/typography/fonts';
import { getLook } from '@/filters/looks';
import { describeTemplate } from './describe';
import { hasBundledTemplate, loadBundledTemplates, TEMPLATE_CATALOG } from './registry';
import { templateSchema } from './schema';

const libraryDir = path.join(__dirname, 'library');
const files = readdirSync(libraryDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(path.join(libraryDir, d.name)).map((f) => `${d.name}/${f}`))
  .filter((f) => f.endsWith('.json'))
  .sort();

describe('template library', () => {
  it('loads every bundled template without validation errors', async () => {
    const templates = await loadBundledTemplates();
    expect(templates).toHaveLength(files.length);
    expect(templates.length).toBeGreaterThanOrEqual(45);
    for (const t of templates) expect(templateSchema.safeParse(t).success, t.id).toBe(true);
  });

  it('keeps the generated index and catalog in sync with the JSON files (run `npm run templates`)', () => {
    const index = readFileSync(path.join(libraryDir, 'index.ts'), 'utf8');
    const listed = [...index.matchAll(/from '\.\/(.+?\.json)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual(files);
    const ids = files.map((f) => JSON.parse(readFileSync(path.join(libraryDir, f), 'utf8')).id);
    expect(TEMPLATE_CATALOG.map((t) => t.id).sort()).toEqual([...ids].sort());
  });

  it('files each template under its format, with unique template and element ids', async () => {
    const templates = await loadBundledTemplates();
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    for (const file of files) {
      const t = JSON.parse(readFileSync(path.join(libraryDir, file), 'utf8'));
      expect(file.startsWith(`${t.format}/`), file).toBe(true);
      expect(file.endsWith(`/${t.id}.json`), file).toBe(true);
    }
    for (const t of templates) {
      const elementIds = t.doc.elements.map((e) => e.id);
      expect(new Set(elementIds).size, t.id).toBe(elementIds.length);
      expect(new Set(t.doc.slides.map((s) => s.id)).size, t.id).toBe(t.doc.slides.length);
    }
  });

  it('uses the canvas size of its declared size preset', async () => {
    for (const t of await loadBundledTemplates()) {
      expect(FORMATS[t.format], t.id).toBeDefined();
      if (t.sizeId === 'custom') continue;
      const preset = SIZE_PRESETS[t.sizeId];
      expect([t.doc.slideWidth, t.doc.slideHeight], t.id).toEqual([preset.width, preset.height]);
    }
  });

  it('only uses bundled fonts and known stickers, so templates work offline', async () => {
    for (const t of await loadBundledTemplates()) {
      const facts = describeTemplate(t.doc);
      for (const family of facts.fonts) expect(findBundledFont(family), `${t.id}: ${family}`).toBeDefined();
      for (const sticker of facts.stickers) expect(resolveSticker(sticker), `${t.id}: ${sticker}`).not.toBeNull();
      // Bundled templates never reference photos — only empty photo frames.
      expect(t.doc.elements.some((e) => e.type === 'image' && e.assetId)).toBe(false);
      for (const el of t.doc.elements) {
        if (el.type === 'image' && el.filter) expect(getLook(el.filter.id), `${t.id}: ${el.filter.id}`).toBeDefined();
      }
    }
  });

  it('keeps text on the canvas', async () => {
    for (const t of await loadBundledTemplates()) {
      const width = t.doc.slideWidth * t.doc.slides.length;
      for (const el of t.doc.elements) {
        if (el.type !== 'text' || el.rotation) continue;
        expect(el.x, `${t.id}: ${el.text}`).toBeGreaterThanOrEqual(-1);
        expect(el.x + el.width, `${t.id}: ${el.text}`).toBeLessThanOrEqual(width + 1);
        expect(el.y, `${t.id}: ${el.text}`).toBeGreaterThanOrEqual(-1);
        expect(el.y + el.height, `${t.id}: ${el.text}`).toBeLessThanOrEqual(t.doc.slideHeight + 1);
      }
    }
  });

  it('covers every format with several styles', async () => {
    const templates = await loadBundledTemplates();
    expect(templates.filter((t) => describeTemplate(t.doc).looks.length > 0).length).toBeGreaterThanOrEqual(8);
    for (const format of Object.keys(FORMATS)) {
      expect(templates.filter((t) => t.format === format).length, format).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(templates.map((t) => t.style)).size).toBeGreaterThanOrEqual(10);
    expect(templates.filter((t) => describeTemplate(t.doc).photoSlots > 0).length).toBeGreaterThanOrEqual(25);
  });

  it('knows bundled ids synchronously (used by trend packs)', () => {
    expect(hasBundledTemplate('film-strip')).toBe(true);
    expect(hasBundledTemplate('nope')).toBe(false);
  });

  it('rejects malicious font family names', async () => {
    const t = structuredClone((await loadBundledTemplates())[0]!);
    const text = t.doc.elements.find((e) => e.type === 'text');
    if (text && text.type === 'text') text.fontFamily = 'x"; background:url(evil)';
    expect(templateSchema.safeParse(t).success).toBe(false);
    expect(documentSchema.safeParse(t.doc).success).toBe(false);
  });
});
