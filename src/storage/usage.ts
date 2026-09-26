import { getStorage } from './db';

/** What Stardeck keeps on this device, by kind (sizes are close estimates). */
export interface StorageBreakdown {
  projects: { count: number; trashed: number; bytes: number };
  photos: { count: number; bytes: number };
  stickers: { count: number; bytes: number };
  /** Cut-out masks — part of the photos they belong to. */
  masks: { count: number; bytes: number };
  versions: { count: number; named: number; bytes: number };
  templates: { count: number; bytes: number };
  folders: number;
  total: number;
}

const json = (value: unknown) => JSON.stringify(value).length;

export async function storageBreakdown(): Promise<StorageBreakdown> {
  const storage = await getStorage();
  const [metas, docs, thumbs, assets, versions, templates, folders] = await Promise.all([
    storage.getAllMeta(),
    storage.getAllDocuments(),
    storage.getAllThumbnails(),
    storage.getAllAssetMeta(),
    storage.getAllVersions(),
    storage.getAllTemplates(),
    storage.getAllFolders(),
  ]);
  const byKind = (kind: string) => {
    const list = assets.filter((a) => a.kind === kind);
    return { count: list.length, bytes: list.reduce((n, a) => n + a.bytes, 0) };
  };
  const out: Omit<StorageBreakdown, 'total'> = {
    projects: {
      count: metas.length,
      trashed: metas.filter((m) => m.deletedAt !== null).length,
      bytes: docs.reduce((n, d) => n + json(d.doc), 0) + thumbs.reduce((n, t) => n + t.blob.size, 0) + json(metas),
    },
    photos: byKind('photo'),
    stickers: byKind('sticker'),
    masks: byKind('mask'),
    versions: {
      count: versions.length,
      named: versions.filter((v) => v.name).length,
      bytes: versions.reduce((n, v) => n + v.bytes, 0),
    },
    templates: { count: templates.length, bytes: templates.reduce((n, t) => n + json(t), 0) },
    folders: folders.length,
  };
  const total =
    out.projects.bytes + out.photos.bytes + out.stickers.bytes + out.masks.bytes + out.versions.bytes + out.templates.bytes;
  return { ...out, total };
}

/** The browser's own numbers (all of this site's storage, including the offline app cache). */
export async function browserEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

/** Below this much free space (or 90% full) the app warns before saves start failing. */
export const LOW_SPACE_BYTES = 200 * 1024 * 1024;

export function isLowOnSpace(estimate: { usage: number; quota: number } | null): boolean {
  if (!estimate || estimate.quota <= 0) return false;
  return estimate.quota - estimate.usage < LOW_SPACE_BYTES || estimate.usage / estimate.quota > 0.9;
}
