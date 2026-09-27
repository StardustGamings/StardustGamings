import type { Folder } from '@/types/project';
import { getStorage } from '@/storage/db';
import { notify } from '@/storage/sync';
import { createId } from '@/utils/id';
import { listProjects, moveProjects, sanitizeName } from './repository';

/** Folders on the projects screen. A project is in at most one folder. */

export const MAX_FOLDER_NAME = 40;
export const FOLDER_COLORS = ['#C6FF3D', '#3CF0C8', '#3C9BFF', '#A06BFF', '#FF5CAA', '#FF6B5C', '#FFB443', '#9AA3B5'] as const;

export class FolderNotFoundError extends Error {
  constructor(id: string) {
    super(`Folder ${id} not found`);
    this.name = 'FolderNotFoundError';
  }
}

export const folderName = (name: string) => sanitizeName(name, 'New folder').slice(0, MAX_FOLDER_NAME).trim();

const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

export async function listFolders(): Promise<Folder[]> {
  return (await (await getStorage()).getAllFolders()).sort(byName);
}

export async function createFolder(name: string, color?: string): Promise<Folder> {
  const storage = await getStorage();
  const existing = await storage.getAllFolders();
  const now = Date.now();
  const folder: Folder = {
    id: createId('fld'),
    name: folderName(name),
    color: color ?? FOLDER_COLORS[existing.length % FOLDER_COLORS.length]!,
    createdAt: now,
    updatedAt: now,
  };
  await storage.putFolder(folder);
  notify({ type: 'library' });
  return folder;
}

export async function updateFolder(id: string, patch: { name?: string; color?: string }): Promise<Folder> {
  const storage = await getStorage();
  const folder = (await storage.getAllFolders()).find((f) => f.id === id);
  if (!folder) throw new FolderNotFoundError(id);
  const next: Folder = {
    ...folder,
    ...(patch.name !== undefined ? { name: folderName(patch.name) } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    updatedAt: Date.now(),
  };
  await storage.putFolder(next);
  notify({ type: 'library' });
  return next;
}

/** Deletes a folder. Its projects are kept — they just aren't in a folder any more. Returns how many moved out. */
export async function deleteFolder(id: string): Promise<number> {
  const inside = (await listProjects()).filter((p) => p.folderId === id).map((p) => p.id);
  await moveProjects(inside, null);
  await (await getStorage()).deleteFolder(id);
  notify({ type: 'library' });
  return inside.length;
}

/**
 * Stores a folder that came from a backup. A folder with the same name is
 * reused; otherwise the original id is kept when it's free. Returns the id to use.
 */
export async function adoptFolder(folder: Folder): Promise<string> {
  const storage = await getStorage();
  const existing = await storage.getAllFolders();
  const name = folderName(folder.name);
  const same = existing.find((f) => f.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (same) return same.id;
  const id = existing.some((f) => f.id === folder.id) ? createId('fld') : folder.id;
  await storage.putFolder({ ...folder, id, name });
  return id;
}
