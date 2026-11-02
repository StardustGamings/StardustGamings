import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage, setStorageForTesting } from '@/storage/db';
import { loadBundledTemplate } from '@/templates/registry';
import { insertSlide } from './document';
import * as repo from './repository';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setStorageForTesting(null);
});

describe('project repository (IndexedDB)', () => {
  it('creates, lists and loads a project', async () => {
    const created = await repo.createProject({ format: 'carousel', slideCount: 4, name: '  My   first   carousel ' });
    expect(created.meta.name).toBe('My first carousel');
    expect(created.doc.slides).toHaveLength(4);
    expect(await repo.storageKind()).toBe('indexeddb');

    const list = await repo.listProjects();
    expect(list.map((p) => p.id)).toEqual([created.meta.id]);

    const loaded = await repo.getProject(created.meta.id);
    expect(loaded?.doc).toEqual(created.doc);
  });

  it('uses the format defaults and a friendly default name', async () => {
    const { meta, doc } = await repo.createProject({ format: 'thumbnail' });
    expect(doc.slideWidth).toBe(1280);
    expect(doc.slideHeight).toBe(720);
    expect(meta.name).toMatch(/^Thumbnail · /);
  });

  it('supports custom sizes', async () => {
    const { doc } = await repo.createProject({ format: 'post', sizeId: 'custom', customSize: { width: 2000, height: 500 } });
    expect([doc.slideWidth, doc.slideHeight]).toEqual([2000, 500]);
  });

  it('creates from a template with fresh ids', async () => {
    const template = (await loadBundledTemplate('film-strip'))!;
    const { doc } = await repo.createProject({ format: template.format, doc: template.doc, templateId: template.id });
    expect(doc.elements).toHaveLength(template.doc.elements.length);
    expect(doc.elements[0]!.id).not.toBe(template.doc.elements[0]!.id);
  });

  it('saves documents and bumps updatedAt + slide count', async () => {
    const { meta, doc } = await repo.createProject({ format: 'carousel', slideCount: 2 });
    await new Promise((r) => setTimeout(r, 5));
    const saved = await repo.saveDocument(meta.id, insertSlide(doc, 2));
    expect(saved.slideCount).toBe(3);
    expect(saved.updatedAt).toBeGreaterThan(meta.updatedAt);
    expect((await repo.getProject(meta.id))?.doc.slides).toHaveLength(3);
  });

  it('keeps size and format in step with the document (resize in place, and its undo)', async () => {
    const { meta, doc } = await repo.createProject({ format: 'post' });
    const resized = await repo.setProjectSize(meta.id, 'story', 'story');
    expect(resized.updatedAt).toBe(meta.updatedAt);
    const story = { ...doc, slideWidth: 1080, slideHeight: 1920 };
    expect(await repo.saveDocument(meta.id, story)).toMatchObject({ sizeId: 'story', format: 'story' });
    // Undo: the document is 4:5 again, so the project is a post again.
    expect(await repo.saveDocument(meta.id, doc)).toMatchObject({ sizeId: 'ig-portrait', format: 'post' });
    // A carousel that goes to 1:1 stays a carousel; an odd size is custom and keeps its format.
    const c = await repo.createProject({ format: 'carousel', slideCount: 3 });
    expect(await repo.saveDocument(c.meta.id, { ...c.doc, slideWidth: 1080, slideHeight: 1080 })).toMatchObject({
      sizeId: 'ig-square',
      format: 'carousel',
    });
    expect(await repo.saveDocument(c.meta.id, { ...c.doc, slideWidth: 1234, slideHeight: 1080 })).toMatchObject({
      sizeId: 'custom',
      format: 'carousel',
    });
  });

  it('sanitises names', () => {
    expect(repo.sanitizeName('\u0000hello\nworld')).toBe('hello world');
    expect(repo.sanitizeName('   ')).toBe('Untitled design');
    expect(repo.sanitizeName('x'.repeat(200))).toHaveLength(repo.MAX_NAME_LENGTH);
  });

  it('renames, favourites and duplicates', async () => {
    const { meta } = await repo.createProject({ format: 'post', name: 'Original' });
    expect((await repo.renameProject(meta.id, 'Renamed')).name).toBe('Renamed');
    expect((await repo.setFavorite(meta.id, true)).favorite).toBe(true);
    const copy = await repo.duplicateProject(meta.id);
    expect(copy.meta.name).toBe('Renamed (copy)');
    expect(copy.meta.id).not.toBe(meta.id);
    expect(copy.meta.favorite).toBe(false);
    expect(await repo.listProjects()).toHaveLength(2);
  });

  it('moves to trash, restores, and deletes forever', async () => {
    const { meta } = await repo.createProject({ format: 'story' });
    expect((await repo.trashProject(meta.id)).deletedAt).not.toBeNull();
    expect((await repo.restoreProject(meta.id)).deletedAt).toBeNull();
    await repo.trashProject(meta.id);
    expect(await repo.emptyTrash()).toBe(1);
    expect(await repo.getProject(meta.id)).toBeNull();
  });

  it('purges trash older than the retention window', async () => {
    const old = await repo.createProject({ format: 'post' });
    const recent = await repo.createProject({ format: 'post' });
    await repo.trashProject(old.meta.id);
    await repo.trashProject(recent.meta.id);
    const future = Date.now() + (repo.TRASH_RETENTION_DAYS + 1) * 24 * 3600e3;
    expect(await repo.purgeExpiredTrash(future)).toBe(2);
    expect(await repo.purgeExpiredTrash()).toBe(0);
  });

  it('stores and retrieves thumbnails', async () => {
    const { meta } = await repo.createProject({ format: 'post' });
    await repo.saveThumbnail(meta.id, new Blob(['png'], { type: 'image/png' }));
    const blob = await repo.getThumbnail(meta.id);
    expect(blob).not.toBeNull();
    await repo.deleteProjectForever(meta.id);
    expect(await repo.getThumbnail(meta.id)).toBeNull();
  });

  it('throws a typed error for unknown projects', async () => {
    await expect(repo.renameProject('nope', 'x')).rejects.toBeInstanceOf(repo.ProjectNotFoundError);
  });
});

describe('memory fallback storage', () => {
  it('behaves like IndexedDB and isolates copies', async () => {
    setStorageForTesting(new MemoryStorage());
    const { meta, doc } = await repo.createProject({ format: 'post' });
    doc.slides.push({ id: 'mutated', fill: null });
    expect((await repo.getProject(meta.id))?.doc.slides).toHaveLength(1);
    expect(await repo.storageKind()).toBe('memory');
  });

  it('refuses to save over a newer copy (another tab saved since)', async () => {
    const { meta, doc } = await repo.createProject({ format: 'post' });
    const first = await repo.saveDocument(meta.id, doc, { expectedUpdatedAt: meta.updatedAt });
    await new Promise((r) => setTimeout(r, 5));
    // Another tab saves…
    await repo.saveDocument(meta.id, insertSlide(doc, 1));
    // …so a save based on the older copy is refused instead of overwriting it.
    await expect(repo.saveDocument(meta.id, doc, { expectedUpdatedAt: first.updatedAt })).rejects.toThrow(repo.SaveConflictError);
    expect((await repo.getProject(meta.id))!.doc.slides).toHaveLength(2);
  });
});
