'use client';

import type { DesignDocument, DesignElement } from '@/types/document';
import { duplicateSlide, insertSlide, removeSlide, slideIndexOf } from '@/projects/document';
import { slideRegion, stripRegion } from '@/canvas/render';
import { elementBounds } from '@/canvas/render/renderer';
import { toast } from '@/components/ui/toast-store';
import { useCamera } from './camera';
import { readClipboard, writeClipboard } from './core/clipboard';
import {
  createShape,
  createSticker,
  createText,
  slideCenter,
  SHAPE_PRESETS,
  TEXT_PRESETS,
  type ShapePreset,
  type TextPreset,
} from './core/factory';
import { unionRects, type Point } from './core/geometry';
import {
  addElements,
  alignElements,
  distributeElements,
  duplicateElements,
  getElements,
  groupElements,
  removeElements,
  reorderElements,
  setHidden,
  setLocked,
  translateElements,
  ungroupElements,
  type Alignment,
  type ReorderMode,
} from './core/ops';
import { nextZoom } from './zoom';
import { useEditor } from './store';

const ed = () => useEditor.getState();
const doc = (): DesignDocument | null => ed().history?.present ?? null;
const selected = (): DesignElement[] => {
  const d = doc();
  return d ? getElements(d, ed().selection) : [];
};

/* ───────────── View ───────────── */

export function fitSlide(index = ed().activeSlide) {
  const d = doc();
  if (!d) return;
  const vw = useCamera.getState().vw;
  useCamera.getState().fitTo(slideRegion(d, index), vw < 640 ? 20 : 56);
}

export function fitAll() {
  const d = doc();
  if (d) useCamera.getState().fitTo(stripRegion(d), 40);
}

export function zoomStep(direction: 1 | -1) {
  const cam = useCamera.getState();
  cam.zoomAt({ x: cam.vw / 2, y: cam.vh / 2 }, nextZoom(cam.zoom, direction));
}

export function zoomTo(zoom: number) {
  const cam = useCamera.getState();
  cam.zoomAt({ x: cam.vw / 2, y: cam.vh / 2 }, zoom);
}

/** Selects a slide and brings it into view (keeping the zoom level). */
export function goToSlide(index: number) {
  const d = doc();
  if (!d) return;
  ed().setActiveSlide(index);
  const r = slideRegion(d, ed().activeSlide);
  const cam = useCamera.getState();
  const viewW = cam.vw / cam.zoom;
  const visible = cam.x <= r.x && cam.x + viewW >= r.x + r.width;
  if (!visible) cam.fitTo(r, cam.vw < 640 ? 20 : 56, Math.max(cam.zoom, 0.05));
}

/* ───────────── Slides ───────────── */

export function addSlide() {
  const at = ed().activeSlide + 1;
  ed().apply((d) => insertSlide(d, at));
  goToSlide(at);
}

export function duplicateActiveSlide() {
  const at = ed().activeSlide;
  ed().apply((d) => duplicateSlide(d, at));
  goToSlide(at + 1);
}

export function deleteActiveSlide() {
  const at = ed().activeSlide;
  const d = doc();
  if (!d || d.slides.length <= 1) return;
  ed().apply((x) => removeSlide(x, at));
  toast({ title: `Slide ${at + 1} deleted`, action: { label: 'Undo', onClick: () => ed().undo() } });
}

/* ───────────── Adding elements ───────────── */

function insertAndSelect(el: DesignElement, edit = false) {
  ed().apply((d) => addElements(d, [el]));
  ed().select([el.id]);
  const d = doc();
  if (d) ed().setActiveSlide(slideIndexOf(el, d));
  if (edit && el.type === 'text') ed().setEditingText(el.id);
  ed().setTool('select');
}

const activeCenter = (): Point => slideCenter(doc()!, ed().activeSlide);

export function addText(preset: TextPreset = TEXT_PRESETS[0]!, at?: Point, options: { edit?: boolean; text?: string } = {}) {
  const d = doc();
  if (!d) return null;
  const el = createText(d, at ?? activeCenter(), preset, options.text);
  insertAndSelect(el, options.edit);
  return el;
}

export function addShape(preset: ShapePreset = SHAPE_PRESETS[0]!, at?: Point) {
  const d = doc();
  if (!d) return null;
  const el = createShape(d, at ?? activeCenter(), preset);
  insertAndSelect(el);
  return el;
}

export function addSticker(stickerId: string, at?: Point) {
  const d = doc();
  if (!d) return null;
  const el = createSticker(d, at ?? activeCenter(), stickerId);
  insertAndSelect(el);
  return el;
}

/* ───────────── Selection ───────────── */

export function selectAll() {
  const d = doc();
  if (!d) return;
  // Select everything on the active slide first; a second press selects the whole strip.
  const onSlide = d.elements.filter((e) => !e.locked && !e.hidden && slideIndexOf(e, d) === ed().activeSlide).map((e) => e.id);
  const current = ed().selection;
  const all = d.elements.filter((e) => !e.locked && !e.hidden).map((e) => e.id);
  const sameAsSlide = onSlide.length === current.length && onSlide.every((id) => current.includes(id));
  ed().select(sameAsSlide ? all : onSlide);
}

export function deleteSelection() {
  const ids = ed().selection;
  if (ids.length === 0) return;
  ed().apply((d) => removeElements(d, ids));
  ed().clearSelection();
}

export function duplicateSelection() {
  const ids = ed().selection;
  if (ids.length === 0) {
    duplicateActiveSlide();
    return;
  }
  const d = doc();
  if (!d) return;
  const offset = Math.round(d.slideWidth * 0.02);
  const result = duplicateElements(d, ids, { x: offset, y: offset });
  ed().apply(() => result.doc);
  ed().select(result.ids);
}

export function nudge(dx: number, dy: number) {
  const ids = ed().selection.filter((id) => !getElements(doc()!, [id])[0]?.locked);
  if (ids.length === 0) return;
  ed().apply((d) => translateElements(d, ids, dx, dy), { coalesce: `nudge:${ids.join(',')}` });
}

export function reorder(mode: ReorderMode) {
  const ids = ed().selection;
  if (ids.length) ed().apply((d) => reorderElements(d, ids, mode));
}

export function groupSelection() {
  const ids = ed().selection;
  const d = doc();
  if (!d || ids.length < 2) return;
  const result = groupElements(d, ids);
  if (!result.groupId) return;
  ed().apply(() => result.doc);
}

export function ungroupSelection() {
  const ids = ed().selection;
  if (ids.length) ed().apply((d) => ungroupElements(d, ids));
}

export function toggleLock() {
  const els = selected();
  if (els.length === 0) return;
  const lock = !els.every((e) => e.locked);
  ed().apply((d) =>
    setLocked(
      d,
      els.map((e) => e.id),
      lock,
    ),
  );
  if (lock) toast({ title: 'Locked', description: 'Unlock it from the layers panel or with the same shortcut.', duration: 2500 });
}

export function toggleHidden() {
  const els = selected();
  if (els.length === 0) return;
  const hide = !els.every((e) => e.hidden);
  ed().apply((d) =>
    setHidden(
      d,
      els.map((e) => e.id),
      hide,
    ),
  );
  if (hide) ed().clearSelection();
}

export function alignSelection(alignment: Alignment) {
  const d = doc();
  const els = selected();
  if (!d || els.length === 0) return;
  // One unit (element or group) aligns to its slide; several align to each other.
  const units = new Set(els.map((e) => e.groupId ?? e.id));
  const reference = units.size > 1 ? unionRects(els.map(elementBounds))! : slideRegion(d, slideIndexOf(els[els.length - 1]!, d));
  ed().apply((x) =>
    alignElements(
      x,
      els.map((e) => e.id),
      alignment,
      reference,
    ),
  );
}

export function distributeSelection(axis: 'x' | 'y') {
  const ids = ed().selection;
  if (ids.length >= 3) ed().apply((d) => distributeElements(d, ids, axis));
}

/* ───────────── Clipboard ───────────── */

export async function copySelection() {
  const els = selected();
  if (els.length === 0) return false;
  await writeClipboard(els);
  return true;
}

export async function cutSelection() {
  if (await copySelection()) deleteSelection();
}

let pasteCount = 0;

/** Inserts copied elements onto the active slide (or centred on `at`), offset when repeated. */
export function pasteElements(elements: DesignElement[], at?: Point) {
  const d = doc();
  if (!d || elements.length === 0) return;
  const bounds = unionRects(elements.map(elementBounds))!;
  let dx: number;
  let dy: number;
  if (at) {
    dx = at.x - (bounds.x + bounds.width / 2);
    dy = at.y - (bounds.y + bounds.height / 2);
  } else {
    const sourceSlide = Math.floor((bounds.x + bounds.width / 2) / d.slideWidth);
    pasteCount = ed().selection.length ? pasteCount + 1 : 1;
    const step = Math.round(d.slideWidth * 0.02) * pasteCount;
    dx = (ed().activeSlide - sourceSlide) * d.slideWidth + step;
    dy = step;
  }
  const incoming = { ...d, elements };
  const result = duplicateElements(
    incoming,
    elements.map((e) => e.id),
    { x: dx, y: dy },
  );
  const copies = result.doc.elements.filter((e) => result.ids.includes(e.id));
  ed().apply((x) => addElements(x, copies));
  ed().select(result.ids);
}

export async function paste(at?: Point) {
  const content = await readClipboard();
  if (!content) return;
  if (content.kind === 'text')
    addText(
      TEXT_PRESETS.find((p) => p.id === 'body'),
      at,
      { text: content.text },
    );
  else pasteElements(content.elements, at);
}
