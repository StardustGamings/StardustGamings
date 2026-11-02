'use client';

import type { DesignDocument, ImageElement, TextElement } from '@/types/document';
import type { BackgroundConcept, FontPairing } from '@/ai/schemas';
import { applyConcept } from '@/ai/backgrounds';
import { formatForSize, resizeDocument, type ResizeTarget } from '@/ai/resize';
import { SIZE_PRESETS } from '@/projects/formats';
import { useProjects } from '@/projects/store';
import { useAssets } from '@/assets/store';
import { homeSlide } from '@/animations/sequence';
import { restyleColors, restyleFonts } from '@/trends/restyle';
import type { TrendTypography } from '@/trends/schema';
import { loadFont } from '@/typography/fonts';
import { toast } from '@/components/ui/toast-store';
import { TEXT_PRESETS } from './core/factory';
import * as actions from './actions';
import { selectDoc, useEditor } from './store';

/**
 * Editor actions behind the AI tools. Each is a single undo step, and every
 * result is ordinary design content — editable like anything else.
 */

const ed = () => useEditor.getState();
const doc = (): DesignDocument | null => selectDoc(ed());

/** Visible text with real words in it — decorative quote marks, arrows and numbers don't count. */
const wordyTexts = (d: DesignDocument) =>
  d.elements.filter((e): e is TextElement => e.type === 'text' && !e.hidden && (e.text.match(/\p{L}/gu)?.length ?? 0) >= 2);

/** The design's headline: its biggest wordy text. */
export function headlineElement(d: DesignDocument): TextElement | null {
  const texts = wordyTexts(d);
  return texts.length ? texts.reduce((a, b) => (b.fontSize > a.fontSize ? b : a)) : null;
}

/** Enough words to write captions from, and small enough for the AI server's request limit in any script. */
const TEXT_BUDGET = 2400;

/** The design's words, headline first, then in reading order (slide by slide, top to bottom). */
export function designTexts(d: DesignDocument): string[] {
  const texts = wordyTexts(d);
  const headline = headlineElement(d);
  if (!headline) return [];
  const rest = texts.filter((t) => t !== headline).sort((a, b) => homeSlide(d, a) - homeSlide(d, b) || a.y - b.y || a.x - b.x);
  const out: string[] = [];
  let used = 0;
  for (const t of [headline, ...rest].slice(0, 40)) {
    const text = t.text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, Math.min(300, TEXT_BUDGET - used));
    if (!text) break;
    out.push(text);
    used += text.length;
  }
  return out;
}

/** Palettes of the photos in the design (from the local library), in design order. */
export function designPhotoPalettes(d: DesignDocument): string[][] {
  const assets = new Map(useAssets.getState().assets.map((a) => [a.id, a]));
  return d.elements
    .filter((e): e is ImageElement => e.type === 'image' && !!e.assetId)
    .map((e) => assets.get(e.assetId!)?.palette ?? [])
    .filter((p) => p.length > 0);
}

export function applyPalette(name: string, colors: string[]): void {
  if (!doc()) return;
  ed().apply((d) => restyleColors(d, colors));
  toast({ title: `${name} colours applied`, description: 'One undo takes it back.', tone: 'success', duration: 2200 });
}

const asTypography = (p: FontPairing): TrendTypography => ({
  id: 'ai',
  name: `${p.heading} + ${p.body}`,
  vibe: 'AI',
  sample: p.heading,
  heading: { family: p.heading, weight: p.headingWeight },
  body: { family: p.body, weight: p.bodyWeight },
  heat: 0,
});

export async function applyPairing(p: FontPairing): Promise<void> {
  await Promise.all([loadFont(p.heading, p.headingWeight, 'normal'), loadFont(p.body, p.bodyWeight, 'normal')]);
  const d = doc();
  if (!d) return;
  if (!d.elements.some((e) => e.type === 'text' && !e.locked)) {
    toast({ title: 'No text to restyle yet', description: 'Add a heading first — it takes the headline font.', tone: 'info' });
    return;
  }
  ed().apply((x) => restyleFonts(x, asTypography(p)));
  toast({ title: `Set in ${p.heading} + ${p.body}`, tone: 'success', duration: 2200 });
}

export function applyBackground(concept: BackgroundConcept, scope: 'slide' | 'all'): void {
  if (!doc()) return;
  const target = scope === 'all' ? ('all' as const) : { slide: ed().activeSlide };
  ed().apply((d) => applyConcept(d, concept, target, 'aibg-'));
  toast({
    title: `${concept.name} background ${scope === 'all' ? 'on every slide' : 'on this slide'}`,
    description: 'Its shapes are locked in Layers — unlock them to edit.',
    tone: 'success',
    duration: 2600,
  });
}

/** A caption as a text box on the current slide (most people paste it into the app instead). */
export function addCaptionText(text: string): void {
  const preset = TEXT_PRESETS.find((p) => p.id === 'body') ?? TEXT_PRESETS[0]!;
  actions.addText(preset, undefined, { text });
}

/** Photo sizes from the library, so regenerated collages keep their proportions. */
const dims = (assetId: string) => {
  const a = useAssets.getState().assets.find((x) => x.id === assetId);
  return a ? { width: a.width, height: a.height } : null;
};

export function resizedDocument(d: DesignDocument, target: ResizeTarget): DesignDocument {
  const size = SIZE_PRESETS[target];
  return resizeDocument(d, size.width, size.height, { dims });
}

/** Resizes the open design in place (one undo step) and updates its format. */
export async function resizeInPlace(target: ResizeTarget): Promise<void> {
  const { meta } = ed();
  const d = doc();
  if (!meta || !d) return;
  ed().apply((x) => resizedDocument(x, target));
  const format = formatForSize(target, meta.format, d.slides.length);
  const updated = await useProjects
    .getState()
    .setSize(meta.id, target, format)
    .catch(() => null);
  if (updated) useEditor.setState({ meta: updated });
  toast({
    title: `Resized to ${SIZE_PRESETS[target].label} · ${SIZE_PRESETS[target].ratio}`,
    description: 'Undo puts it back.',
    tone: 'success',
  });
}
