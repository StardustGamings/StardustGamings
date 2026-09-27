import { deflateRawSync } from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssetMeta } from '@/assets/types';
import { sha256Hex } from '@/assets/process-core';
import type { DesignDocument } from '@/types/document';
import { crc32, createZip, createZipBlob } from '@/export/zip';
import * as folders from '@/projects/folders';
import * as repo from '@/projects/repository';
import * as versions from '@/projects/versions';
import { createText } from '@/editor/core/factory';
import { addUserFont, deleteUserFont, listUserFonts } from '@/typography/user-fonts';
import { getStorage, MemoryStorage, setStorageForTesting } from './db';
import { importProjectFile, ProjectFileError, remapAssets, writeProjectFile } from './project-file';
import { openZip, ZipReadError } from './unzip';

// Memory storage: fake-indexeddb can't round-trip jsdom Blobs (the IndexedDB paths are covered elsewhere).
beforeEach(() => setStorageForTesting(new MemoryStorage()));

// A real 1×1 PNG, and a JPEG header (enough for byte sniffing).
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

async function addPhoto(id: string, bytes: Uint8Array<ArrayBuffer>): Promise<AssetMeta> {
  const hash = await sha256Hex(bytes.slice().buffer);
  const meta: AssetMeta = {
    id,
    kind: 'photo',
    name: `${id}.jpg`,
    mime: 'image/jpeg',
    width: 1,
    height: 1,
    previewWidth: 1,
    previewHeight: 1,
    bytes: bytes.length * 3,
    createdAt: 1,
    hash,
    hasAlpha: false,
    palette: ['#112233'],
  };
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  await (await getStorage()).putAsset(meta, { original: blob, preview: blob, thumb: blob });
  return meta;
}

const withPhoto = (doc: DesignDocument, assetId: string): DesignDocument => ({
  ...doc,
  elements: [
    ...doc.elements,
    {
      id: `el-${assetId}`,
      type: 'image',
      name: 'Photo',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      assetId,
      fit: 'cover',
    } as DesignDocument['elements'][number],
  ],
});

describe('ZIP reader', () => {
  it('reads back stored entries and checks CRCs', async () => {
    const blob = await createZipBlob([
      { name: 'a.txt', data: new TextEncoder().encode('hello') },
      { name: 'b/c.png', data: new Blob([PNG]) },
    ]);
    const zip = await openZip(blob);
    expect([...zip.entries.keys()]).toEqual(['a.txt', 'b/c.png']);
    expect(await zip.text('a.txt')).toBe('hello');
    expect([...(await zip.bytes('b/c.png'))]).toEqual([...PNG]);

    const corrupt = new Uint8Array(await blob.arrayBuffer());
    const at = 30 + 'a.txt'.length;
    corrupt[at] = corrupt[at]! ^ 0xff;
    await expect((await openZip(new Blob([corrupt]))).text('a.txt')).rejects.toThrow(ZipReadError);
  });

  it('reads deflated entries (archives re-zipped by other apps)', async () => {
    const data = new TextEncoder().encode('carousel '.repeat(200));
    const packed = deflateRawSync(data);
    // Stored ZIP with the entry's method patched to deflate and sizes adjusted.
    const zip = createZip([{ name: 'x.txt', data: new Uint8Array(packed) }]);
    const v = new DataView(zip.buffer);
    const central = v.getUint32(zip.length - 22 + 16, true);
    for (const [at, crcAt] of [
      [8, 14],
      [central + 10, central + 16],
    ] as const) {
      v.setUint16(at, 8, true);
      v.setUint32(crcAt, crc32(data), true);
      v.setUint32(crcAt + 8, data.length, true);
    }
    expect(await (await openZip(new Blob([zip]))).text('x.txt')).toBe('carousel '.repeat(200));
  });

  it('ignores unsafe paths and rejects non-ZIP files', async () => {
    const zip = await openZip(
      new Blob([
        createZip([
          { name: '../evil.json', data: new Uint8Array([1]) },
          { name: 'ok', data: new Uint8Array([2]) },
        ]),
      ]),
    );
    expect([...zip.entries.keys()]).toEqual(['ok']);
    await expect(openZip(new Blob(['definitely not a zip file, just text that is long enough']))).rejects.toThrow(ZipReadError);
  });
});

describe('project files', () => {
  it('backs up everything and restores it on an empty device, keeping ids', async () => {
    await addPhoto('as_one', JPEG);
    await addPhoto('as_unused', PNG);
    const folder = await folders.createFolder('Trips');
    const a = await repo.createProject({ format: 'carousel', slideCount: 2, name: 'Lisbon dump' });
    const docA = withPhoto(a.doc, 'as_one');
    await repo.saveDocument(a.meta.id, docA);
    await repo.moveProjects([a.meta.id], folder.id);
    await repo.setFavorite(a.meta.id, true);
    await versions.createVersion(a.meta.id, a.doc, { kind: 'manual', name: 'Blank start' });
    const b = await repo.createProject({ format: 'post', name: 'Trashed one' });
    await repo.trashProject(b.meta.id);

    const { file, projects, photos } = await writeProjectFile('all', { kind: 'backup' });
    expect(file.name).toMatch(/^stardeck-backup-\d{4}-\d\d-\d\d\.stardeck$/);
    expect(projects).toBe(1);
    expect(photos).toBe(2);

    await repo.clearAllProjects();
    const report = await importProjectFile(file);
    expect(report).toMatchObject({
      kind: 'backup',
      unchanged: 0,
      versions: 1,
      folders: 1,
      skipped: 0,
      photos: { added: 2, reused: 0 },
    });
    const [restored] = report.projects;
    expect(restored).toMatchObject({ id: a.meta.id, name: 'Lisbon dump', favorite: true, folderId: folder.id, slideCount: 2 });
    expect((await repo.getProject(a.meta.id))!.doc).toEqual(docA);
    expect((await versions.listVersions(a.meta.id)).map((v) => v.name)).toEqual(['Blank start']);
    expect((await folders.listFolders()).map((f) => f.name)).toEqual(['Trips']);
    const storage = await getStorage();
    expect((await storage.getAllAssetMeta()).map((x) => x.id).sort()).toEqual(['as_one', 'as_unused']);
    expect([...new Uint8Array(await (await storage.getAssetBlob('as_one', 'original'))!.arrayBuffer())]).toEqual([...JPEG]);

    // Importing the same backup again changes nothing.
    const again = await importProjectFile(file);
    expect(again).toMatchObject({ unchanged: 1, projects: [], photos: { added: 0, reused: 2 } });
    expect(await repo.listProjects()).toHaveLength(1);
  });

  it('shares one design with only its photos; a changed original is imported as a labelled copy', async () => {
    await addPhoto('as_used', JPEG);
    await addPhoto('as_other', PNG);
    const p = await repo.createProject({ format: 'post', name: 'Summer ✦' });
    await repo.saveDocument(p.meta.id, withPhoto(p.doc, 'as_used'));
    await versions.createVersion(p.meta.id, p.doc, { kind: 'auto' });

    const { file, photos } = await writeProjectFile([p.meta.id], { kind: 'project' });
    expect(file.name).toBe('summer.stardeck');
    expect(photos).toBe(1);
    const zip = await openZip(file);
    expect([...zip.entries.keys()].filter((k) => k.startsWith('assets/')).every((k) => k.startsWith('assets/as_used/'))).toBe(
      true,
    );
    const entry = JSON.parse(await zip.text(`projects/${p.meta.id}.json`));
    expect(entry.versions).toBeUndefined();

    // Unchanged here: importing it again adds nothing.
    expect(await importProjectFile(file)).toMatchObject({ projects: [], unchanged: 1 });

    // Edit it here, then import the file: both are kept.
    await repo.saveDocument(p.meta.id, p.doc);
    const report = await importProjectFile(file);
    expect(report.projects).toHaveLength(1);
    expect(report.projects[0]!.id).not.toBe(p.meta.id);
    expect(report.projects[0]!.name).toBe('Summer ✦ (imported)');
    expect(report.photos).toEqual({ added: 0, reused: 1 });
  });

  it('carries the fonts a design uses, and adds them on another device once', async () => {
    const woff2 = new Uint8Array([...'wOF2'].map((c) => c.charCodeAt(0)).concat(Array(40).fill(9)));
    const { font } = await addUserFont(new File([woff2], 'BrandSans-Bold.woff2'));
    await addUserFont(new File([woff2.map((b, i) => (i < 4 ? b : 3))], 'Unused.woff2'));
    const p = await repo.createProject({ format: 'post', name: 'Brand post' });
    const text = { ...createText(p.doc, { x: 540, y: 540 }), fontFamily: font.family };
    await repo.saveDocument(p.meta.id, { ...p.doc, elements: [...p.doc.elements, text] });

    const { file } = await writeProjectFile([p.meta.id], { kind: 'project' });
    const zip = await openZip(file);
    expect([...zip.entries.keys()].filter((k) => k.startsWith('fonts/'))).toEqual([`fonts/${font.id}.woff2`]);

    // Another device: the font arrives with the design, named as it was.
    setStorageForTesting(new MemoryStorage());
    const report = await importProjectFile(file);
    expect(report.fonts).toBe(1);
    const fonts = await listUserFonts();
    expect(fonts.map((f) => [f.family, f.format])).toEqual([[font.family, 'woff2']]);
    expect(await importProjectFile(file)).toMatchObject({ fonts: 0 });

    // A backup keeps every font, used or not.
    await deleteUserFont(fonts[0]!.id);
    setStorageForTesting(new MemoryStorage());
    await addUserFont(new File([woff2], 'BrandSans-Bold.woff2'));
    await addUserFont(new File([woff2.map((b, i) => (i < 4 ? b : 3))], 'Unused.woff2'));
    const backup = await writeProjectFile('all', { kind: 'backup' });
    setStorageForTesting(new MemoryStorage());
    expect(await importProjectFile(backup.file)).toMatchObject({ fonts: 2 });
  });

  it('refuses files that aren’t Stardeck files or come from a newer version, and skips damaged parts', async () => {
    const notOurs = await createZipBlob([{ name: 'hello.txt', data: new TextEncoder().encode('hi') }]);
    await expect(importProjectFile(notOurs)).rejects.toThrow(ProjectFileError);
    const newer = await createZipBlob([
      {
        name: 'stardeck.json',
        data: new TextEncoder().encode(
          JSON.stringify({ kind: 'stardeck-project', version: 99, createdAt: 1, projects: [], assets: [] }),
        ),
      },
    ]);
    await expect(importProjectFile(newer)).rejects.toThrow(/newer version/);

    const damaged = await createZipBlob([
      {
        name: 'stardeck.json',
        data: new TextEncoder().encode(
          JSON.stringify({
            kind: 'stardeck-project',
            version: 1,
            createdAt: 1,
            projects: [{ id: 'prj_x', path: 'projects/prj_x.json' }],
            assets: ['as_x'],
          }),
        ),
      },
      { name: 'projects/prj_x.json', data: new TextEncoder().encode('{"meta": {"id": "prj_x"}, "doc": {"version": 7}}') },
      {
        name: 'assets/as_x/asset.json',
        data: new TextEncoder().encode(
          JSON.stringify({
            id: 'as_x',
            kind: 'photo',
            name: 'x',
            width: 1,
            height: 1,
            previewWidth: 1,
            previewHeight: 1,
            createdAt: 1,
            hasAlpha: false,
            palette: [],
            files: { original: 'original.svg', preview: 'preview.svg', thumb: 'thumb.svg' },
          }),
        ),
      },
      // An SVG pretending to be a photo is refused.
      {
        name: 'assets/as_x/original.svg',
        data: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      },
    ]);
    const report = await importProjectFile(damaged);
    expect(report).toMatchObject({ projects: [], skipped: 2, photos: { added: 0, reused: 0 } });
    expect(await repo.listProjects()).toEqual([]);
  });

  it('remaps photos, cut-out masks and backdrops', () => {
    const doc = withPhoto(
      {
        version: 1,
        slideWidth: 10,
        slideHeight: 10,
        background: { type: 'solid', color: '#fff' },
        slides: [{ id: 's', fill: null }],
        elements: [],
      },
      'a',
    );
    const el = doc.elements[0] as Extract<DesignDocument['elements'][number], { type: 'image' }>;
    el.cutout = { maskAssetId: 'm', feather: 0, backdrop: { type: 'image', assetId: 'b' } };
    const out = remapAssets(
      doc,
      new Map([
        ['a', 'A'],
        ['m', 'M'],
        ['b', 'B'],
      ]),
    );
    const next = out.elements[0] as typeof el;
    expect([next.assetId, next.cutout!.maskAssetId, next.cutout!.backdrop]).toEqual(['A', 'M', { type: 'image', assetId: 'B' }]);
    expect((doc.elements[0] as typeof el).assetId).toBe('a');
  });
});
