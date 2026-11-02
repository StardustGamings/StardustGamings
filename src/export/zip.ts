/**
 * Minimal ZIP writer (stored, no compression — the images inside are already
 * compressed). Works everywhere, needs no dependency and no network.
 * Spec: PKWARE APPNOTE 6.3 (local file headers, central directory, end record).
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  date?: Date;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

interface Headers {
  local: Uint8Array<ArrayBuffer>;
  central: Uint8Array<ArrayBuffer>;
}

function headers(nameBytes: Uint8Array, crc: number, size: number, offset: number, when: Date): Headers {
  const { time, date } = dosDateTime(when);
  const local = new Uint8Array(30 + nameBytes.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true); // version needed
  lv.setUint16(6, 0x0800, true); // UTF-8 names
  lv.setUint16(8, 0, true); // stored
  lv.setUint16(10, time, true);
  lv.setUint16(12, date, true);
  lv.setUint32(14, crc, true);
  lv.setUint32(18, size, true);
  lv.setUint32(22, size, true);
  lv.setUint16(26, nameBytes.length, true);
  lv.setUint16(28, 0, true);
  local.set(nameBytes, 30);

  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true); // version made by
  cv.setUint16(6, 20, true);
  cv.setUint16(8, 0x0800, true);
  cv.setUint16(10, 0, true);
  cv.setUint16(12, time, true);
  cv.setUint16(14, date, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, size, true);
  cv.setUint32(24, size, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint32(42, offset, true);
  central.set(nameBytes, 46);
  return { local, central };
}

function endRecord(count: number, centralSize: number, centralOffset: number): Uint8Array<ArrayBuffer> {
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, count, true);
  ev.setUint16(10, count, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  return end;
}

/** Keeps names unique (a ZIP may hold duplicates, but unpackers overwrite them). */
function uniqueNamer() {
  const seen = new Set<string>();
  return (raw: string) => {
    const clean = raw.replace(/\\/g, '/').replace(/^\/+/, '');
    let name = clean;
    for (let n = 2; seen.has(name); n++) name = clean.replace(/(\.[^./]*)?$/, (e) => `-${n}${e}`);
    seen.add(name);
    return name;
  };
}

/** Largest archive the 32-bit ZIP format can describe (ZIP64 isn't written). */
export const MAX_ZIP_BYTES = 0xffffffff;

export function createZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const unique = uniqueNamer();
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const { local, central } = headers(
      encoder.encode(unique(entry.name)),
      crc32(entry.data),
      entry.data.length,
      offset,
      entry.date ?? new Date(),
    );
    parts.push(local, entry.data);
    centrals.push(central);
    offset += local.length + entry.data.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const all = [...parts, ...centrals, endRecord(entries.length, centralSize, offset)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of all) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

export interface ZipBlobEntry {
  name: string;
  data: Blob | Uint8Array<ArrayBuffer>;
  date?: Date;
}

/**
 * Same archive as `createZip`, assembled as a Blob: only one entry's bytes are
 * held in memory at a time (to compute its CRC), so large backups stay cheap.
 */
export async function createZipBlob(entries: ZipBlobEntry[], type = 'application/zip'): Promise<Blob> {
  const encoder = new TextEncoder();
  const unique = uniqueNamer();
  const parts: BlobPart[] = [];
  const centrals: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const entry of entries) {
    const bytes = entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : entry.data;
    const { local, central } = headers(
      encoder.encode(unique(entry.name)),
      crc32(bytes),
      bytes.length,
      offset,
      entry.date ?? new Date(),
    );
    parts.push(local, entry.data);
    centrals.push(central);
    offset += local.length + bytes.length;
    if (offset > MAX_ZIP_BYTES) throw new RangeError('That’s more than a single file can hold (4 GB).');
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  return new Blob([...parts, ...centrals, endRecord(entries.length, centralSize, offset)], { type });
}
