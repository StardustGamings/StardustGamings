/**
 * Local asset library. Photos, user stickers and cut-out masks are stored as
 * blobs in IndexedDB — they never leave the device. Each asset keeps three
 * variants so the editor can stay fast with huge photos:
 *
 * - `original`: the imported file (or a re-encode if it was too large), used for export.
 * - `preview`:  ≤ PREVIEW_MAX px on the long edge, used while editing.
 * - `thumb`:    ≤ THUMB_MAX px, used in panels and pickers.
 */
export type AssetKind = 'photo' | 'sticker' | 'mask' | 'video';
export type AssetVariant = 'original' | 'preview' | 'thumb';

export const ORIGINAL_MAX = 8192;
export const PREVIEW_MAX = 2048;
export const THUMB_MAX = 384;
/** Files above this are rejected outright (decoding them could exhaust memory on phones). */
export const MAX_FILE_BYTES = 60 * 1024 * 1024;
/** Photos above this many pixels on the long edge get the "optimizing it for you" message. */
export const LARGE_IMAGE_EDGE = 4096;
/** Short clips only: phones would struggle with longer or bigger files in a design. */
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 120;

export interface AssetMeta {
  id: string;
  kind: AssetKind;
  /** Original file name (sanitised), shown in the library. */
  name: string;
  /** MIME type of the `original` variant. */
  mime: string;
  width: number;
  height: number;
  previewWidth: number;
  previewHeight: number;
  /** Total stored bytes across all variants. */
  bytes: number;
  createdAt: number;
  /** SHA-256 of the imported bytes — re-importing the same file reuses the asset. */
  hash: string;
  hasAlpha: boolean;
  /** A few dominant colours (hex), offered in colour pickers. */
  palette: string[];
  /** Videos: length in seconds. The `preview`/`thumb` variants are poster frames. */
  duration?: number;
}

export interface AssetBlobs {
  original: Blob;
  preview: Blob;
  thumb: Blob;
}
