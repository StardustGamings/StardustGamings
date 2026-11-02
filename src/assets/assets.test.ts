import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DesignDocument, ImageElement } from '@/types/document';
import { setStorageForTesting } from '@/storage/db';
import { createDocument } from '@/projects/document';
import * as projects from '@/projects/repository';
import { elementSchema } from '@/projects/schema';
import { extractPalette } from './palette';
import { ImportError } from './process-core';
import * as repo from './repository';
import { cleanFileName, sniffImageFormat } from './sniff';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const bytes = (arr: number[], extra = 64) => new Uint8Array([...arr, ...new Array(extra).fill(7)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('file sniffing', () => {
  it('recognises formats by magic bytes, not names', () => {
    expect(sniffImageFormat(bytes(PNG))).toBe('png');
    expect(sniffImageFormat(bytes(JPEG))).toBe('jpeg');
    expect(sniffImageFormat(bytes([...ascii('GIF89a'), 1, 0, 1, 0, 0, 0]))).toBe('gif');
    expect(sniffImageFormat(bytes([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]))).toBe('webp');
    expect(sniffImageFormat(bytes([0, 0, 0, 24, ...ascii('ftypheic')]))).toBe('heic');
    expect(sniffImageFormat(bytes([0, 0, 0, 24, ...ascii('ftypavif')]))).toBe('avif');
    expect(sniffImageFormat(new TextEncoder().encode('\uFEFF  <?xml version="1.0"?><svg xmlns="x"></svg>'))).toBe('svg');
    expect(sniffImageFormat(new TextEncoder().encode('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImageFormat(bytes(ascii('%PDF-1.7')))).toBeNull();
  });

  it('cleans file names', () => {
    expect(cleanFileName('C:\\fakepath\\holiday\n pic.jpg')).toBe('holiday pic.jpg');
    expect(cleanFileName('')).toBe('Photo');
  });
});

describe('palette extraction', () => {
  it('finds the dominant colours, most common first', () => {
    const data = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) data.set(i < 70 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
    const palette = extractPalette(data);
    expect(palette[0]).toBe('#FF0000');
    expect(palette).toContain('#0000FF');
    expect(extractPalette(new Uint8ClampedArray(16))).toEqual([]);
  });
});

describe('asset library', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    setStorageForTesting(null);
    // jsdom has no image codecs: a fake processor stands in for the worker (which also hashes the file).
    repo.setImageProcessorForTesting(async (input) => {
      const data = new Uint8Array(input.bytes instanceof Blob ? await input.bytes.arrayBuffer() : input.bytes);
      const blob = new Blob([data], { type: 'image/png' });
      return {
        width: 1200,
        height: 800,
        sourceWidth: 6000,
        sourceHeight: 4000,
        previewWidth: 1200,
        previewHeight: 800,
        hasAlpha: false,
        palette: ['#112233'],
        original: blob,
        originalMime: 'image/png',
        preview: blob,
        thumb: blob,
        hash: data.join('.'),
      };
    });
  });

  const file = (content: number[], name = 'photo.png') => new File([bytes(content)], name, { type: 'image/png' });

  it('imports, de-duplicates identical files and reports big photos as optimised', async () => {
    const first = await repo.importImageFile(file(PNG));
    expect(first.reused).toBe(false);
    expect(first.optimized).toBe(true);
    expect(first.meta).toMatchObject({ kind: 'photo', width: 1200, height: 800, name: 'photo.png', palette: ['#112233'] });
    const again = await repo.importImageFile(file(PNG, 'copy.png'));
    expect(again.reused).toBe(true);
    expect(again.meta.id).toBe(first.meta.id);
    // Same bytes imported as a sticker is a separate library entry.
    const sticker = await repo.importImageFile(file(PNG), 'sticker');
    expect(sticker.meta.id).not.toBe(first.meta.id);
    expect(await repo.listAssets()).toHaveLength(2);
    // (fake-indexeddb can't round-trip jsdom Blobs faithfully, so just check the variant exists.)
    expect(await repo.getAssetBlob(first.meta.id, 'thumb')).toBeTruthy();
    expect(await repo.getAssetBlob('as_missing', 'thumb')).toBeUndefined();
  });

  it('rejects files that aren’t images with a friendly message', async () => {
    const fake = new File([new TextEncoder().encode('<html>not an image</html>')], 'evil.png', { type: 'image/png' });
    await expect(repo.importImageFile(fake)).rejects.toBeInstanceOf(ImportError);
    await expect(repo.importImageFile(new File([], 'empty.png'))).rejects.toMatchObject({ code: 'empty' });
    expect(repo.describeImportError(new ImportError('heic')).title).toMatch(/HEIC/);
    expect(repo.describeImportError(new Error('boom')).title).toMatch(/couldn’t read/);
  });

  it('knows which designs use which photos and cleans up the rest', async () => {
    const used = (await repo.importImageFile(file(PNG))).meta;
    const unused = (await repo.importImageFile(file(JPEG, 'b.jpg'))).meta;
    const sticker = (await repo.importImageFile(file([...PNG, 1]), 'sticker')).meta;
    const frame: ImageElement = {
      id: 'el_1',
      type: 'image',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      assetId: used.id,
      fit: 'cover',
    };
    const doc: DesignDocument = { ...createDocument({ width: 100, height: 100 }), elements: [frame] };
    const project = await projects.createProject({ format: 'post', doc });
    // Trashed projects still count as using their photos.
    await projects.trashProject(project.meta.id);
    expect((await repo.assetUsage()).get(used.id)).toEqual([project.meta.id]);

    const result = await repo.cleanupUnusedAssets();
    expect(result.count).toBe(1);
    const left = (await repo.listAssets()).map((a) => a.id);
    expect(left).toContain(used.id);
    expect(left).toContain(sticker.id);
    expect(left).not.toContain(unused.id);
  });

  it('collects every asset an element depends on', () => {
    const el: ImageElement = {
      id: 'e',
      type: 'image',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: 1,
      assetId: 'as_photo',
      fit: 'cover',
      cutout: { maskAssetId: 'as_mask', feather: 5, backdrop: { type: 'image', assetId: 'as_bg' } },
    };
    expect(repo.elementAssetIds(el)).toEqual(['as_photo', 'as_mask', 'as_bg']);
  });
});

describe('image element schema', () => {
  const base = {
    id: 'e',
    type: 'image',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    assetId: 'as_abc',
    fit: 'cover',
  };

  it('accepts every photo edit', () => {
    const ok = elementSchema.safeParse({
      ...base,
      zoom: 1.5,
      straighten: -12,
      flipX: true,
      turns: 3,
      clip: 'heart',
      adjust: { exposure: 20, grain: 40, vignette: -30 },
      curves: {
        rgb: [
          { x: 0, y: 0.1 },
          { x: 1, y: 0.9 },
        ],
      },
      perspective: { vertical: 30, horizontal: 0 },
      cutout: { maskAssetId: 'as_mask', feather: 10, backdrop: { type: 'blur', amount: 50 }, method: 'ai' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects out-of-range or hostile values', () => {
    expect(elementSchema.safeParse({ ...base, zoom: 0.2 }).success).toBe(false);
    expect(elementSchema.safeParse({ ...base, turns: 5 }).success).toBe(false);
    expect(elementSchema.safeParse({ ...base, adjust: { exposure: 500 } }).success).toBe(false);
    expect(elementSchema.safeParse({ ...base, assetId: '../../etc/passwd' }).success).toBe(false);
    expect(elementSchema.safeParse({ ...base, clip: 'blob' }).success).toBe(false);
    expect(
      elementSchema.safeParse({ ...base, cutout: { maskAssetId: 'm', feather: 1, backdrop: { type: 'image', assetId: 'x"y' } } })
        .success,
    ).toBe(false);
  });
});
