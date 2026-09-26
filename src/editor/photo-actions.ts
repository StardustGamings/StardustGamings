'use client';

import type {
  CurvePoint,
  Cutout,
  CutoutBackdrop,
  DesignDocument,
  ImageAdjustments,
  ImageCurves,
  ImageElement,
  ImagePerspective,
} from '@/types/document';
import { computeCutout, describeCutoutError } from '@/images/cutout';
import type { CutoutMethod } from '@/images/cutout/types';
import type { AssetMeta } from '@/assets/types';
import type { VideoClip } from '@/types/animation';
import { homeSlide, MAX_SLIDE_DURATION, slideDuration } from '@/animations/sequence';
import { peekAsset, loadAsset } from '@/assets/cache';
import { useAssets } from '@/assets/store';
import { slideIndexOf } from '@/projects/document';
import { toast } from '@/components/ui/toast-store';
import { cleanAdjustments, type AdjustmentKey } from '@/images/adjustments';
import { frameForAspect, resizeFrameKeepingPhoto, zoomContent } from '@/images/content';
import { autoAdjustments } from '@/images/auto';
import { clamp } from '@/utils/math';
import { createFrame, createImage, slideCenter, type FramePreset } from './core/factory';
import { addElements, getElements, updateElements } from './core/ops';
import type { Point } from './core/geometry';
import { useEditor } from './store';

const ed = () => useEditor.getState();
const doc = (): DesignDocument | null => ed().history?.present ?? null;

/** Asset metadata without waiting (library store first, then the decode cache). */
export function assetMetaSync(id: string | null | undefined): AssetMeta | null {
  if (!id) return null;
  return (
    useAssets.getState().assets.find((a) => a.id === id) ??
    peekAsset(id, 'thumb', { load: false })?.meta ??
    peekAsset(id, 'preview', { load: false })?.meta ??
    null
  );
}

export function selectedImage(): ImageElement | null {
  const d = doc();
  const sel = ed().selection;
  if (!d || sel.length !== 1) return null;
  const el = getElements(d, sel)[0];
  return el?.type === 'image' ? el : null;
}

function updateImage(id: string, fn: (el: ImageElement) => ImageElement, coalesce?: string) {
  ed().apply((d) => updateElements(d, [id], (el) => (el.type === 'image' ? fn(el) : el)), coalesce ? { coalesce } : undefined);
}

const layerName = (name: string) => name.replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 40) || 'Photo';

/* ───────────── Adding photos ───────────── */

/** Adds photos to the active slide (cascading when there are several) as one undo step. */
/** A new clip plays the first 15 seconds of the video, looping, with sound. */
export function defaultClip(asset: AssetMeta): VideoClip {
  return { trimStart: 0, trimEnd: Math.min(asset.duration ?? 5, 15), speed: 1, muted: false, loop: true };
}

/** Lengthens the slides holding video so each clip plays through once (never shortens). */
function fitSlidesToClips(d: DesignDocument, ids: Set<string>): DesignDocument {
  let slides = d.slides;
  for (const el of d.elements) {
    if (!ids.has(el.id) || el.type !== 'image' || !el.video) continue;
    const i = homeSlide(d, el);
    const need = Math.min(
      MAX_SLIDE_DURATION,
      Math.ceil((((el.video.trimEnd - el.video.trimStart) / el.video.speed) * 1000) / 100) * 100,
    );
    if (need > slideDuration(d, i)) slides = slides.map((s, k) => (k === i ? { ...s, duration: need } : s));
  }
  return slides === d.slides ? d : { ...d, slides };
}

export function placePhotos(assets: AssetMeta[], at?: Point): string[] {
  const d = doc();
  if (!d || assets.length === 0) return [];
  const origin = at ?? slideCenter(d, ed().activeSlide);
  const step = d.slideWidth * 0.04;
  const els = assets.map((a, i) => {
    const offset = (i - (assets.length - 1) / 2) * step;
    const el = createImage(d, { x: origin.x + offset, y: origin.y + offset }, a);
    return a.kind === 'video' ? { ...el, video: defaultClip(a) } : el;
  });
  const ids = new Set(els.map((e) => e.id));
  ed().apply((x) => fitSlidesToClips(addElements(x, els), ids));
  ed().select(els.map((e) => e.id));
  ed().setActiveSlide(slideIndexOf(els[els.length - 1]!, d));
  ed().setTool('select');
  return els.map((e) => e.id);
}

/** Puts a photo into an existing image element, resetting its crop but keeping its look. */
export function fillFrame(id: string, asset: AssetMeta) {
  updateImage(id, (el) => {
    const {
      focusX: _fx,
      focusY: _fy,
      zoom: _z,
      straighten: _s,
      turns: _t,
      flipX: _h,
      flipY: _v,
      cutout: _c,
      video: _video,
      ...rest
    } = el;
    const next = { ...rest, assetId: asset.id, name: asset.kind === 'sticker' ? 'Sticker' : layerName(asset.name) };
    return asset.kind === 'video' ? { ...next, video: defaultClip(asset) } : next;
  });
  if (asset.kind === 'video') ed().apply((d) => fitSlidesToClips(d, new Set([id])), { coalesce: `fill-${id}` });
  ed().select([id]);
}

/**
 * Imports files and places them: the first fills `targetId` (a frame it was
 * dropped on) and the rest are added around `at`.
 */
export async function importAndPlace(files: Iterable<File>, options: { at?: Point; targetId?: string | null } = {}) {
  const list = [...files];
  if (list.length === 0) return;
  const assets = await useAssets.getState().importFiles(list, 'photo');
  if (assets.length === 0 || !doc()) return;
  let rest = assets;
  const target = options.targetId ? getElements(doc()!, [options.targetId])[0] : undefined;
  if (target?.type === 'image' && !target.locked) {
    fillFrame(target.id, assets[0]!);
    rest = assets.slice(1);
  }
  if (rest.length) placePhotos(rest, options.at);
}

export async function importStickers(files: Iterable<File>, at?: Point) {
  const assets = await useAssets.getState().importFiles(files, 'sticker');
  if (assets.length) placePhotos(assets, at);
}

export function addFrame(preset: FramePreset, at?: Point) {
  const d = doc();
  if (!d) return;
  const el = createFrame(d, at ?? slideCenter(d, ed().activeSlide), preset);
  ed().apply((x) => addElements(x, [el]));
  ed().select([el.id]);
  ed().setActiveSlide(slideIndexOf(el, d));
}

/* ───────────── Crop mode ───────────── */

let cropBefore: { id: string; el: ImageElement } | null = null;

export function canCrop(el: ImageElement | null): el is ImageElement {
  return !!el && !!el.assetId && !el.locked && !!assetMetaSync(el.assetId);
}

export function enterCrop(id?: string) {
  const d = doc();
  const el = id ? (getElements(d!, [id])[0] as ImageElement | undefined) : selectedImage();
  if (!el || el.type !== 'image' || !canCrop(el)) return false;
  ed().commit();
  cropBefore = { id: el.id, el };
  ed().setCropping(el.id);
  return true;
}

export function commitCrop() {
  ed().commit();
  cropBefore = null;
  ed().setCropping(null);
}

export function cancelCrop() {
  ed().cancel();
  const before = cropBefore;
  cropBefore = null;
  const d = doc();
  if (before && d) {
    const now = getElements(d, [before.id])[0];
    if (now && JSON.stringify(now) !== JSON.stringify(before.el)) updateImage(before.id, () => before.el);
  }
  ed().setCropping(null);
}

function withDims(fn: (el: ImageElement, w: number, h: number) => ImageElement, coalesce?: string) {
  const el = selectedImage();
  const meta = assetMetaSync(el?.assetId);
  if (!el || !meta || el.locked) return;
  updateImage(el.id, (x) => fn(x, meta.width, meta.height), coalesce);
}

export const CROP_ASPECTS: { id: string; label: string; ratio: number | 'original' | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: 'original' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

export function setCropAspect(ratio: number | 'original') {
  withDims((el, w, h) => {
    const oriented = el.turns && el.turns % 2 ? h / w : w / h;
    const r = ratio === 'original' ? oriented : ratio;
    return resizeFrameKeepingPhoto(el, frameForAspect(el, r), w, h);
  });
}

export function setPhotoZoom(zoom: number) {
  withDims((el, w, h) => zoomContent(el, w, h, zoom), 'crop-zoom');
}

export function setStraighten(deg: number) {
  withDims((el) => ({ ...el, straighten: clamp(Math.round(deg * 10) / 10, -45, 45) || undefined }), 'crop-straighten');
}

export function rotatePhoto90() {
  withDims((el) => {
    const turns = (((el.turns ?? 0) + 1) % 4) as 0 | 1 | 2 | 3;
    return { ...el, turns: turns || undefined, focusX: undefined, focusY: undefined };
  });
}

export function flipPhoto(axis: 'x' | 'y') {
  withDims((el) => (axis === 'x' ? { ...el, flipX: !el.flipX || undefined } : { ...el, flipY: !el.flipY || undefined }));
}

export function resetCrop() {
  withDims((el) => {
    const { focusX: _fx, focusY: _fy, zoom: _z, straighten: _s, turns: _t, flipX: _h, flipY: _v, ...rest } = el;
    return rest;
  });
}

export function setFit(fit: ImageElement['fit']) {
  withDims((el) => ({ ...el, fit, zoom: undefined, focusX: undefined, focusY: undefined }));
}

/* ───────────── Adjustments ───────────── */

export function setAdjustment(key: AdjustmentKey, value: number) {
  const el = selectedImage();
  if (!el || el.locked) return;
  updateImage(el.id, (x) => ({ ...x, adjust: cleanAdjustments({ ...x.adjust, [key]: value }) }), `adj:${key}`);
}

export function setAdjustments(adjust: ImageAdjustments | undefined) {
  const el = selectedImage();
  if (!el || el.locked) return;
  updateImage(el.id, (x) => ({ ...x, adjust: adjust ? cleanAdjustments(adjust) : undefined }));
}

export function setCurve(channel: keyof ImageCurves, points: CurvePoint[] | undefined) {
  const el = selectedImage();
  if (!el || el.locked) return;
  updateImage(
    el.id,
    (x) => {
      const curves: ImageCurves = { ...x.curves, [channel]: points };
      if (!points) delete curves[channel];
      return { ...x, curves: Object.keys(curves).length ? curves : undefined };
    },
    `curve:${channel}`,
  );
}

export function resetCurves() {
  const el = selectedImage();
  if (el && !el.locked) updateImage(el.id, (x) => ({ ...x, curves: undefined }));
}

export function setPerspective(axis: keyof ImagePerspective, value: number) {
  const el = selectedImage();
  if (!el || el.locked) return;
  updateImage(
    el.id,
    (x) => {
      const next = { vertical: 0, horizontal: 0, ...x.perspective, [axis]: Math.round(value) };
      return { ...x, perspective: next.vertical || next.horizontal ? next : undefined };
    },
    `persp:${axis}`,
  );
}

/** One-tap enhance from the photo's histogram (runs locally on the thumbnail). */
export async function autoEnhance() {
  const el = selectedImage();
  if (!el?.assetId || el.locked) return;
  const asset = await loadAsset(el.assetId, 'thumb');
  if (!asset) return;
  const auto = autoAdjustments(asset.image);
  if (!auto) {
    toast({ title: 'This photo already looks balanced ✨', duration: 2200 });
    return;
  }
  updateImage(el.id, (x) => ({ ...x, adjust: cleanAdjustments({ ...x.adjust, ...auto }) }));
  toast({ title: 'Auto-enhanced', action: { label: 'Undo', onClick: () => ed().undo() } });
}

/* ───────────── Background removal ───────────── */

export async function removeBackground(method: CutoutMethod) {
  const el = selectedImage();
  if (!el?.assetId || el.locked) return;
  try {
    const cutout = await computeCutout(el, method);
    // The element may have changed (or been deleted) while the model ran.
    const current = doc() && getElements(doc()!, [el.id])[0];
    if (!current || current.type !== 'image' || current.assetId !== el.assetId) return;
    const backdrop = current.cutout?.backdrop ?? cutout.backdrop;
    updateImage(el.id, (x) => ({ ...x, cutout: { ...cutout, backdrop } }));
    toast({ title: 'Background removed ✂️', tone: 'success', action: { label: 'Undo', onClick: () => ed().undo() } });
  } catch (err) {
    const { title, description } = describeCutoutError(err);
    toast({ title, description, tone: 'error', duration: 7000 });
  }
}

export function updateCutout(patch: Partial<Cutout>, coalesce?: string) {
  const el = selectedImage();
  if (!el?.cutout || el.locked) return;
  updateImage(el.id, (x) => (x.cutout ? { ...x, cutout: { ...x.cutout, ...patch } } : x), coalesce);
}

export function setBackdrop(backdrop: CutoutBackdrop, coalesce?: string) {
  updateCutout({ backdrop }, coalesce);
}

export function restoreBackground() {
  const el = selectedImage();
  if (!el?.cutout || el.locked) return;
  updateImage(el.id, (x) => {
    const { cutout: _c, ...rest } = x;
    return rest;
  });
}
