import type { DesignDocument, Fill } from '@/types/document';
import type { FormatId, Project, ProjectMeta, SizePresetId } from '@/types/project';
import { getStorage } from '@/storage/db';
import { notify } from '@/storage/sync';
import { createId } from '@/utils/id';
import { cloneDocument, createDocument } from './document';
import { formatForSize, FORMATS, resolveSize, SIZE_PRESETS } from './formats';

export const MAX_NAME_LENGTH = 80;
export const TRASH_RETENTION_DAYS = 30;

/** Another tab (or window) saved this project since this copy was loaded or last saved. */
export class SaveConflictError extends Error {
  constructor(id: string) {
    super(`Project ${id} changed since it was loaded`);
    this.name = 'SaveConflictError';
  }
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project ${id} not found`);
    this.name = 'ProjectNotFoundError';
  }
}

/** Trims, collapses whitespace, strips control characters and caps the length. */
export function sanitizeName(name: string, fallback = 'Untitled design'): string {
  const clean = name
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean || fallback).slice(0, MAX_NAME_LENGTH);
}

export interface CreateProjectInput {
  name?: string;
  format: FormatId;
  sizeId?: SizePresetId;
  customSize?: { width: number; height: number };
  slideCount?: number;
  background?: Fill;
  /** Start from an existing document (e.g. a template) — it is cloned with fresh ids. */
  doc?: DesignDocument;
  templateId?: string;
}

function defaultName(format: FormatId): string {
  const date = new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return `${FORMATS[format].label} · ${date}`;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const storage = await getStorage();
  const all = await storage.getAllMeta();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  const storage = await getStorage();
  const [meta, doc] = await Promise.all([storage.getMeta(id), storage.getDocument(id)]);
  return meta && doc ? { meta, doc } : null;
}

export async function getProjectMeta(id: string): Promise<ProjectMeta | null> {
  return (await (await getStorage()).getMeta(id)) ?? null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const format = FORMATS[input.format];
  const sizeId = input.sizeId ?? format.sizeId;
  const doc = input.doc
    ? cloneDocument(input.doc)
    : createDocument({
        ...resolveSize(sizeId, input.customSize),
        slideCount: input.slideCount ?? format.slideCount,
        background: input.background,
      });
  const now = Date.now();
  const meta: ProjectMeta = {
    id: createId('prj'),
    name: sanitizeName(input.name ?? '', defaultName(input.format)),
    format: input.format,
    sizeId,
    slideWidth: doc.slideWidth,
    slideHeight: doc.slideHeight,
    slideCount: doc.slides.length,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    folderId: null,
    deletedAt: null,
    templateId: input.templateId,
  };
  const storage = await getStorage();
  await storage.putProject(meta, doc);
  notify({ type: 'project', id: meta.id });
  return { meta, doc };
}

/**
 * Stores a project that came from a project file or backup. Its document has
 * already been validated. The original id is kept when it's free (so a restored
 * backup keeps its links); otherwise the project gets a new one.
 */
export async function insertProject(
  meta: Pick<ProjectMeta, 'name' | 'format' | 'sizeId' | 'createdAt' | 'updatedAt' | 'favorite' | 'folderId'> & {
    id?: string;
    templateId?: string;
  },
  doc: DesignDocument,
): Promise<Project> {
  const storage = await getStorage();
  const id = meta.id && !(await storage.getMeta(meta.id)) ? meta.id : createId('prj');
  const next: ProjectMeta = {
    id,
    name: sanitizeName(meta.name),
    format: meta.format,
    sizeId: meta.sizeId,
    slideWidth: doc.slideWidth,
    slideHeight: doc.slideHeight,
    slideCount: doc.slides.length,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    favorite: meta.favorite,
    folderId: meta.folderId,
    deletedAt: null,
    templateId: meta.templateId,
  };
  await storage.putProject(next, doc);
  return { meta: next, doc };
}

async function requireMeta(id: string): Promise<ProjectMeta> {
  const meta = await (await getStorage()).getMeta(id);
  if (!meta) throw new ProjectNotFoundError(id);
  return meta;
}

async function patchMeta(id: string, patch: Partial<ProjectMeta>, touch = false): Promise<ProjectMeta> {
  const meta = await requireMeta(id);
  const next = { ...meta, ...patch, ...(touch ? { updatedAt: Date.now() } : {}) };
  await (await getStorage()).putMeta(next);
  notify({ type: 'project', id });
  return next;
}

/** The size preset a document's slides match (a resize, or its undo), else custom. */
function sizeFor(current: SizePresetId, doc: DesignDocument): SizePresetId {
  const fits = (id: SizePresetId) => {
    if (id === 'custom') return false;
    const p = SIZE_PRESETS[id];
    return p.width === doc.slideWidth && p.height === doc.slideHeight;
  };
  if (fits(current)) return current;
  return (Object.keys(SIZE_PRESETS) as SizePresetId[]).find(fits) ?? 'custom';
}

/**
 * Saves a project's document. With `expectedUpdatedAt`, refuses (SaveConflictError)
 * when the stored copy is newer — so a stale tab never silently overwrites another's work.
 */
export async function saveDocument(
  id: string,
  doc: DesignDocument,
  options: { expectedUpdatedAt?: number } = {},
): Promise<ProjectMeta> {
  const meta = await requireMeta(id);
  if (options.expectedUpdatedAt !== undefined && meta.updatedAt > options.expectedUpdatedAt) throw new SaveConflictError(id);
  const sizeId = sizeFor(meta.sizeId, doc);
  const next: ProjectMeta = {
    ...meta,
    sizeId,
    // Resized (or an in-place resize undone): the format follows the size.
    format: sizeId === meta.sizeId ? meta.format : formatForSize(sizeId, meta.format, doc.slides.length),
    slideWidth: doc.slideWidth,
    slideHeight: doc.slideHeight,
    slideCount: doc.slides.length,
    updatedAt: Date.now(),
  };
  await (await getStorage()).putProject(next, doc);
  notify({ type: 'project', id });
  return next;
}

export const renameProject = (id: string, name: string) => patchMeta(id, { name: sanitizeName(name) }, true);

/** After a design is resized in place: its size preset and the format that size belongs to. */
export const setProjectSize = (id: string, sizeId: SizePresetId, format: FormatId) => patchMeta(id, { sizeId, format });

export const setFavorite = (id: string, favorite: boolean) => patchMeta(id, { favorite });

export const trashProject = (id: string) => patchMeta(id, { deletedAt: Date.now() });

export const restoreProject = (id: string) => patchMeta(id, { deletedAt: null });

/** Moves projects into a folder (or out of every folder with `null`). Doesn't count as an edit. */
export async function moveProjects(ids: string[], folderId: string | null): Promise<ProjectMeta[]> {
  const moved: ProjectMeta[] = [];
  for (const id of ids) moved.push(await patchMeta(id, { folderId }));
  return moved;
}

/** Deletes a project with its thumbnail and version history. */
export async function deleteProjectForever(id: string): Promise<void> {
  await (await getStorage()).deleteProject(id);
  notify({ type: 'project', id });
}

export async function duplicateProject(id: string): Promise<Project> {
  const source = await getProject(id);
  if (!source) throw new ProjectNotFoundError(id);
  const suffix = ' (copy)';
  const project = await createProject({
    name: sanitizeName(source.meta.name.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix),
    format: source.meta.format,
    sizeId: source.meta.sizeId,
    doc: source.doc,
    templateId: source.meta.templateId,
  });
  const thumb = await (await getStorage()).getThumbnail(id);
  if (thumb) await saveThumbnail(project.meta.id, thumb.blob);
  return project;
}

export async function emptyTrash(): Promise<number> {
  const trashed = (await listProjects()).filter((p) => p.deletedAt !== null);
  await Promise.all(trashed.map((p) => deleteProjectForever(p.id)));
  return trashed.length;
}

/** Permanently removes projects that have sat in the trash past the retention window. */
export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  const cutoff = now - TRASH_RETENTION_DAYS * 24 * 3600e3;
  const expired = (await listProjects()).filter((p) => p.deletedAt !== null && p.deletedAt < cutoff);
  await Promise.all(expired.map((p) => deleteProjectForever(p.id)));
  return expired.length;
}

export async function saveThumbnail(id: string, blob: Blob): Promise<void> {
  await (await getStorage()).putThumbnail({ id, blob, updatedAt: Date.now() });
  notify({ type: 'project', id });
}

export async function getThumbnail(id: string): Promise<Blob | null> {
  return (await (await getStorage()).getThumbnail(id))?.blob ?? null;
}

export async function clearAllProjects(): Promise<void> {
  await (await getStorage()).clearAll();
  notify({ type: 'library' });
}

export async function storageKind(): Promise<'indexeddb' | 'memory'> {
  return (await getStorage()).kind;
}
