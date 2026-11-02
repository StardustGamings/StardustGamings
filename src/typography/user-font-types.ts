/** A font the person added. The file stays on this device (IndexedDB) and travels in project files. */
export type UserFontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

export interface UserFont {
  id: string;
  /** The family name designs use (unique on this device, never a bundled family's). */
  family: string;
  fileName: string;
  format: UserFontFormat;
  bytes: number;
  /** SHA-256 of the file, so the same font isn't stored twice. */
  hash: string;
  createdAt: number;
}

export interface UserFontRecord extends UserFont {
  blob: Blob;
}
