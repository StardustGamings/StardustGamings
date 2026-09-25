import type { DesignDocument } from '@/types/document';
import { ensureDocumentFonts } from './fonts';
import { renderDocument, slideRegion } from './render';

/**
 * Renders the first slide to a small WebP (PNG fallback) for project listings.
 * Returns null where canvas isn't available (e.g. tests, very old browsers).
 */
export async function renderThumbnail(doc: DesignDocument, maxSize = 480): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  await ensureDocumentFonts(doc);
  const region = slideRegion(doc, 0);
  const scale = Math.min(maxSize / region.width, maxSize / region.height);
  const w = Math.max(1, Math.round(region.width * scale));
  const h = Math.max(1, Math.round(region.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  renderDocument(ctx, doc, { region, scale });
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.86);
    } catch {
      resolve(null);
    }
  });
}
