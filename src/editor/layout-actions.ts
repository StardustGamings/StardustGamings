'use client';

import type { CollageFamily, CollageLayout, DesignDocument, LayoutSpec, PanoramaLayout } from '@/types/document';
import type { AssetMeta } from '@/assets/types';
import {
  createCollage,
  createPanorama,
  getLayout,
  regenerateCollage,
  regeneratePanorama,
  removeLayout,
  setPhotoLocked,
  shuffleCollage,
  shufflePanorama,
  type DimsLookup,
} from '@/layouts/apply';
import { moodParams, type CollageMood } from '@/layouts/collage';
import { generatePhotoDump } from '@/layouts/dump';
import { getDumpStyle } from '@/layouts/dump-styles';
import type { PanoramaParams } from '@/layouts/panorama';
import type { PhotoRef } from '@/layouts/types';
import { MAX_SLIDES } from '@/projects/formats';
import { toast } from '@/components/ui/toast-store';
import { getElements } from './core/ops';
import { assetMetaSync } from './photo-actions';
import { goToSlide } from './actions';
import { useEditor } from './store';

const ed = () => useEditor.getState();
const doc = (): DesignDocument | null => ed().history?.present ?? null;
export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Pixel sizes from the asset library, so layouts respect each photo's shape. */
export const assetDims: DimsLookup = (assetId) => {
  const meta = assetMetaSync(assetId);
  return meta ? { width: meta.width, height: meta.height } : null;
};

export const toPhotoRef = (a: AssetMeta): PhotoRef => ({ assetId: a.id, width: a.width, height: a.height, palette: a.palette });

/** The layout the current selection belongs to (first member found). */
export function selectedLayout(d: DesignDocument | null = doc()): LayoutSpec | null {
  if (!d) return null;
  for (const el of getElements(d, ed().selection)) {
    const spec = el.layout && getLayout(d, el.layout.id);
    if (spec) return spec;
  }
  return null;
}

/* ───────────── Collages ───────────── */

/**
 * Makes a collage on the active slide: from the selected photos if two or more
 * are selected, otherwise from the given library photos.
 */
export function makeCollage(family: CollageFamily, assets: AssetMeta[] = []): boolean {
  const d = doc();
  if (!d) return false;
  const selectedPhotos = getElements(d, ed().selection).filter((e) => e.type === 'image' && e.assetId && !e.locked);
  const useSelection = selectedPhotos.length >= 2;
  if (!useSelection && assets.length < 2) {
    toast({ title: 'Pick at least 2 photos', description: 'Select photos on the canvas, or choose some from your library.' });
    return false;
  }
  const slide = useSelection
    ? Math.floor((selectedPhotos[0]!.x + selectedPhotos[0]!.width / 2) / d.slideWidth)
    : ed().activeSlide;
  const result = createCollage(d, {
    slide: Math.max(0, Math.min(d.slides.length - 1, slide)),
    family,
    seed: newSeed(),
    elementIds: useSelection ? selectedPhotos.map((e) => e.id) : undefined,
    photos: useSelection ? undefined : assets.slice(0, 20).map(toPhotoRef),
    dims: assetDims,
  });
  ed().apply(() => result.doc);
  ed().select(result.ids);
  return true;
}

/** Adds a collage of library photos to the active slide. */
export function addCollage(
  assets: AssetMeta[],
  family: CollageFamily,
  seed: number,
  overrides?: Partial<Pick<CollageLayout, 'chaos' | 'gutter' | 'decor'>>,
) {
  const d = doc();
  if (!d || assets.length === 0) return;
  const result = createCollage(d, {
    slide: ed().activeSlide,
    family,
    seed,
    photos: assets.slice(0, 20).map(toPhotoRef),
    dims: assetDims,
    overrides,
  });
  ed().apply(() => result.doc);
  ed().select(result.ids);
  goToSlide(ed().activeSlide);
}

function updateCollage(fn: (d: DesignDocument, spec: CollageLayout) => DesignDocument, coalesce?: string) {
  const d = doc();
  const spec = selectedLayout(d);
  if (!d || spec?.kind !== 'collage') return;
  ed().apply((x) => fn(x, spec), coalesce ? { coalesce } : undefined);
}

export function shuffleLayout() {
  const d = doc();
  const spec = selectedLayout(d);
  if (!d || !spec) {
    toast({ title: 'Select a collage to shuffle' });
    return;
  }
  if (spec.kind === 'panorama') {
    ed().apply((x) => shufflePanorama(x, spec.id, newSeed(), assetDims));
    return;
  }
  const before = d;
  ed().apply((x) => shuffleCollage(x, spec.id, newSeed(), assetDims));
  if (doc() === before) toast({ title: 'Unlock at least two photos to shuffle them', duration: 2600 });
}

export function restyleCollage(mood: CollageMood) {
  updateCollage((x, spec) => regenerateCollage(x, spec.id, { ...moodParams(mood, spec), seed: newSeed() }, assetDims));
}

export function setCollageFamily(family: CollageFamily) {
  updateCollage((x, spec) =>
    spec.family === family ? x : regenerateCollage(x, spec.id, { family, seed: newSeed() }, assetDims),
  );
}

export function setCollageGutter(gutter: number) {
  updateCollage((x, spec) => regenerateCollage(x, spec.id, { gutter }, assetDims), 'collage-gutter');
}

export function setCollageChaos(chaos: number) {
  updateCollage((x, spec) => regenerateCollage(x, spec.id, { chaos }, assetDims), 'collage-chaos');
}

export function setCollageDecor(decor: boolean) {
  updateCollage((x, spec) => regenerateCollage(x, spec.id, { decor }, assetDims));
}

export function toggleLayoutLock(elementId: string) {
  const d = doc();
  const el = d && getElements(d, [elementId])[0];
  if (!el?.layout || el.layout.role !== 'photo') return;
  ed().apply((x) => setPhotoLocked(x, elementId, !el.layout!.locked));
}

export function selectLayoutMembers(layoutId: string) {
  const d = doc();
  if (!d) return;
  ed().select(d.elements.filter((e) => e.layout?.id === layoutId && !e.locked && !e.hidden).map((e) => e.id));
}

export function detachLayout(layoutId: string) {
  ed().apply((x) => removeLayout(x, layoutId));
  toast({ title: 'Detached', description: 'The photos are independent now.', duration: 2400 });
}

/* ───────────── Seamless panoramas ───────────── */

export function updatePanorama(patch: Partial<Omit<PanoramaLayout, 'id' | 'kind'>>, coalesce?: string) {
  const d = doc();
  const spec = selectedLayout(d);
  if (!d || spec?.kind !== 'panorama') return;
  ed().apply((x) => regeneratePanorama(x, spec.id, patch, assetDims), coalesce ? { coalesce } : undefined);
}

/**
 * Adds a seamless panorama. An empty design uses its own slides; otherwise the
 * panorama gets new slides after the current ones.
 */
export function addPanorama(assets: AssetMeta[], params: PanoramaParams) {
  const d = doc();
  if (!d || assets.length === 0) return;
  const empty = d.elements.length === 0;
  const start = empty ? 0 : d.slides.length;
  if (start + params.slides > MAX_SLIDES) {
    toast({ title: `That would go past ${MAX_SLIDES} slides`, description: 'Use fewer slides for the panorama.', tone: 'error' });
    return;
  }
  const result = createPanorama(d, { startSlide: start, photos: assets.map(toPhotoRef), params, seed: newSeed() });
  ed().apply(() => result.doc);
  ed().select(result.ids);
  goToSlide(start);
}

/* ───────────── Photo dump ───────────── */

/**
 * Builds a dump in the current design's size and appends its slides (or fills
 * an empty design).
 */
export function addPhotoDump(assets: AssetMeta[], styleId: string, seed: number, title?: string) {
  const d = doc();
  if (!d || assets.length === 0) return;
  const dump = generatePhotoDump({
    photos: assets.map(toPhotoRef),
    style: getDumpStyle(styleId),
    width: d.slideWidth,
    height: d.slideHeight,
    seed,
    title,
  });
  const empty = d.elements.length === 0;
  const offset = empty ? 0 : d.slides.length;
  if (offset + dump.slides.length > MAX_SLIDES) {
    toast({
      title: `That would go past ${MAX_SLIDES} slides`,
      description: 'Pick fewer photos, or start a new carousel.',
      tone: 'error',
    });
    return;
  }
  const dx = offset * d.slideWidth;
  const next: DesignDocument = empty
    ? { ...dump, guides: d.guides }
    : {
        ...d,
        // Appended slides carry the dump's background as their own fill.
        slides: [...d.slides, ...dump.slides.map((s) => ({ ...s, fill: s.fill ?? dump.background }))],
        elements: [...d.elements, ...dump.elements.map((e) => ({ ...e, x: e.x + dx }))],
        layouts: [...(d.layouts ?? []), ...(dump.layouts ?? [])],
      };
  ed().apply(() => next);
  ed().clearSelection();
  goToSlide(offset);
}
