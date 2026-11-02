'use client';

import type { DesignDocument } from '@/types/document';
import { renderDocument } from '@/canvas/render/renderer';
import { ensureDocumentFonts } from '@/canvas/fonts';
import { encodeCanvas } from './encode';
import { prepareRegionImages } from './images';
import { createPdf, type PdfPage } from './pdf';
import {
  bundleName,
  MIME,
  pdfPageSize,
  planExport,
  QUALITY,
  supportsTransparency,
  withoutBackground,
  type ExportOptions,
} from './plan';
import { createZip } from './zip';
import { isNativeApp } from '@/native/platform';

/**
 * Exports a design entirely on this device: renders each region with the
 * same renderer as the editor, encodes it, and packages the result. Nothing is
 * uploaded and nothing is ever watermarked.
 */

export interface ExportProgress {
  done: number;
  total: number;
  label: string;
}

export interface ExportResult {
  /** Every image produced (for sharing). For PDFs, the PDF itself. */
  files: File[];
  /** What "save" downloads: one file, a ZIP or a PDF (null = save `files` one by one). */
  bundle: File | null;
  /** Photos missing from this device (they export as empty frames). */
  missing: number;
  width: number;
  height: number;
}

export interface ExportSource {
  doc: DesignDocument;
  name: string;
  sizeId?: string;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

async function renderRegion(
  doc: DesignDocument,
  region: { x: number; y: number; width: number; height: number },
  scale: number,
  width: number,
  height: number,
  useOriginals: boolean,
  signal?: AbortSignal,
): Promise<{ canvas: HTMLCanvasElement; missing: number }> {
  const images = await prepareRegionImages(doc, region, scale, useOriginals, signal);
  try {
    signal?.throwIfAborted();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser couldn’t create a canvas that large.');
    ctx.imageSmoothingQuality = 'high';
    renderDocument(ctx, doc, { region, scale: width / region.width, images: images.resolve, placeholders: false });
    return { canvas, missing: images.missing };
  } finally {
    images.dispose();
  }
}

export async function exportDesign(
  source: ExportSource,
  options: ExportOptions,
  hooks: { onProgress?: (p: ExportProgress) => void; signal?: AbortSignal } = {},
): Promise<ExportResult> {
  const { signal, onProgress } = hooks;
  const transparent = !!options.transparent && supportsTransparency(options.format);
  const doc = transparent ? withoutBackground(source.doc) : source.doc;
  const items = planExport(doc, source.name, options);
  if (items.length === 0) throw new Error('Nothing to export — pick at least one slide.');
  const q = QUALITY[options.quality];
  const total = items.length + 1;

  onProgress?.({ done: 0, total, label: 'Loading fonts and photos…' });
  await ensureDocumentFonts(doc);

  const files: File[] = [];
  const pages: PdfPage[] = [];
  let missing = 0;
  for (const [i, item] of items.entries()) {
    signal?.throwIfAborted();
    onProgress?.({
      done: i,
      total,
      label: item.slide === null ? 'Rendering the carousel…' : `Rendering slide ${item.slide + 1}…`,
    });
    await tick();
    const { canvas, missing: gone } = await renderRegion(
      doc,
      item.region,
      item.scale,
      item.width,
      item.height,
      q.originals,
      signal,
    );
    missing = Math.max(missing, gone);
    try {
      if (options.format === 'pdf') {
        const blob = await encodeCanvas(canvas, 'jpg', q.lossy);
        const page = pdfPageSize(doc, source.sizeId);
        pages.push({
          jpeg: new Uint8Array(await blob.arrayBuffer()),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          ...page,
        });
      } else {
        const blob = await encodeCanvas(canvas, options.format, q.lossy);
        files.push(new File([blob], item.name, { type: MIME[options.format] }));
      }
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  signal?.throwIfAborted();
  onProgress?.({ done: items.length, total, label: options.format === 'pdf' ? 'Writing the PDF…' : 'Packaging…' });
  await tick();
  const name = bundleName(source.name, options, items);
  let bundle: File | null = null;
  if (options.format === 'pdf') {
    const pdf = createPdf(pages, { title: source.name });
    bundle = new File([pdf], name!, { type: 'application/pdf' });
    files.push(bundle);
  } else if (files.length === 1) {
    bundle = files[0]!;
  } else if (name) {
    const entries = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })));
    bundle = new File([createZip(entries)], name, { type: 'application/zip' });
  }
  onProgress?.({ done: total, total, label: 'Done' });
  return { files, bundle, missing, width: items[0]!.width, height: items[0]!.height };
}

/** Can this device share these files through the system share sheet (phones, some desktops)? */
export function canShareFiles(files: File[]): boolean {
  // The Android app shares through its own bridge to the system share sheet.
  if (isNativeApp()) return true;
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files });
  } catch {
    return false;
  }
}
