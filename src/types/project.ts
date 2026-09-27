import type { DesignDocument, Id } from './document';

export type FormatId = 'carousel' | 'story' | 'post' | 'reel-cover' | 'thumbnail' | 'collage' | 'poster' | 'moodboard';

export type SizePresetId =
  | 'ig-portrait'
  | 'ig-square'
  | 'ig-landscape'
  | 'story'
  | 'tiktok'
  | 'yt-thumbnail'
  | 'pinterest'
  | 'poster'
  | 'moodboard'
  | 'custom';

/** Lightweight listing record — kept separate from the (potentially large) document. */
export interface ProjectMeta {
  id: Id;
  name: string;
  format: FormatId;
  sizeId: SizePresetId;
  slideWidth: number;
  slideHeight: number;
  slideCount: number;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  folderId: Id | null;
  /** Soft-delete timestamp; non-null means the project is in the trash. */
  deletedAt: number | null;
  templateId?: string;
}

export interface Project {
  meta: ProjectMeta;
  doc: DesignDocument;
}

/** A folder on the projects screen. Projects point at it through `ProjectMeta.folderId`. */
export interface Folder {
  id: Id;
  name: string;
  /** Accent colour (hex) for the folder chip. */
  color: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Why a version exists: the design as it was when a session started (`opened`),
 * a periodic snapshot while editing (`auto`), one the user asked for
 * (`manual`, optionally named) or a safety copy before a big change (`before`).
 */
export type VersionKind = 'opened' | 'auto' | 'manual' | 'before';

/** A saved state of a project's document, kept on this device. */
export interface VersionRecord {
  id: Id;
  projectId: Id;
  createdAt: number;
  kind: VersionKind;
  /** User-given name. Named versions are kept until they're deleted. */
  name: string | null;
  /** What happened, for safety copies (e.g. "Before restoring an earlier version"). */
  note?: string;
  doc: DesignDocument;
  slideCount: number;
  /** Approximate stored size (the document's JSON). */
  bytes: number;
}
