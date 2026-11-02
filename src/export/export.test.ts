import { describe, expect, it } from 'vitest';
import { createDocument } from '@/projects/document';
import { createPdf } from './pdf';
import {
  bundleName,
  fileStem,
  MAX_PIXELS,
  MAX_SIDE,
  outputScale,
  pdfPageSize,
  planExport,
  supportsTransparency,
  withoutBackground,
} from './plan';
import { crc32, createZip } from './zip';

const text = (s: string) => new TextEncoder().encode(s);
const ascii = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

/** Reads a stored ZIP back (enough to check what we wrote). */
function readZip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const entries: { name: string; data: Uint8Array; crc: number; flags: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const flags = v.getUint16(p + 8, true);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const offset = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    expect(v.getUint32(offset, true)).toBe(0x04034b50);
    const localName = v.getUint16(offset + 26, true);
    const data = bytes.subarray(offset + 30 + localName, offset + 30 + localName + size);
    entries.push({ name, data, crc, flags });
    p += 46 + nameLen;
  }
  return entries;
}

describe('ZIP writer', () => {
  it('computes standard CRC-32', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('writes a valid archive that reads back byte for byte', () => {
    const files = [
      { name: 'summer-01.png', data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) },
      { name: 'été ✦ 02.png', data: text('second file') },
      { name: 'summer-01.png', data: text('dup') },
    ];
    const entries = readZip(createZip(files));
    expect(entries.map((e) => e.name)).toEqual(['summer-01.png', 'été ✦ 02.png', 'summer-01-2.png']);
    for (const [i, e] of entries.entries()) {
      expect([...e.data]).toEqual([...files[i]!.data]);
      expect(e.crc).toBe(crc32(files[i]!.data));
      expect(e.flags & 0x0800).toBe(0x0800);
    }
  });
});

describe('PDF writer', () => {
  it('writes one page per image with a correct cross-reference table', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const pdf = createPdf(
      [
        { jpeg, pixelWidth: 1080, pixelHeight: 1350, width: 810, height: 1012.5 },
        { jpeg, pixelWidth: 1080, pixelHeight: 1350, width: 810, height: 1012.5 },
      ],
      { title: 'My (summer) dump ✦' },
    );
    const s = ascii(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/Type /Pages /Kids [4 0 R 7 0 R] /Count 2');
    expect(s).toContain('/MediaBox [0 0 810 1012.5]');
    expect(s).toContain('/Width 1080 /Height 1350');
    expect(s).toContain('/Title (My \\(summer\\) dump )');
    // startxref points at the xref table, and every entry points at its object.
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...s.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(9);
    offsets.forEach((offset, i) => expect(s.slice(offset, offset + 8)).toBe(`${i + 1} 0 obj\n`.slice(0, 8)));
    // The JPEG bytes are embedded untouched.
    expect(ascii(pdf)).toContain(ascii(jpeg));
  });
});

describe('export plan', () => {
  const carousel = createDocument({ width: 1080, height: 1350, slideCount: 12 });
  const post = createDocument({ width: 1080, height: 1350, slideCount: 1 });

  it('names files from the design, numbering slides', () => {
    expect(fileStem('Summer Dump ✦ 2026!')).toBe('summer-dump-2026');
    expect(fileStem('Été à Lisboa')).toBe('ete-a-lisboa');
    expect(fileStem('✦✦✦')).toBe('stardeck-design');
    const items = planExport(carousel, 'Summer Dump', { format: 'png', quality: 'standard', scope: { kind: 'all' } });
    expect(items).toHaveLength(12);
    expect(items[0]).toMatchObject({ name: 'summer-dump-01.png', slide: 0, width: 1080, height: 1350 });
    expect(items[11]!.name).toBe('summer-dump-12.png');
    expect(items[3]!.region.x).toBe(3 * 1080);
    expect(planExport(post, 'Hello', { format: 'jpg', quality: 'standard', scope: { kind: 'all' } })[0]!.name).toBe('hello.jpg');
  });

  it('exports chosen slides or the whole carousel as one image', () => {
    const some = planExport(carousel, 'x', {
      format: 'webp',
      quality: 'standard',
      scope: { kind: 'slides', indices: [4, 1, 4, 99] },
    });
    expect(some.map((i) => i.slide)).toEqual([1, 4]);
    const five = createDocument({ width: 1080, height: 1350, slideCount: 5 });
    const [strip] = planExport(five, 'x', { format: 'png', quality: 'standard', scope: { kind: 'strip' } });
    expect(strip).toMatchObject({ name: 'x-carousel.png', slide: null, width: 5400, height: 1350 });
  });

  it('scales by quality but stays inside browser canvas limits', () => {
    expect(outputScale(1080, 1350, 'standard')).toBe(1);
    expect(outputScale(1080, 1350, 'high')).toBe(2);
    expect(outputScale(1080, 1350, 'max')).toBe(3);
    const [poster] = planExport(createDocument({ width: 1240, height: 1754 }), 'p', {
      format: 'png',
      quality: 'max',
      scope: { kind: 'all' },
    });
    expect(poster!.width * poster!.height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(poster!.width).toBeGreaterThan(1240 * 2);
    const [wide] = planExport(carousel, 'x', { format: 'png', quality: 'high', scope: { kind: 'strip' } });
    expect(wide!.width).toBeLessThanOrEqual(MAX_SIDE);
    expect(wide!.width * wide!.height).toBeLessThanOrEqual(MAX_PIXELS);
  });

  it('bundles several images as a ZIP (or not), and PDFs as one file', () => {
    const all = planExport(carousel, 'Trip', { format: 'png', quality: 'standard', scope: { kind: 'all' } });
    expect(bundleName('Trip', { format: 'png', quality: 'standard', scope: { kind: 'all' } }, all)).toBe('trip.zip');
    expect(
      bundleName('Trip', { format: 'png', quality: 'standard', scope: { kind: 'all' }, packaging: 'files' }, all),
    ).toBeNull();
    expect(bundleName('Trip', { format: 'pdf', quality: 'standard', scope: { kind: 'all' } }, all)).toBe('trip.pdf');
    expect(bundleName('Trip', { format: 'png', quality: 'standard', scope: { kind: 'all' } }, all.slice(0, 1))).toBe(
      'trip-01.png',
    );
  });

  it('knows which formats can be transparent and drops the background for them', () => {
    expect([
      supportsTransparency('png'),
      supportsTransparency('webp'),
      supportsTransparency('jpg'),
      supportsTransparency('pdf'),
    ]).toEqual([true, true, false, false]);
    const d = createDocument({ width: 100, height: 100, slideCount: 2, background: { type: 'solid', color: '#FF0000' } });
    d.slides[1]!.fill = { type: 'solid', color: '#00FF00' };
    const clear = withoutBackground(d);
    expect(clear.background).toEqual({ type: 'solid', color: 'rgba(0,0,0,0)' });
    expect(clear.slides.every((s) => s.fill === null)).toBe(true);
  });

  it('sizes PDF pages at 96 dpi, with A-series posters on A4', () => {
    expect(pdfPageSize(post)).toEqual({ width: 810, height: 1012.5 });
    const a4 = pdfPageSize(createDocument({ width: 1240, height: 1754 }), 'poster');
    expect(a4.width).toBeCloseTo(595.2, 0);
    expect(a4.height).toBeCloseTo(841.9, 0);
  });
});
