'use client';

import { create } from 'zustand';
import { getStorage } from '@/storage/db';
import { sha256Hex } from '@/assets/process-core';
import { createId } from '@/utils/id';
import { findBundledFont } from './fonts';
import type { UserFont, UserFontFormat, UserFontRecord } from './user-font-types';

/**
 * Fonts the person adds from their device (TTF, OTF, WOFF, WOFF2). The file is
 * kept in IndexedDB — never uploaded — and registered with the browser the
 * first time a design uses its family, so the editor, previews and exports all
 * render it. Project files and backups carry the fonts their designs use.
 *
 * Google Fonts: download a family from fonts.google.com and add it here — the
 * app itself never contacts Google (or anyone else) for fonts.
 */

export const MAX_FONT_BYTES = 12 * 1024 * 1024;
export const FONT_ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

const MIME: Record<UserFontFormat, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

export class FontImportError extends Error {
  constructor(
    readonly code: 'empty' | 'too-large' | 'unsupported' | 'unreadable' | 'storage',
    message: string,
  ) {
    super(message);
    this.name = 'FontImportError';
  }
}

/** The font format from the file's first bytes (never its name). Collections (.ttc) aren't supported. */
export function sniffFontFormat(head: Uint8Array): UserFontFormat | null {
  if (head.length < 4) return null;
  const tag = String.fromCharCode(head[0]!, head[1]!, head[2]!, head[3]!);
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'otf';
  if (tag === 'true' || (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0)) return 'ttf';
  return null;
}

const WEIGHT_WORDS =
  /[-_ ]?(thin|hairline|extralight|ultralight|light|regular|book|normal|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|variable|vf)+$/i;

/** A clean family name from a file name: "PlayfairDisplay-BoldItalic.ttf" → "Playfair Display". */
export function familyFromFileName(fileName: string): string {
  let name = fileName.replace(/\.[a-z0-9]+$/i, '');
  name = name.replace(/\[.*?\]/g, ''); // "Inter[wght]"
  for (let i = 0; i < 3; i++) name = name.replace(WEIGHT_WORDS, '');
  name = name
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → words
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48)
    .trim();
  return name || 'My font';
}

/** `base`, or `base 2`, `base 3`… — never a bundled family or one already taken on this device. */
export function uniqueFamily(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((f) => f.toLowerCase()));
  const free = (name: string) => !used.has(name.toLowerCase()) && !findBundledFont(name);
  if (free(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 44)} ${n}`;
    if (free(candidate)) return candidate;
  }
  return `${base.slice(0, 40)} ${Date.now() % 10_000}`;
}

/* ───────────── Registration ───────────── */

const faces = new Map<string, FontFace>();
const registering = new Map<string, Promise<boolean>>();

async function register(record: UserFontRecord): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  const key = record.family.toLowerCase();
  if (faces.has(key)) return;
  // One file is one face: let it answer every weight and both styles, so bold text shows the
  // font itself rather than a browser-faked bold of it.
  const face = new FontFace(record.family, await record.blob.arrayBuffer(), { weight: '1 1000', style: 'normal' });
  await face.load();
  document.fonts.add(face);
  faces.set(key, face);
}

function unregister(family: string): void {
  const key = family.toLowerCase();
  const face = faces.get(key);
  if (face && typeof document !== 'undefined') document.fonts?.delete(face);
  faces.delete(key);
  registering.delete(key);
}

/**
 * Makes a user font available for rendering, if `family` is one. Resolves true when the
 * family is a user font that's now ready (never rejects).
 */
export function ensureUserFont(family: string): Promise<boolean> {
  const key = family.toLowerCase();
  if (faces.has(key)) return Promise.resolve(true);
  let job = registering.get(key);
  if (!job) {
    job = (async () => {
      const storage = await getStorage();
      const record = (await storage.getAllFonts()).find((f) => f.family.toLowerCase() === key);
      if (!record) return false;
      await register(record);
      return true;
    })().catch(() => false);
    registering.set(key, job);
    void job.then((ok) => {
      if (!ok) registering.delete(key);
    });
  }
  return job;
}

/* ───────────── Library ───────────── */

const strip = ({ blob: _blob, ...font }: UserFontRecord): UserFont => font;

export async function listUserFonts(): Promise<UserFont[]> {
  const storage = await getStorage();
  return (await storage.getAllFonts()).map(strip).sort((a, b) => a.family.localeCompare(b.family));
}

/** Adds a font file: checks it's really a font the browser can load, then keeps it on this device. */
export async function addUserFont(file: Blob & { name?: string }): Promise<{ font: UserFont; reused: boolean }> {
  if (file.size === 0) throw new FontImportError('empty', 'That file is empty.');
  if (file.size > MAX_FONT_BYTES) throw new FontImportError('too-large', 'Fonts up to 12 MB can be added.');
  const bytes = await file.arrayBuffer();
  const format = sniffFontFormat(new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength)));
  if (!format) throw new FontImportError('unsupported', 'That isn’t a font file we can use — try TTF, OTF, WOFF or WOFF2.');

  const storage = await getStorage();
  const existing = await storage.getAllFonts();
  const hash = await sha256Hex(bytes);
  const same = existing.find((f) => f.hash === hash);
  if (same) return { font: strip(same), reused: true };

  const record: UserFontRecord = {
    id: createId('font'),
    family: uniqueFamily(
      familyFromFileName(file.name ?? 'My font'),
      existing.map((f) => f.family),
    ),
    fileName: (file.name ?? 'font').slice(0, 120),
    format,
    bytes: file.size,
    hash,
    createdAt: Date.now(),
    blob: new Blob([bytes], { type: MIME[format] }),
  };
  // A file that looks like a font but won't load is refused rather than stored.
  if (typeof FontFace !== 'undefined') {
    try {
      await new FontFace(record.family, bytes).load();
    } catch {
      throw new FontImportError('unreadable', 'That font file is damaged or not supported by this browser.');
    }
  }
  try {
    await storage.putFont(record);
  } catch {
    throw new FontImportError('storage', 'There’s no room to keep that font on this device.');
  }
  await register(record).catch(() => undefined);
  return { font: strip(record), reused: false };
}

/** Removes a font from this device. Designs using it fall back to a standard font. */
export async function deleteUserFont(id: string): Promise<void> {
  const storage = await getStorage();
  const record = (await storage.getAllFonts()).find((f) => f.id === id);
  await storage.deleteFont(id);
  if (record) unregister(record.family);
}

/** Adds fonts that came with a project file; a family already on this device is kept as it is. */
export async function importUserFonts(fonts: { family: string; fileName: string; blob: Blob }[]): Promise<number> {
  const storage = await getStorage();
  const existing = await storage.getAllFonts();
  let added = 0;
  for (const f of fonts) {
    if (findBundledFont(f.family) || existing.some((e) => e.family.toLowerCase() === f.family.toLowerCase())) continue;
    const bytes = await f.blob.arrayBuffer();
    const format = sniffFontFormat(new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength)));
    if (!format || bytes.byteLength > MAX_FONT_BYTES) continue;
    const hash = await sha256Hex(bytes);
    if (existing.some((e) => e.hash === hash)) continue;
    const record: UserFontRecord = {
      id: createId('font'),
      family: f.family,
      fileName: f.fileName.slice(0, 120),
      format,
      bytes: bytes.byteLength,
      hash,
      createdAt: Date.now(),
      blob: new Blob([bytes], { type: MIME[format] }),
    };
    await storage.putFont(record);
    existing.push(record);
    added++;
  }
  if (added) void useUserFonts.getState().load();
  return added;
}

/* ───────────── Store (for the font picker) ───────────── */

interface UserFontsState {
  fonts: UserFont[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (file: File) => Promise<{ font: UserFont; reused: boolean }>;
  remove: (id: string) => Promise<void>;
}

export const useUserFonts = create<UserFontsState>()((set, get) => ({
  fonts: [],
  loaded: false,
  load: async () => {
    const fonts = await listUserFonts().catch(() => []);
    set({ fonts, loaded: true });
  },
  add: async (file) => {
    const result = await addUserFont(file);
    await get().load();
    return result;
  },
  remove: async (id) => {
    await deleteUserFont(id);
    await get().load();
  },
}));
