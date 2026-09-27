import * as z from 'zod';
import type { DesignDocument, ImageElement } from '@/types/document';
import type { AssetMeta, AssetVariant } from '@/assets/types';
import type { Folder, ProjectMeta, VersionRecord } from '@/types/project';
import type { UserTemplate } from '@/templates/user';
import { documentAssetIds } from '@/assets/repository';
import { RASTER_MIME, sniffImageFormat, sniffVideoFormat, VIDEO_MIME } from '@/assets/sniff';
import { assetHash } from '@/assets/video';
import { MAX_VIDEO_BYTES } from '@/assets/types';
import { createZipBlob, type ZipBlobEntry } from '@/export/zip';
import { fileStem } from '@/export/plan';
import { documentSchema, formatSchema, sizeIdSchema } from '@/projects/schema';
import { adoptFolder } from '@/projects/folders';
import { insertProject, sanitizeName } from '@/projects/repository';
import { documentBytes, sameDocument, versionsToPrune } from '@/projects/versions';
import { templateSchema } from '@/templates/schema';
import { createId } from '@/utils/id';
import { isValidColor } from '@/utils/color';
import { getStorage } from './db';
import { notify } from './sync';
import { openZip, ZipReadError, type ZipReader } from './unzip';

/**
 * Stardeck project files (`.stardeck`): a ZIP with a manifest, each project's
 * design as JSON, and the photos it uses (all three sizes, so nothing needs
 * re-processing). The same format carries full backups — every project with
 * its version history, folders, saved templates and the whole photo library.
 *
 * Files are made and read on this device. Import never trusts the file: every
 * JSON part is validated, every image is identified by its bytes, and ids are
 * remapped so nothing on this device is overwritten.
 */

export const PROJECT_FILE_EXTENSION = '.stardeck';
export const PROJECT_FILE_MIME = 'application/vnd.stardeck+zip';
export const FILE_FORMAT_VERSION = 1;
const MANIFEST = 'stardeck.json';
const MAX_JSON_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 120 * 1024 * 1024;
const VARIANTS: AssetVariant[] = ['original', 'preview', 'thumb'];
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export type ProjectFileKind = 'project' | 'backup';

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

/* ───────────── Schemas ───────────── */

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\w-]+$/u);
const time = z.number().int().min(0).max(8.64e15);

const manifestSchema = z.object({
  kind: z.enum(['stardeck-project', 'stardeck-backup']),
  version: z.number().int().min(1),
  app: z.string().max(40).optional(),
  createdAt: time,
  projects: z.array(z.object({ id, path: z.string().max(200) })).max(5000),
  assets: z.array(id).max(50_000),
  folders: z
    .array(z.object({ id, name: z.string().max(120), color: z.string().max(32), createdAt: time, updatedAt: time }))
    .max(1000)
    .optional(),
  templates: z.array(z.string().max(200)).max(2000).optional(),
});

const versionSchema = z.object({
  id,
  createdAt: time,
  kind: z.enum(['opened', 'auto', 'manual', 'before']),
  name: z.string().max(120).nullable(),
  note: z.string().max(200).optional(),
  doc: documentSchema,
});

const projectSchema = z.object({
  meta: z.object({
    id,
    name: z.string().max(400),
    format: formatSchema,
    sizeId: sizeIdSchema,
    createdAt: time,
    updatedAt: time,
    favorite: z.boolean().optional(),
    folderId: id.nullable().optional(),
    templateId: z.string().max(64).optional(),
  }),
  doc: documentSchema,
  thumbnail: z.string().max(200).optional(),
  versions: z.array(versionSchema).max(500).optional(),
});

const assetSchema = z.object({
  id,
  kind: z.enum(['photo', 'sticker', 'mask', 'video']),
  name: z.string().max(200),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
  previewWidth: z.number().int().min(1).max(20_000),
  previewHeight: z.number().int().min(1).max(20_000),
  createdAt: time,
  hasAlpha: z.boolean(),
  palette: z.array(z.string().max(32)).max(16),
  duration: z.number().min(0).max(3600).optional(),
  files: z.object({ original: z.string().max(200), preview: z.string().max(200), thumb: z.string().max(200) }),
});

const userTemplateSchema = templateSchema.extend({ createdAt: time, updatedAt: time, keepsPhotos: z.boolean() });

type ProjectEntry = z.infer<typeof projectSchema>;

/* ───────────── Helpers ───────────── */

const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

/** Replaces asset ids in a document (photos, cut-out masks, backdrop photos). */
export function remapAssets(doc: DesignDocument, map: Map<string, string>): DesignDocument {
  if (map.size === 0) return doc;
  const swap = (assetId: string) => map.get(assetId) ?? assetId;
  return {
    ...doc,
    elements: doc.elements.map((el) => {
      if (el.type !== 'image') return el;
      const next: ImageElement = { ...el, assetId: el.assetId ? swap(el.assetId) : null };
      if (el.cutout) {
        next.cutout = {
          ...el.cutout,
          maskAssetId: swap(el.cutout.maskAssetId),
          backdrop:
            el.cutout.backdrop.type === 'image'
              ? { type: 'image', assetId: swap(el.cutout.backdrop.assetId) }
              : el.cutout.backdrop,
        };
      }
      return next;
    }),
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export function projectFileName(kind: ProjectFileKind, name?: string): string {
  return kind === 'backup'
    ? `stardeck-backup-${today()}${PROJECT_FILE_EXTENSION}`
    : `${fileStem(name ?? '')}${PROJECT_FILE_EXTENSION}`;
}

/* ───────────── Writing ───────────── */

export interface WriteOptions {
  kind: ProjectFileKind;
  /** Use these documents instead of the stored ones (e.g. unsaved edits in the editor). */
  docs?: Map<string, DesignDocument>;
  onProgress?: (done: number, total: number) => void;
}

export interface WrittenFile {
  file: File;
  projects: number;
  photos: number;
}

/**
 * Writes a project file for the given projects, or — with `kind: 'backup'` —
 * for everything on this device (projects outside the trash, their versions,
 * folders, saved templates and every photo and sticker).
 */
export async function writeProjectFile(projectIds: string[] | 'all', options: WriteOptions): Promise<WrittenFile> {
  const storage = await getStorage();
  const backup = options.kind === 'backup';
  const metas = (await storage.getAllMeta()).filter(
    (m) => m.deletedAt === null && (projectIds === 'all' || projectIds.includes(m.id)),
  );
  if (metas.length === 0 && !backup) throw new ProjectFileError('That design couldn’t be found on this device.');

  const entries: ZipBlobEntry[] = [];
  const assetIds = new Set<string>();
  const projectRefs: { id: string; path: string }[] = [];

  for (const meta of metas) {
    const doc = options.docs?.get(meta.id) ?? (await storage.getDocument(meta.id));
    if (!doc) continue;
    documentAssetIds(doc).forEach((a) => assetIds.add(a));
    const versions: VersionRecord[] = backup ? await storage.getVersions(meta.id) : [];
    for (const v of versions) documentAssetIds(v.doc).forEach((a) => assetIds.add(a));
    const thumb = await storage.getThumbnail(meta.id);
    const thumbPath = thumb ? `thumbs/${meta.id}.${EXT[thumb.blob.type] ?? 'webp'}` : undefined;
    if (thumb && thumbPath) entries.push({ name: thumbPath, data: thumb.blob });
    const entry: ProjectEntry = {
      meta: {
        id: meta.id,
        name: meta.name,
        format: meta.format,
        sizeId: meta.sizeId,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        favorite: meta.favorite,
        folderId: backup ? meta.folderId : null,
        ...(meta.templateId ? { templateId: meta.templateId } : {}),
      },
      doc,
      ...(thumbPath ? { thumbnail: thumbPath } : {}),
      ...(versions.length
        ? {
            versions: versions.map((v) => ({
              id: v.id,
              createdAt: v.createdAt,
              kind: v.kind,
              name: v.name,
              note: v.note,
              doc: v.doc,
            })),
          }
        : {}),
    };
    const path = `projects/${meta.id}.json`;
    entries.push({ name: path, data: json(entry) });
    projectRefs.push({ id: meta.id, path });
  }

  let folders: Folder[] | undefined;
  const templatePaths: string[] = [];
  if (backup) {
    folders = await storage.getAllFolders();
    for (const t of await storage.getAllTemplates()) {
      documentAssetIds(t.doc).forEach((a) => assetIds.add(a));
      const path = `templates/${t.id}.json`;
      entries.push({ name: path, data: json(t) });
      templatePaths.push(path);
    }
    // A backup keeps the whole library, including photos no design uses yet.
    for (const a of await storage.getAllAssetMeta()) assetIds.add(a.id);
  }

  const ids = [...assetIds];
  let photos = 0;
  const written: string[] = [];
  for (const [i, assetId] of ids.entries()) {
    options.onProgress?.(i, ids.length);
    const meta = await storage.getAssetMeta(assetId);
    if (!meta) continue;
    const files: Record<AssetVariant, string> = { original: '', preview: '', thumb: '' };
    let complete = true;
    for (const variant of VARIANTS) {
      const blob = await storage.getAssetBlob(assetId, variant);
      if (!blob) {
        complete = false;
        break;
      }
      files[variant] = `assets/${assetId}/${variant}.${EXT[blob.type] ?? EXT[meta.mime] ?? 'bin'}`;
      entries.push({ name: files[variant], data: blob });
    }
    if (!complete) continue;
    const { id: _id, hash: _hash, bytes: _bytes, mime: _mime, ...rest } = meta;
    entries.push({ name: `assets/${assetId}/asset.json`, data: json({ id: assetId, ...rest, files }) });
    written.push(assetId);
    if (meta.kind === 'photo') photos++;
  }
  options.onProgress?.(ids.length, ids.length);

  const manifest: z.infer<typeof manifestSchema> = {
    kind: backup ? 'stardeck-backup' : 'stardeck-project',
    version: FILE_FORMAT_VERSION,
    app: 'Stardeck',
    createdAt: Date.now(),
    projects: projectRefs,
    assets: written,
    ...(backup ? { folders, templates: templatePaths } : {}),
  };
  entries.unshift({ name: MANIFEST, data: json(manifest) });

  const blob = await createZipBlob(entries, PROJECT_FILE_MIME);
  const name = projectFileName(options.kind, metas.length === 1 && !backup ? metas[0]!.name : undefined);
  return { file: new File([blob], name, { type: PROJECT_FILE_MIME }), projects: projectRefs.length, photos };
}

/* ───────────── Reading ───────────── */

export interface ImportReport {
  kind: ProjectFileKind;
  /** Projects added to this device. */
  projects: ProjectMeta[];
  /** Projects that were already here, unchanged. */
  unchanged: number;
  versions: number;
  folders: number;
  templates: number;
  photos: { added: number; reused: number };
  /** Parts of the file that were damaged and skipped. */
  skipped: number;
}

async function parseJson<T>(zip: ZipReader, path: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const parsed = schema.safeParse(JSON.parse(await zip.text(path, MAX_JSON_BYTES)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Reads an image entry and checks it really is a raster image; returns it with its real MIME type. */
async function readImage(zip: ZipReader, path: string): Promise<Blob | null> {
  try {
    const bytes = await zip.bytes(path, MAX_IMAGE_BYTES);
    const format = sniffImageFormat(bytes.subarray(0, 1024));
    if (!format || format === 'svg' || format === 'heic') return null;
    return new Blob([bytes], { type: RASTER_MIME[format] });
  } catch {
    return null;
  }
}

/** Reads a video entry, checking it really is MP4 / MOV / WebM. */
async function readVideo(zip: ZipReader, path: string): Promise<Blob | null> {
  try {
    const bytes = await zip.bytes(path, MAX_VIDEO_BYTES);
    const format = sniffVideoFormat(bytes.subarray(0, 64));
    return format ? new Blob([bytes], { type: VIDEO_MIME[format] }) : null;
  } catch {
    return null;
  }
}

/** Imports a project file or backup. Nothing on this device is overwritten. */
export async function importProjectFile(
  file: Blob,
  hooks: { onProgress?: (done: number, total: number, label: string) => void } = {},
): Promise<ImportReport> {
  let zip: ZipReader;
  try {
    zip = await openZip(file);
  } catch (e) {
    throw new ProjectFileError(e instanceof ZipReadError ? e.message : 'That file isn’t a Stardeck project.');
  }
  if (!zip.entries.has(MANIFEST)) throw new ProjectFileError('That file isn’t a Stardeck project.');
  let raw: unknown;
  try {
    raw = JSON.parse(await zip.text(MANIFEST, MAX_JSON_BYTES));
  } catch {
    throw new ProjectFileError('This Stardeck file is damaged.');
  }
  const version = (raw as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version > FILE_FORMAT_VERSION) {
    throw new ProjectFileError('This file was made with a newer version of Stardeck. Update the app, then try again.');
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new ProjectFileError('This Stardeck file is damaged.');
  const manifest = parsed.data;
  const storage = await getStorage();
  const report: ImportReport = {
    kind: manifest.kind === 'stardeck-backup' ? 'backup' : 'project',
    projects: [],
    unchanged: 0,
    versions: 0,
    folders: 0,
    templates: 0,
    photos: { added: 0, reused: 0 },
    skipped: 0,
  };
  const total = manifest.assets.length + manifest.projects.length + (manifest.templates?.length ?? 0);
  let done = 0;
  const step = (label: string) => hooks.onProgress?.(done++, total, label);

  try {
    // 1 · Photos: identical ones already on this device are reused.
    const assetMap = new Map<string, string>();
    for (const assetId of manifest.assets) {
      step('Adding photos…');
      const meta = await parseJson(zip, `assets/${assetId}/asset.json`, assetSchema);
      if (!meta || meta.id !== assetId) {
        report.skipped++;
        continue;
      }
      const blobs: Partial<Record<AssetVariant, Blob>> = {};
      for (const variant of VARIANTS) {
        const path = `assets/${assetId}/${meta.files[variant].split('/').pop()}`;
        const blob = meta.kind === 'video' && variant === 'original' ? await readVideo(zip, path) : await readImage(zip, path);
        if (blob) blobs[variant] = blob;
      }
      if (!blobs.original || !blobs.preview || !blobs.thumb) {
        report.skipped++;
        continue;
      }
      const hash = await assetHash(blobs.original);
      const existing = (await storage.findAssetByHash(hash)).find((a) => a.kind === meta.kind);
      if (existing) {
        assetMap.set(assetId, existing.id);
        report.photos.reused++;
        continue;
      }
      const taken = await storage.getAssetMeta(assetId);
      const newId = taken ? createId('as') : assetId;
      const record: AssetMeta = {
        id: newId,
        kind: meta.kind,
        name: sanitizeName(meta.name, 'Photo'),
        mime: blobs.original.type,
        width: meta.width,
        height: meta.height,
        previewWidth: meta.previewWidth,
        previewHeight: meta.previewHeight,
        bytes: blobs.original.size + blobs.preview.size + blobs.thumb.size,
        createdAt: meta.createdAt,
        hash,
        hasAlpha: meta.hasAlpha,
        palette: meta.palette.filter(isValidColor),
        ...(meta.kind === 'video' && meta.duration !== undefined ? { duration: meta.duration } : {}),
      };
      await storage.putAsset(record, { original: blobs.original, preview: blobs.preview, thumb: blobs.thumb });
      assetMap.set(assetId, newId);
      report.photos.added++;
    }

    // 2 · Folders (backups): merged by name.
    const folderMap = new Map<string, string>();
    for (const folder of manifest.folders ?? []) {
      folderMap.set(folder.id, await adoptFolder({ ...folder, color: isValidColor(folder.color) ? folder.color : '#9AA3B5' }));
      report.folders++;
    }

    // 3 · Projects (and their version history).
    for (const ref of manifest.projects) {
      step('Adding designs…');
      const entry = await parseJson(zip, ref.path, projectSchema);
      if (!entry) {
        report.skipped++;
        continue;
      }
      const doc = remapAssets(entry.doc, assetMap);
      const here = await storage.getMeta(entry.meta.id);
      if (here && here.deletedAt === null) {
        const current = await storage.getDocument(here.id);
        if (current && sameDocument(current, doc)) {
          report.unchanged++;
          continue;
        }
      }
      const { meta } = await insertProject(
        {
          id: entry.meta.id,
          // The same design, changed since: keep both, clearly labelled.
          name: here ? `${entry.meta.name} (imported)` : entry.meta.name,
          format: entry.meta.format,
          sizeId: entry.meta.sizeId,
          createdAt: entry.meta.createdAt,
          updatedAt: entry.meta.updatedAt,
          favorite: entry.meta.favorite ?? false,
          folderId: entry.meta.folderId ? (folderMap.get(entry.meta.folderId) ?? null) : null,
          templateId: entry.meta.templateId,
        },
        doc,
      );
      if (entry.thumbnail) {
        const thumb = await readImage(zip, entry.thumbnail);
        if (thumb) await storage.putThumbnail({ id: meta.id, blob: thumb, updatedAt: Date.now() });
      }
      const versions = (entry.versions ?? []).map((v) => ({
        id: createId('ver'),
        projectId: meta.id,
        createdAt: v.createdAt,
        kind: v.kind,
        name: v.name ? v.name.slice(0, 60) : null,
        ...(v.note ? { note: v.note } : {}),
        doc: remapAssets(v.doc, assetMap),
        slideCount: v.doc.slides.length,
        bytes: documentBytes(v.doc),
      }));
      const prune = new Set(versionsToPrune(versions));
      for (const v of versions) if (!prune.has(v.id)) await storage.putVersion(v);
      report.versions += versions.length - prune.size;
      report.projects.push(meta);
    }

    // 4 · Saved templates (backups).
    const existingTemplates = new Set((await storage.getAllTemplates()).map((t) => t.id));
    for (const path of manifest.templates ?? []) {
      step('Adding templates…');
      const t = await parseJson(zip, path, userTemplateSchema);
      if (!t) {
        report.skipped++;
        continue;
      }
      if (existingTemplates.has(t.id)) continue;
      const template: UserTemplate = { ...t, doc: remapAssets(t.doc, assetMap) };
      await storage.putTemplate(template);
      report.templates++;
    }
  } catch (e) {
    if (e instanceof ProjectFileError) throw e;
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new ProjectFileError('Your device ran out of space while importing. Free up some space, then try again.');
    }
    throw new ProjectFileError('Something went wrong while importing that file.');
  } finally {
    notify({ type: 'library' });
    notify({ type: 'assets' });
  }
  hooks.onProgress?.(total, total, 'Done');
  return report;
}
