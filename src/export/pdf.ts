/**
 * Minimal PDF writer: one page per slide, each page a full-bleed JPEG
 * (DCTDecode, so the JPEG bytes go in as-is). PDF 1.4, no dependency.
 */

export interface PdfPage {
  jpeg: Uint8Array;
  /** Image size in pixels. */
  pixelWidth: number;
  pixelHeight: number;
  /** Page size in points (1/72 inch). */
  width: number;
  height: number;
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** PDF text strings: escape backslashes and parentheses; keep printable ASCII only. */
function pdfString(s: string): string {
  return `(${s
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[\\()]/g, (c) => `\\${c}`)
    .slice(0, 120)})`;
}

export function createPdf(pages: PdfPage[], info: { title?: string } = {}): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  // Object ids: 1 catalog, 2 pages, 3 info, then 3 per page (page, content, image).
  const pageIds = pages.map((_, i) => 4 + i * 3);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`));
  object(3, () => push(`<< /Producer (Stardeck) /Title ${pdfString(info.title ?? 'Stardeck design')} >>`));

  pages.forEach((page, i) => {
    const [pageId, contentId, imageId] = [pageIds[i]!, pageIds[i]! + 1, pageIds[i]! + 2];
    const w = fmt(page.width);
    const h = fmt(page.height);
    object(pageId, () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    object(contentId, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    object(imageId, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      );
      push(page.jpeg);
      push('\nendstream');
    });
  });

  const count = 4 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
