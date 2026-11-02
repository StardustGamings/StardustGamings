import type { DesignDocument } from '@/types/document';
import type { Rect } from '@/canvas/render/types';
import { slideRegion, stripRegion } from '@/canvas/render/renderer';

/**
 * What an export produces: which regions of the design, at what pixel size,
 * in which files. Pure (no DOM) so it's easy to test.
 */

export type ImageFormat = 'png' | 'jpg' | 'webp';
export type ExportFormat = ImageFormat | 'pdf';
export type ExportQuality = 'standard' | 'high' | 'max';

/** `all` = every slide as its own file; `slides` = chosen slides; `strip` = the whole carousel as one wide image. */
export type ExportScope = { kind: 'all' } | { kind: 'slides'; indices: number[] } | { kind: 'strip' };

export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  scope: ExportScope;
  /** PNG/WebP only: leave the background out. */
  transparent?: boolean;
  /** Several images: one ZIP (default) or separate files. */
  packaging?: 'zip' | 'files';
}

export const QUALITY: Record<ExportQuality, { label: string; scale: number; lossy: number; originals: boolean; hint: string }> = {
  standard: { label: 'Standard', scale: 1, lossy: 0.88, originals: false, hint: 'The design’s own size — right for posting' },
  high: { label: 'High', scale: 2, lossy: 0.92, originals: false, hint: 'Twice the size — crisp on every screen' },
  max: {
    label: 'Maximum',
    scale: 3,
    lossy: 0.97,
    originals: true,
    hint: 'Three times the size, from your full-resolution photos',
  },
};

export const FORMAT_LABELS: Record<ExportFormat, string> = { png: 'PNG', jpg: 'JPG', webp: 'WebP', pdf: 'PDF' };
export const MIME: Record<ImageFormat, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/**
 * Canvas limits: Safari caps a canvas at ~16.7 million pixels and browsers cap
 * a side at 16384. Exports are scaled down to stay inside both.
 */
export const MAX_PIXELS = 16_000_000;
export const MAX_SIDE = 16_384;

export function outputScale(width: number, height: number, quality: ExportQuality): number {
  const wanted = QUALITY[quality].scale;
  const byArea = Math.sqrt(MAX_PIXELS / (width * height));
  const bySide = MAX_SIDE / Math.max(width, height);
  return Math.max(0.01, Math.min(wanted, byArea, bySide));
}

export interface ExportItem {
  /** File name (with extension) for image outputs; PDF pages use it for ordering only. */
  name: string;
  region: Rect;
  scale: number;
  width: number;
  height: number;
  slide: number | null;
}

/** A safe, readable file name stem from the design name. */
export function fileStem(name: string): string {
  const stem = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return stem || 'stardeck-design';
}

/** Whole output pixels, never rounding past the limits. */
const px = (v: number) => Math.max(1, Math.floor(v + 1e-6));

const ext = (format: ExportFormat) => (format === 'jpg' ? 'jpg' : format);

export function planExport(doc: DesignDocument, name: string, options: ExportOptions): ExportItem[] {
  const stem = fileStem(name);
  const imageExt = options.format === 'pdf' ? 'jpg' : ext(options.format);
  if (options.scope.kind === 'strip') {
    const region = stripRegion(doc);
    const scale = outputScale(region.width, region.height, options.quality);
    const suffix = doc.slides.length > 1 ? '-carousel' : '';
    return [
      {
        name: `${stem}${suffix}.${imageExt}`,
        region,
        scale,
        width: px(region.width * scale),
        height: px(region.height * scale),
        slide: null,
      },
    ];
  }
  const indices =
    options.scope.kind === 'all'
      ? doc.slides.map((_, i) => i)
      : [...new Set(options.scope.indices)].filter((i) => i >= 0 && i < doc.slides.length).sort((a, b) => a - b);
  const digits = Math.max(2, String(doc.slides.length).length);
  const single = doc.slides.length === 1;
  return indices.map((i) => {
    const region = slideRegion(doc, i);
    const scale = outputScale(region.width, region.height, options.quality);
    return {
      name: single ? `${stem}.${imageExt}` : `${stem}-${String(i + 1).padStart(digits, '0')}.${imageExt}`,
      region,
      scale,
      width: px(region.width * scale),
      height: px(region.height * scale),
      slide: i,
    };
  });
}

/** What the user downloads: one file, a ZIP of images, or a PDF. */
export function bundleName(name: string, options: ExportOptions, items: ExportItem[]): string | null {
  const stem = fileStem(name);
  if (options.format === 'pdf') return `${stem}.pdf`;
  if (items.length === 1) return items[0]!.name;
  return options.packaging === 'files' ? null : `${stem}.zip`;
}

/** Transparent exports only make sense for formats with alpha. */
export const supportsTransparency = (format: ExportFormat) => format === 'png' || format === 'webp';

/** Same design, background removed (for transparent PNG/WebP). */
export function withoutBackground(doc: DesignDocument): DesignDocument {
  return {
    ...doc,
    background: { type: 'solid', color: 'rgba(0,0,0,0)' },
    slides: doc.slides.map((s) => ({ ...s, fill: null })),
  };
}

/** PDF page size in points: 96 px per inch, except A-series posters, which print at A4-proportioned 150 dpi. */
export function pdfPageSize(doc: DesignDocument, sizeId?: string): { width: number; height: number } {
  const dpi = sizeId === 'poster' ? 150 : 96;
  return { width: (doc.slideWidth * 72) / dpi, height: (doc.slideHeight * 72) / dpi };
}
