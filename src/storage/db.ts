import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DesignDocument } from '@/types/document';
import type { Folder, ProjectMeta, VersionRecord } from '@/types/project';
import type { AssetBlobs, AssetMeta, AssetVariant } from '@/assets/types';
import type { UserTemplate } from '@/templates/user';
import type { UserFontRecord } from '@/typography/user-font-types';

export const DB_NAME = 'stardeck';
/** v1: projects, documents, thumbnails · v2: assets + asset blobs · v3: user templates · v4: versions + folders · v5: fonts. */
export const DB_VERSION = 5;

const VARIANTS: AssetVariant[] = ['original', 'preview', 'thumb'];
const blobKey = (id: string, variant: AssetVariant) => `${id}/${variant}`;

export interface DocumentRecord {
  id: string;
  doc: DesignDocument;
}

export interface ThumbnailRecord {
  id: string;
  blob: Blob;
  updatedAt: number;
}

export interface AssetBlobRecord {
  key: string;
  blob: Blob;
}

interface StardeckSchema extends DBSchema {
  projects: { key: string; value: ProjectMeta; indexes: { 'by-updated': number } };
  documents: { key: string; value: DocumentRecord };
  thumbnails: { key: string; value: ThumbnailRecord };
  assets: { key: string; value: AssetMeta; indexes: { 'by-hash': string } };
  assetBlobs: { key: string; value: AssetBlobRecord };
  templates: { key: string; value: UserTemplate };
  versions: { key: string; value: VersionRecord; indexes: { 'by-project': string } };
  folders: { key: string; value: Folder };
  fonts: { key: string; value: UserFontRecord };
}

/**
 * Persistence boundary for projects. The IndexedDB implementation is the real
 * thing; the in-memory one keeps the app fully usable where IndexedDB is blocked
 * (some private-browsing modes) — the UI warns that work won't survive a reload.
 */
export interface ProjectStorage {
  readonly kind: 'indexeddb' | 'memory';
  getAllMeta(): Promise<ProjectMeta[]>;
  getMeta(id: string): Promise<ProjectMeta | undefined>;
  putMeta(meta: ProjectMeta): Promise<void>;
  getDocument(id: string): Promise<DesignDocument | undefined>;
  /** Writes meta + document atomically. */
  putProject(meta: ProjectMeta, doc: DesignDocument): Promise<void>;
  /** Removes meta, document, thumbnail and version history atomically. */
  deleteProject(id: string): Promise<void>;
  getThumbnail(id: string): Promise<ThumbnailRecord | undefined>;
  putThumbnail(record: ThumbnailRecord): Promise<void>;
  getAllThumbnails(): Promise<ThumbnailRecord[]>;
  /** Every stored document — used to find which assets are still referenced. */
  getAllDocuments(): Promise<DocumentRecord[]>;
  getAllAssetMeta(): Promise<AssetMeta[]>;
  getAssetMeta(id: string): Promise<AssetMeta | undefined>;
  findAssetByHash(hash: string): Promise<AssetMeta[]>;
  getAssetBlob(id: string, variant: AssetVariant): Promise<Blob | undefined>;
  /** Writes meta + all variants atomically. */
  putAsset(meta: AssetMeta, blobs: AssetBlobs): Promise<void>;
  deleteAssets(ids: string[]): Promise<void>;
  getAllTemplates(): Promise<UserTemplate[]>;
  putTemplate(template: UserTemplate): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  getVersions(projectId: string): Promise<VersionRecord[]>;
  getVersion(id: string): Promise<VersionRecord | undefined>;
  getAllVersions(): Promise<VersionRecord[]>;
  putVersion(version: VersionRecord): Promise<void>;
  deleteVersions(ids: string[]): Promise<void>;
  getAllFolders(): Promise<Folder[]>;
  putFolder(folder: Folder): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  /** Fonts the person added (files kept on this device). */
  getAllFonts(): Promise<UserFontRecord[]>;
  putFont(font: UserFontRecord): Promise<void>;
  deleteFont(id: string): Promise<void>;
  /** Removes projects, templates, assets, versions, folders and fonts. */
  clearAll(): Promise<void>;
}

class IndexedDbStorage implements ProjectStorage {
  readonly kind = 'indexeddb' as const;
  constructor(private readonly db: IDBPDatabase<StardeckSchema>) {}

  getAllMeta() {
    return this.db.getAll('projects');
  }
  getMeta(id: string) {
    return this.db.get('projects', id);
  }
  async putMeta(meta: ProjectMeta) {
    await this.db.put('projects', meta);
  }
  async getDocument(id: string) {
    return (await this.db.get('documents', id))?.doc;
  }
  async putProject(meta: ProjectMeta, doc: DesignDocument) {
    const tx = this.db.transaction(['projects', 'documents'], 'readwrite');
    const requests: Promise<unknown>[] = [];
    try {
      requests.push(tx.objectStore('projects').put(meta));
      requests.push(tx.objectStore('documents').put({ id: meta.id, doc }));
      await Promise.all([...requests, tx.done]);
    } catch (e) {
      // All or nothing: never leave the meta and the document out of step (e.g. when the disk is full).
      for (const r of [...requests, tx.done]) r.catch(() => undefined);
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
      throw e;
    }
  }
  async deleteProject(id: string) {
    const tx = this.db.transaction(['projects', 'documents', 'thumbnails', 'versions'], 'readwrite');
    const versions = tx.objectStore('versions');
    const versionIds = await versions.index('by-project').getAllKeys(id);
    await Promise.all([
      tx.objectStore('projects').delete(id),
      tx.objectStore('documents').delete(id),
      tx.objectStore('thumbnails').delete(id),
      ...versionIds.map((key) => versions.delete(key)),
      tx.done,
    ]);
  }
  getThumbnail(id: string) {
    return this.db.get('thumbnails', id);
  }
  async putThumbnail(record: ThumbnailRecord) {
    await this.db.put('thumbnails', record);
  }
  getAllThumbnails() {
    return this.db.getAll('thumbnails');
  }
  getAllDocuments() {
    return this.db.getAll('documents');
  }
  getAllAssetMeta() {
    return this.db.getAll('assets');
  }
  getAssetMeta(id: string) {
    return this.db.get('assets', id);
  }
  findAssetByHash(hash: string) {
    return this.db.getAllFromIndex('assets', 'by-hash', hash);
  }
  async getAssetBlob(id: string, variant: AssetVariant) {
    return (await this.db.get('assetBlobs', blobKey(id, variant)))?.blob;
  }
  async putAsset(meta: AssetMeta, blobs: AssetBlobs) {
    const tx = this.db.transaction(['assets', 'assetBlobs'], 'readwrite');
    const store = tx.objectStore('assetBlobs');
    await Promise.all([
      tx.objectStore('assets').put(meta),
      ...VARIANTS.map((v) => store.put({ key: blobKey(meta.id, v), blob: blobs[v] })),
      tx.done,
    ]);
  }
  async deleteAssets(ids: string[]) {
    if (ids.length === 0) return;
    const tx = this.db.transaction(['assets', 'assetBlobs'], 'readwrite');
    const blobs = tx.objectStore('assetBlobs');
    await Promise.all([
      ...ids.map((id) => tx.objectStore('assets').delete(id)),
      ...ids.flatMap((id) => VARIANTS.map((v) => blobs.delete(blobKey(id, v)))),
      tx.done,
    ]);
  }
  getAllTemplates() {
    return this.db.getAll('templates');
  }
  async putTemplate(template: UserTemplate) {
    await this.db.put('templates', template);
  }
  async deleteTemplate(id: string) {
    await this.db.delete('templates', id);
  }
  getVersions(projectId: string) {
    return this.db.getAllFromIndex('versions', 'by-project', projectId);
  }
  getVersion(id: string) {
    return this.db.get('versions', id);
  }
  getAllVersions() {
    return this.db.getAll('versions');
  }
  async putVersion(version: VersionRecord) {
    await this.db.put('versions', version);
  }
  async deleteVersions(ids: string[]) {
    if (ids.length === 0) return;
    const tx = this.db.transaction('versions', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
  getAllFolders() {
    return this.db.getAll('folders');
  }
  async putFolder(folder: Folder) {
    await this.db.put('folders', folder);
  }
  async deleteFolder(id: string) {
    await this.db.delete('folders', id);
  }
  getAllFonts() {
    return this.db.getAll('fonts');
  }
  async putFont(font: UserFontRecord) {
    await this.db.put('fonts', font);
  }
  async deleteFont(id: string) {
    await this.db.delete('fonts', id);
  }
  async clearAll() {
    const stores = [
      'projects',
      'documents',
      'thumbnails',
      'assets',
      'assetBlobs',
      'templates',
      'versions',
      'folders',
      'fonts',
    ] as const;
    const tx = this.db.transaction([...stores], 'readwrite');
    await Promise.all([...stores.map((name) => tx.objectStore(name).clear()), tx.done]);
  }
}

export class MemoryStorage implements ProjectStorage {
  readonly kind = 'memory' as const;
  private metas = new Map<string, ProjectMeta>();
  private docs = new Map<string, DesignDocument>();
  private thumbs = new Map<string, ThumbnailRecord>();
  private assets = new Map<string, AssetMeta>();
  private assetBlobs = new Map<string, Blob>();
  private templates = new Map<string, UserTemplate>();
  private versions = new Map<string, VersionRecord>();
  private folders = new Map<string, Folder>();
  private fonts = new Map<string, UserFontRecord>();

  async getAllMeta() {
    return [...this.metas.values()].map((m) => ({ ...m }));
  }
  async getMeta(id: string) {
    const m = this.metas.get(id);
    return m ? { ...m } : undefined;
  }
  async putMeta(meta: ProjectMeta) {
    this.metas.set(meta.id, { ...meta });
  }
  async getDocument(id: string) {
    const d = this.docs.get(id);
    return d ? structuredClone(d) : undefined;
  }
  async putProject(meta: ProjectMeta, doc: DesignDocument) {
    this.metas.set(meta.id, { ...meta });
    this.docs.set(meta.id, structuredClone(doc));
  }
  async deleteProject(id: string) {
    this.metas.delete(id);
    this.docs.delete(id);
    this.thumbs.delete(id);
    for (const v of [...this.versions.values()]) if (v.projectId === id) this.versions.delete(v.id);
  }
  async getThumbnail(id: string) {
    return this.thumbs.get(id);
  }
  async putThumbnail(record: ThumbnailRecord) {
    this.thumbs.set(record.id, record);
  }
  async getAllThumbnails() {
    return [...this.thumbs.values()];
  }
  async getAllDocuments() {
    return [...this.docs.entries()].map(([id, doc]) => ({ id, doc: structuredClone(doc) }));
  }
  async getAllAssetMeta() {
    return [...this.assets.values()].map((a) => ({ ...a }));
  }
  async getAssetMeta(id: string) {
    const a = this.assets.get(id);
    return a ? { ...a } : undefined;
  }
  async findAssetByHash(hash: string) {
    return [...this.assets.values()].filter((a) => a.hash === hash).map((a) => ({ ...a }));
  }
  async getAssetBlob(id: string, variant: AssetVariant) {
    return this.assetBlobs.get(blobKey(id, variant));
  }
  async putAsset(meta: AssetMeta, blobs: AssetBlobs) {
    this.assets.set(meta.id, { ...meta });
    for (const v of VARIANTS) this.assetBlobs.set(blobKey(meta.id, v), blobs[v]);
  }
  async deleteAssets(ids: string[]) {
    for (const id of ids) {
      this.assets.delete(id);
      for (const v of VARIANTS) this.assetBlobs.delete(blobKey(id, v));
    }
  }
  async getAllTemplates() {
    return [...this.templates.values()].map((t) => structuredClone(t));
  }
  async putTemplate(template: UserTemplate) {
    this.templates.set(template.id, structuredClone(template));
  }
  async deleteTemplate(id: string) {
    this.templates.delete(id);
  }
  async getVersions(projectId: string) {
    return [...this.versions.values()].filter((v) => v.projectId === projectId).map((v) => structuredClone(v));
  }
  async getVersion(id: string) {
    const v = this.versions.get(id);
    return v ? structuredClone(v) : undefined;
  }
  async getAllVersions() {
    return [...this.versions.values()].map((v) => structuredClone(v));
  }
  async putVersion(version: VersionRecord) {
    this.versions.set(version.id, structuredClone(version));
  }
  async deleteVersions(ids: string[]) {
    for (const id of ids) this.versions.delete(id);
  }
  async getAllFolders() {
    return [...this.folders.values()].map((f) => ({ ...f }));
  }
  async putFolder(folder: Folder) {
    this.folders.set(folder.id, { ...folder });
  }
  async deleteFolder(id: string) {
    this.folders.delete(id);
  }
  async getAllFonts() {
    return [...this.fonts.values()].map((f) => ({ ...f }));
  }
  async putFont(font: UserFontRecord) {
    this.fonts.set(font.id, { ...font });
  }
  async deleteFont(id: string) {
    this.fonts.delete(id);
  }
  async clearAll() {
    this.fonts.clear();
    this.versions.clear();
    this.folders.clear();
    this.templates.clear();
    this.metas.clear();
    this.docs.clear();
    this.thumbs.clear();
    this.assets.clear();
    this.assetBlobs.clear();
  }
}

let storagePromise: Promise<ProjectStorage> | null = null;

async function open(): Promise<ProjectStorage> {
  if (typeof indexedDB === 'undefined') return new MemoryStorage();
  try {
    const db = await openDB<StardeckSchema>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const projects = database.createObjectStore('projects', { keyPath: 'id' });
          projects.createIndex('by-updated', 'updatedAt');
          database.createObjectStore('documents', { keyPath: 'id' });
          database.createObjectStore('thumbnails', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          const assets = database.createObjectStore('assets', { keyPath: 'id' });
          assets.createIndex('by-hash', 'hash');
          database.createObjectStore('assetBlobs', { keyPath: 'key' });
        }
        if (oldVersion < 3) database.createObjectStore('templates', { keyPath: 'id' });
        if (oldVersion < 4) {
          const versions = database.createObjectStore('versions', { keyPath: 'id' });
          versions.createIndex('by-project', 'projectId');
          database.createObjectStore('folders', { keyPath: 'id' });
        }
        if (oldVersion < 5) database.createObjectStore('fonts', { keyPath: 'id' });
      },
      blocking() {
        // Another tab wants to upgrade the schema — step aside so it can.
        db.close();
        storagePromise = null;
      },
    });
    return new IndexedDbStorage(db);
  } catch {
    return new MemoryStorage();
  }
}

export function getStorage(): Promise<ProjectStorage> {
  storagePromise ??= open();
  return storagePromise;
}

/** Test hook: swap the storage backend. */
export function setStorageForTesting(storage: ProjectStorage | null): void {
  storagePromise = storage ? Promise.resolve(storage) : null;
}
