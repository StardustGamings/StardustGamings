import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DesignDocument } from '@/types/document';
import type { ProjectMeta } from '@/types/project';

export const DB_NAME = 'stardeck';
export const DB_VERSION = 1;

export interface DocumentRecord {
  id: string;
  doc: DesignDocument;
}

export interface ThumbnailRecord {
  id: string;
  blob: Blob;
  updatedAt: number;
}

interface StardeckSchema extends DBSchema {
  projects: { key: string; value: ProjectMeta; indexes: { 'by-updated': number } };
  documents: { key: string; value: DocumentRecord };
  thumbnails: { key: string; value: ThumbnailRecord };
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
  /** Removes meta, document and thumbnail atomically. */
  deleteProject(id: string): Promise<void>;
  getThumbnail(id: string): Promise<ThumbnailRecord | undefined>;
  putThumbnail(record: ThumbnailRecord): Promise<void>;
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
    await Promise.all([tx.objectStore('projects').put(meta), tx.objectStore('documents').put({ id: meta.id, doc }), tx.done]);
  }
  async deleteProject(id: string) {
    const tx = this.db.transaction(['projects', 'documents', 'thumbnails'], 'readwrite');
    await Promise.all([
      tx.objectStore('projects').delete(id),
      tx.objectStore('documents').delete(id),
      tx.objectStore('thumbnails').delete(id),
      tx.done,
    ]);
  }
  getThumbnail(id: string) {
    return this.db.get('thumbnails', id);
  }
  async putThumbnail(record: ThumbnailRecord) {
    await this.db.put('thumbnails', record);
  }
  async clearAll() {
    const tx = this.db.transaction(['projects', 'documents', 'thumbnails'], 'readwrite');
    await Promise.all([
      tx.objectStore('projects').clear(),
      tx.objectStore('documents').clear(),
      tx.objectStore('thumbnails').clear(),
      tx.done,
    ]);
  }
}

export class MemoryStorage implements ProjectStorage {
  readonly kind = 'memory' as const;
  private metas = new Map<string, ProjectMeta>();
  private docs = new Map<string, DesignDocument>();
  private thumbs = new Map<string, ThumbnailRecord>();

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
  }
  async getThumbnail(id: string) {
    return this.thumbs.get(id);
  }
  async putThumbnail(record: ThumbnailRecord) {
    this.thumbs.set(record.id, record);
  }
  async clearAll() {
    this.metas.clear();
    this.docs.clear();
    this.thumbs.clear();
  }
}

let storagePromise: Promise<ProjectStorage> | null = null;

async function open(): Promise<ProjectStorage> {
  if (typeof indexedDB === 'undefined') return new MemoryStorage();
  try {
    const db = await openDB<StardeckSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const projects = database.createObjectStore('projects', { keyPath: 'id' });
        projects.createIndex('by-updated', 'updatedAt');
        database.createObjectStore('documents', { keyPath: 'id' });
        database.createObjectStore('thumbnails', { keyPath: 'id' });
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
