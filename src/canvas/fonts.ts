import type { DesignDocument } from '@/types/document';
import { documentFonts } from '@/projects/document';
import { fontsLoadedVersion, loadFonts } from '@/typography/fonts';
import { invalidateTextLayouts } from './render/text';

/**
 * Loads every font a document uses. Resolves `true` if new glyph metrics became
 * available (cached text layouts are invalidated so callers should redraw).
 */
export async function ensureDocumentFonts(doc: DesignDocument): Promise<boolean> {
  const before = fontsLoadedVersion();
  await loadFonts(documentFonts(doc));
  if (fontsLoadedVersion() === before) return false;
  invalidateTextLayouts();
  return true;
}
