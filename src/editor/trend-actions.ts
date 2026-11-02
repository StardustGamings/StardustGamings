'use client';

import type { DesignDocument } from '@/types/document';
import type { LookDefinition } from '@/filters/looks';
import { loadFont } from '@/typography/fonts';
import { ruleStyleId } from '@/trends/pack';
import { restyleColors, restyleDocument, restyleFonts, styleKit, type RestyleParts } from '@/trends/restyle';
import type { TrendStyle, TrendTypography } from '@/trends/schema';
import { useTrends } from '@/trends/store';
import { useUi } from '@/settings/ui-store';
import { toast } from '@/components/ui/toast-store';
import { applyLook, lookTargets } from './filter-actions';
import { usePlayback } from './playback';
import { selectDoc, useEditor } from './store';
import * as actions from './actions';

/**
 * The editor's trend actions: each one is a single undo step. Fonts are loaded
 * before text is re-measured, so restyled text boxes fit the new type.
 */

const ed = () => useEditor.getState();
const doc = (): DesignDocument | null => selectDoc(ed());

async function loadPairing(t: TrendTypography): Promise<void> {
  await Promise.all([
    loadFont(t.heading.family, t.heading.weight, t.heading.style),
    loadFont(t.body.family, t.body.weight, t.body.style),
  ]);
}

export async function applyKit(style: TrendStyle, parts: RestyleParts): Promise<void> {
  const kit = styleKit(useTrends.getState().pack, style);
  if (parts.fonts !== false && kit.typography) await loadPairing(kit.typography);
  if (!doc()) return;
  ed().apply((d) => restyleDocument(d, kit, parts));
  toast({ title: `Restyled as ${style.name}`, description: 'One undo takes it back.', tone: 'success', duration: 2600 });
  if (parts.motion !== false && kit.animate) usePlayback.getState().play(ed().activeSlide, true);
}

export function applyTrendPalette(name: string, colors: string[]): void {
  if (!doc()) return;
  ed().apply((d) => restyleColors(d, colors));
  toast({ title: `${name} colours applied`, tone: 'success', duration: 2000 });
}

export async function applyTrendFonts(typography: TrendTypography): Promise<void> {
  await loadPairing(typography);
  const d = doc();
  if (!d) return;
  if (!d.elements.some((e) => e.type === 'text' && !e.locked)) {
    toast({ title: 'No text to restyle yet', description: 'Add a heading first — it takes the headline font.', tone: 'info' });
    return;
  }
  ed().apply((x) => restyleFonts(x, typography));
  toast({
    title: `Set in ${typography.name}`,
    description: `${typography.heading.family} + ${typography.body.family}`,
    tone: 'success',
    duration: 2200,
  });
}

/** A trend look on every photo in the design. */
export function applyTrendLook(look: LookDefinition, intensity = 85): void {
  const photos = lookTargets('all');
  if (photos.length === 0) {
    toast({ title: 'No photos yet', description: 'Add a photo, then pick a filter.', tone: 'info' });
    return;
  }
  applyLook(look, 'all', intensity);
  toast({ title: `${look.name} on ${photos.length} photo${photos.length === 1 ? '' : 's'}`, tone: 'success', duration: 2200 });
}

export const addTrendSticker = (ref: string) => actions.addSticker(ref);

/** A layout rule from the drop, run on photos from the library and added as new slides. */
export const startTrendDump = (ruleId: string) =>
  useUi.getState().openPhotoFlow('dump', 'current', undefined, ruleStyleId(ruleId));

/** A trending format, previewed with "add to this design" / "replace". */
export const openTrendFormat = (templateId: string) => useUi.getState().openTemplate(templateId, 'editor');
