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
