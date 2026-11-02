import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { setStorageForTesting } from '@/storage/db';
import * as folders from './folders';
import * as repo from './repository';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setStorageForTesting(null);
});

describe('folders', () => {
  it('creates, renames, recolours and lists folders by name', async () => {
    const b = await folders.createFolder('  Client   work ');
    const a = await folders.createFolder('Aesthetic dumps');
    expect(b.name).toBe('Client work');
    expect(a.color).not.toBe(b.color);
    expect((await folders.listFolders()).map((f) => f.name)).toEqual(['Aesthetic dumps', 'Client work']);

    const renamed = await folders.updateFolder(b.id, { name: 'Brands', color: '#FF5CAA' });
    expect(renamed).toMatchObject({ name: 'Brands', color: '#FF5CAA' });
    expect((await folders.createFolder('   ')).name).toBe('New folder');
    await expect(folders.updateFolder('nope', { name: 'x' })).rejects.toThrow(folders.FolderNotFoundError);
  });

  it('moves projects in and out without touching “last edited”', async () => {
    const folder = await folders.createFolder('Trips');
    const p1 = await repo.createProject({ format: 'post', name: 'One' });
    const p2 = await repo.createProject({ format: 'post', name: 'Two' });
    const moved = await repo.moveProjects([p1.meta.id, p2.meta.id], folder.id);
    expect(moved.every((m) => m.folderId === folder.id)).toBe(true);
    expect(moved[0]!.updatedAt).toBe(p1.meta.updatedAt);

    // Deleting the folder keeps its projects.
    expect(await folders.deleteFolder(folder.id)).toBe(2);
    const list = await repo.listProjects();
    expect(list).toHaveLength(2);
    expect(list.every((p) => p.folderId === null)).toBe(true);
    expect(await folders.listFolders()).toEqual([]);
  });

  it('adopts folders from a backup, merging by name', async () => {
    const mine = await folders.createFolder('Trips');
    const same = await folders.adoptFolder({ id: 'fld_other', name: 'trips', color: '#000000', createdAt: 1, updatedAt: 1 });
    expect(same).toBe(mine.id);
    const fresh = await folders.adoptFolder({ id: 'fld_new', name: 'Brands', color: '#3C9BFF', createdAt: 1, updatedAt: 1 });
    expect(fresh).toBe('fld_new');
    const clash = await folders.adoptFolder({ id: 'fld_new', name: 'Other', color: '#3C9BFF', createdAt: 1, updatedAt: 1 });
    expect(clash).not.toBe('fld_new');
    expect(await folders.listFolders()).toHaveLength(3);
  });
});
