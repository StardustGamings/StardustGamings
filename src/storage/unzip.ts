import { crc32 } from '@/export/zip';

/**
 * Minimal ZIP reader for project files and backups. Reads straight from a Blob
 * (only the directory and one entry at a time are loaded), supports stored and
 * deflated entries (via the browser's DecompressionStream), checks CRCs and
 * refuses archives that lie about their sizes.
 */

export class ZipReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipReadError';
  }
}

export interface ZipEntryInfo {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

export interface ZipReader {
  entries: Map<string, ZipEntryInfo>;
  bytes(name: string, maxBytes?: number): Promise<Uint8Array<ArrayBuffer>>;
  text(name: string, maxBytes?: number): Promise<string>;
}

const u16 = (v: DataView, at: number) => v.getUint16(at, true);
const u32 = (v: DataView, at: number) => v.getUint32(at, true);

async function read(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

/** Rejects absolute paths and `..` segments; returns a normalised name. */
function safeName(raw: string): string | null {
  const name = raw.replace(/\\/g, '/');
  if (name.startsWith('/') || name.split('/').some((part) => part === '..')) return null;
  return name;
}

async function inflate(data: Blob, expected: number): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined')
    throw new ZipReadError('This browser can’t open compressed files. Try another browser.');
  const out = new Uint8Array(expected);
  let at = 0;
  const source = typeof data.stream === 'function' ? data.stream() : new Response(await data.arrayBuffer()).body!;
  const reader = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (at + value.length > expected) {
      await reader.cancel();
      throw new ZipReadError('This file is damaged.');
    }
    out.set(value, at);
    at += value.length;
  }
  if (at !== expected) throw new ZipReadError('This file is damaged.');
  return out;
}

export async function openZip(blob: Blob, limits: { maxEntries?: number } = {}): Promise<ZipReader> {
  const maxEntries = limits.maxEntries ?? 50_000;
  if (blob.size < 22) throw new ZipReadError('That file is empty or isn’t a Stardeck file.');
  // The end record sits in the last 22 bytes plus an optional comment (≤ 64 KB).
  const tailStart = Math.max(0, blob.size - 22 - 0xffff);
  const tail = await read(blob, tailStart, blob.size);
  let end = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipReadError('That file isn’t a Stardeck file.');
  const count = u16(tail, end + 10);
  const dirSize = u32(tail, end + 12);
  const dirOffset = u32(tail, end + 16);
  if (count === 0xffff || dirOffset === 0xffffffff) throw new ZipReadError('That file is too large to open here.');
  if (count > maxEntries) throw new ZipReadError('That file has too many entries.');
  if (dirOffset + dirSize > blob.size) throw new ZipReadError('This file is damaged.');

  const dir = await read(blob, dirOffset, dirOffset + dirSize);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntryInfo>();
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > dir.byteLength || u32(dir, p) !== 0x02014b50) throw new ZipReadError('This file is damaged.');
    const nameLength = u16(dir, p + 28);
    const extraLength = u16(dir, p + 30);
    const commentLength = u16(dir, p + 32);
    const raw = decoder.decode(new Uint8Array(dir.buffer, p + 46, nameLength));
    const info: ZipEntryInfo = {
      name: raw,
      method: u16(dir, p + 10),
      crc: u32(dir, p + 16),
      compressedSize: u32(dir, p + 20),
      size: u32(dir, p + 24),
      localOffset: u32(dir, p + 42),
    };
    const name = safeName(raw);
    if (name && !name.endsWith('/')) entries.set(name, { ...info, name });
    p += 46 + nameLength + extraLength + commentLength;
  }

  const bytes = async (name: string, maxBytes = Infinity): Promise<Uint8Array<ArrayBuffer>> => {
    const e = entries.get(name);
    if (!e) throw new ZipReadError(`This file is missing “${name}”.`);
    if (e.size > maxBytes) throw new ZipReadError('Part of this file is too large to open.');
    const local = await read(blob, e.localOffset, e.localOffset + 30);
    if (local.byteLength < 30 || u32(local, 0) !== 0x04034b50) throw new ZipReadError('This file is damaged.');
    const start = e.localOffset + 30 + u16(local, 26) + u16(local, 28);
    const data = blob.slice(start, start + e.compressedSize);
    let out: Uint8Array<ArrayBuffer>;
    if (e.method === 0) {
      if (e.compressedSize !== e.size) throw new ZipReadError('This file is damaged.');
      out = new Uint8Array(await data.arrayBuffer());
    } else if (e.method === 8) {
      out = await inflate(data, e.size);
    } else {
      throw new ZipReadError('This file uses a compression Stardeck can’t read.');
    }
    if (out.length !== e.size || crc32(out) !== e.crc) throw new ZipReadError('This file is damaged.');
    return out;
  };

  return {
    entries,
    bytes,
    text: async (name, maxBytes) => decoder.decode(await bytes(name, maxBytes)),
  };
}
