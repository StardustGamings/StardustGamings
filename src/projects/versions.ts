import type { DesignDocument } from '@/types/document';
import type { Project, VersionKind, VersionRecord } from '@/types/project';
import { getStorage } from '@/storage/db';
import { notify } from '@/storage/sync';
import { createId } from '@/utils/id';
import { getProject, MAX_NAME_LENGTH, ProjectNotFoundError, createProject, sanitizeName } from './repository';

/**
 * Version history: saved states of a design, kept on this device next to it.
 *
 * Retention (per project):
 * - every version from the last hour,
 * - the newest version of each hour for the last day,
 * - the newest version of each day for the last 30 days,
 * - named versions until they're deleted.
 */

const HOUR = 3600e3;
const DAY = 24 * HOUR;
export const AUTO_VERSION_INTERVAL = 10 * 60e3;
export const VERSION_RETENTION_DAYS = 30;
export const MAX_UNNAMED_VERSIONS = 50;
export const MAX_NAMED_VERSIONS = 50;
export const MAX_VERSION_NAME = 60;

type Prunable = Pick<VersionRecord, 'id' | 'createdAt' | 'name'>;

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Which versions the retention rules drop (pure). */
export function versionsToPrune(list: Prunable[], now = Date.now()): string[] {
  const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
  const keep = new Set<string>();
  const buckets = new Set<string>();
  let named = 0;
  let unnamed = 0;
  for (const v of sorted) {
    if (v.name) {
      if (named++ < MAX_NAMED_VERSIONS) keep.add(v.id);
      continue;
    }
    const age = now - v.createdAt;
    let bucket: string;
    if (age < HOUR) bucket = `v${v.id}`;
    else if (age < DAY) bucket = `h${Math.floor(v.createdAt / HOUR)}`;
    else if (age < VERSION_RETENTION_DAYS * DAY) bucket = `d${dayKey(v.createdAt)}`;
    else continue;
    if (buckets.has(bucket)) continue;
    buckets.add(bucket);
    if (unnamed++ < MAX_UNNAMED_VERSIONS) keep.add(v.id);
  }
  return sorted.filter((v) => !keep.has(v.id)).map((v) => v.id);
}

export const documentBytes = (doc: DesignDocument) => JSON.stringify(doc).length;

/** JSON with object keys sorted (and `undefined` dropped), so equal documents compare equal whatever their key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
      : v,
  );
}

/** Structural equality for documents (plain JSON; key order doesn't matter). */
export const sameDocument = (a: DesignDocument, b: DesignDocument) => a === b || canonicalJson(a) === canonicalJson(b);

export const versionName = (name: string) => sanitizeName(name, '').slice(0, MAX_VERSION_NAME).trim();

/** A short title for a version in lists. */
export function versionTitle(v: Pick<VersionRecord, 'kind' | 'name' | 'note'>): string {
  if (v.name) return v.name;
  if (v.note) return v.note;
  switch (v.kind) {
    case 'opened':
      return 'When you opened it';
    case 'auto':
      return 'Auto-saved';
    case 'manual':
      return 'Saved version';
    case 'before':
      return 'Before a big change';
  }
}

export async function listVersions(projectId: string): Promise<VersionRecord[]> {
  const list = await (await getStorage()).getVersions(projectId);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getVersion(id: string): Promise<VersionRecord | undefined> {
  return (await getStorage()).getVersion(id);
}

export async function latestVersion(projectId: string): Promise<VersionRecord | undefined> {
  return (await listVersions(projectId))[0];
}

/** Saves a version and applies the retention rules. */
export async function createVersion(
  projectId: string,
  doc: DesignDocument,
  options: { kind: VersionKind; name?: string | null; note?: string },
  now = Date.now(),
): Promise<VersionRecord> {
  const storage = await getStorage();
  const name = options.name ? versionName(options.name) || null : null;
  const version: VersionRecord = {
    id: createId('ver'),
    projectId,
    createdAt: now,
    kind: options.kind,
    name,
    ...(options.note ? { note: options.note.slice(0, 120) } : {}),
    doc: structuredClone(doc),
    slideCount: doc.slides.length,
    bytes: documentBytes(doc),
  };
  await storage.putVersion(version);
  const all = await storage.getVersions(projectId);
  await storage.deleteVersions(versionsToPrune(all, now));
  notify({ type: 'versions', projectId });
  return version;
}

export async function renameVersion(id: string, name: string | null): Promise<VersionRecord> {
  const storage = await getStorage();
  const version = await storage.getVersion(id);
  if (!version) throw new Error('That version no longer exists.');
  const next = { ...version, name: name ? versionName(name) || null : null };
  await storage.putVersion(next);
  notify({ type: 'versions', projectId: version.projectId });
  return next;
}

export async function deleteVersion(id: string): Promise<void> {
  const storage = await getStorage();
  const version = await storage.getVersion(id);
  await storage.deleteVersions([id]);
  if (version) notify({ type: 'versions', projectId: version.projectId });
}

/** Clears version history (every project, or one). Named versions stay unless `keepNamed` is false. */
export async function clearVersions(
  options: { projectId?: string; keepNamed?: boolean } = {},
): Promise<{ count: number; bytes: number }> {
  const storage = await getStorage();
  const keepNamed = options.keepNamed ?? true;
  const all = options.projectId ? await storage.getVersions(options.projectId) : await storage.getAllVersions();
  const drop = all.filter((v) => !(keepNamed && v.name));
  await storage.deleteVersions(drop.map((v) => v.id));
  for (const projectId of new Set(drop.map((v) => v.projectId))) notify({ type: 'versions', projectId });
  return { count: drop.length, bytes: drop.reduce((n, v) => n + v.bytes, 0) };
}

const stamp = (t: number) =>
  new Date(t).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Opens a version as a new project next to the original. */
export async function copyVersionToProject(versionId: string): Promise<Project> {
  const version = await getVersion(versionId);
  if (!version) throw new Error('That version no longer exists.');
  const source = await getProject(version.projectId);
  if (!source) throw new ProjectNotFoundError(version.projectId);
  const suffix = ` · ${version.name ?? stamp(version.createdAt)}`;
  return createProject({
    name: sanitizeName(source.meta.name.slice(0, Math.max(10, MAX_NAME_LENGTH - suffix.length)) + suffix),
    format: source.meta.format,
    sizeId: source.meta.sizeId,
    doc: version.doc,
    templateId: source.meta.templateId,
  });
}
