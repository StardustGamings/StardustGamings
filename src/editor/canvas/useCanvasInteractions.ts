'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { DesignDocument, DesignElement, ImageElement, TextElement } from '@/types/document';
import type { Rect } from '@/canvas/render/types';
import { elementBounds, stripRegion } from '@/canvas/render/renderer';
import { slideIndexOf } from '@/projects/document';
import { clamp } from '@/utils/math';
import { TEXT_PRESETS } from '../core/factory';
import {
  angleFrom,
  CORNER_HANDLES,
  ALL_HANDLES,
  boxCenter,
  handlePoint,
  normalizeAngle,
  pointInBox,
  rectFromPoints,
  rectsIntersect,
  resizeBox,
  rotatePoint,
  snapAngle,
  unionRects,
  type Box,
  type Handle,
  type Point,
} from '../core/geometry';
import {
  addGuide,
  duplicateElements,
  expandToGroups,
  fitTextHeight,
  getElements,
  moveGuide,
  removeGuide,
  scaleElementContent,
  translateElements,
  updateElements,
} from '../core/ops';
import { collectSnapTargets, gridSizeFor, snapRect, snapValue, type SnapTargets } from '../core/snapping';
import { addText } from '../actions';
import { assetMetaSync, commitCrop, enterCrop } from '../photo-actions';
import { openPhotoPicker } from '../file-picker';
import {
  panContent,
  photoCornersInFrame,
  photoQuad,
  pointInQuad,
  resizeFrameKeepingPhoto,
  worldToFrame,
  zoomContent,
} from '@/images/content';
import { useCamera, screenToDoc } from '../camera';
import { selectDoc, useEditor } from '../store';
import { useInteraction } from './interaction-store';

export const RULER_SIZE = 22;
const ROTATE_OFFSET = 26;
const DRAG_THRESHOLD = { mouse: 3, touch: 8, pen: 4 } as const;
const HANDLE_RADIUS = { mouse: 7, touch: 20, pen: 10 } as const;
const SNAP_PX = 6;

type PointerKind = keyof typeof DRAG_THRESHOLD;

/** The box that carries transform handles for the current selection. */
export interface TransformFrame {
  box: Box;
  ids: string[];
  /** Single element (or single group) vs. a mixed multi-selection. */
  single: boolean;
  handles: Handle[];
  locked: boolean;
}

export function transformFrame(doc: DesignDocument, selection: string[]): TransformFrame | null {
  const els = getElements(doc, selection);
  if (els.length === 0) return null;
  const locked = els.some((e) => e.locked);
  if (els.length === 1) {
    const el = els[0]!;
    const handles =
      el.type === 'text'
        ? ([...CORNER_HANDLES, 'e', 'w'] as Handle[])
        : el.type === 'sticker'
          ? CORNER_HANDLES
          : el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow')
            ? (['e', 'w'] as Handle[])
            : ALL_HANDLES;
    return {
      box: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation },
      ids: [el.id],
      single: true,
      handles,
      locked,
    };
  }
  const bounds = unionRects(els.map(elementBounds))!;
  const groups = new Set(els.map((e) => e.groupId ?? `solo:${e.id}`));
  return {
    box: { ...bounds, rotation: 0 },
    ids: els.map((e) => e.id),
    single: groups.size === 1,
    handles: CORNER_HANDLES,
    locked,
  };
}

/** Rotation handle position in document space. */
export function rotateHandlePoint(box: Box, zoom: number): Point {
  const top = handlePoint(box, 'n');
  const c = boxCenter(box);
  const up = rotatePoint({ x: c.x, y: c.y - 1 }, c, box.rotation);
  const dir = { x: up.x - c.x, y: up.y - c.y };
  return { x: top.x + (dir.x * ROTATE_OFFSET) / zoom, y: top.y + (dir.y * ROTATE_OFFSET) / zoom };
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; last: Point; moved: boolean; start: Point; touchTap: boolean }
  | { kind: 'pinch'; startDist: number; startZoom: number; lastMid: Point }
  | {
      kind: 'pending';
      start: Point;
      startDoc: Point;
      ids: string[];
      alt: boolean;
      pointer: PointerKind;
      hitId: string | null;
      wasSelected: boolean;
    }
  | { kind: 'move'; startDoc: Point; ids: string[]; startBounds: Rect; targets: SnapTargets; baseDoc: DesignDocument }
  | {
      kind: 'resize';
      handle: Handle;
      frame: TransformFrame;
      grab: Point;
      targets: SnapTargets;
      start: DesignElement[];
    }
  | { kind: 'rotate'; center: Point; startAngle: number; frame: TransformFrame; start: DesignElement[] }
  | { kind: 'marquee'; startDoc: Point; base: string[]; active: boolean; start: Point }
  | { kind: 'crop-pan'; startDoc: Point; start: ImageElement; w: number; h: number }
  | { kind: 'crop-frame'; handle: Handle; start: ImageElement; grab: Point; w: number; h: number }
  | { kind: 'crop-scale'; start: ImageElement; anchor: Point; startDist: number; w: number; h: number }
  | { kind: 'guide'; id: string; axis: 'x' | 'y'; creating: boolean; targets?: SnapTargets };

const doc = () => selectDoc(useEditor.getState());

function hitTest(d: DesignDocument, p: Point, zoom: number, opts: { includeLocked?: boolean } = {}): DesignElement | null {
  for (let i = d.elements.length - 1; i >= 0; i--) {
    const el = d.elements[i]!;
    if (el.hidden || (el.locked && !opts.includeLocked)) continue;
    const thin = el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow');
    if (pointInBox(p, el, (thin ? 10 : 2) / zoom)) return el;
  }
  return null;
}

function handleAt(frame: TransformFrame, screen: Point, radius: number): Handle | 'rotate' | null {
  const cam = useCamera.getState();
  const toScreen = (p: Point) => ({ x: (p.x - cam.x) * cam.zoom, y: (p.y - cam.y) * cam.zoom });
  const near = (p: Point) => Math.hypot(p.x - screen.x, p.y - screen.y) <= radius;
  if (near(toScreen(rotateHandlePoint(frame.box, cam.zoom)))) return 'rotate';
  for (const h of frame.handles) if (near(toScreen(handlePoint(frame.box, h)))) return h;
  return null;
}

/** Crop-mode target under a screen point: frame handle, photo corner, or the photo itself. */
function cropHitTest(el: ImageElement, w: number, h: number, screen: Point, docPoint: Point, radius: number) {
  const cam = useCamera.getState();
  const toScreen = (p: Point) => ({ x: (p.x - cam.x) * cam.zoom, y: (p.y - cam.y) * cam.zoom });
  const near = (p: Point) => Math.hypot(p.x - screen.x, p.y - screen.y) <= radius;
  const box = { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation };
  for (const handle of ALL_HANDLES) if (near(toScreen(handlePoint(box, handle)))) return { kind: 'frame' as const, handle };
  const corners = photoCornersInFrame(el, w, h);
  const quad = photoQuad(el, w, h);
  for (let i = 0; i < 4; i++) {
    if (near(toScreen(quad[i]!))) return { kind: 'corner' as const, anchor: corners[(i + 2) % 4]! };
  }
  if (pointInBox(docPoint, box) || pointInQuad(docPoint, quad)) return { kind: 'photo' as const };
  return null;
}

const CURSORS: Record<Handle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export function useCanvasInteractions(viewportRef: React.RefObject<HTMLDivElement | null>) {
  const gesture = useRef<Gesture>({ kind: 'none' });
  const pointers = useRef(new Map<number, Point>());
  const lastTap = useRef<{ at: number; p: Point } | null>(null);
  const contextPoint = useRef<Point | null>(null);

  const local = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = viewportRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [viewportRef],
  );

  const setCursor = useCallback(
    (cursor: string) => {
      const el = viewportRef.current;
      if (el && el.style.cursor !== cursor) el.style.cursor = cursor;
    },
    [viewportRef],
  );

  const snapOn = (e: { ctrlKey: boolean; metaKey: boolean }) => useEditor.getState().snapping && !(e.ctrlKey || e.metaKey);

  const targetsFor = (d: DesignDocument, exclude: string[]) =>
    collectSnapTargets(d, new Set(exclude), { gridSize: useEditor.getState().showGrid ? gridSizeFor(d) : null });

  const endGesture = useCallback(() => {
    gesture.current = { kind: 'none' };
    useInteraction.getState().set({ snapLines: [], marquee: null, readout: null, gesture: 'none' });
  }, []);

  const startPinch = useCallback(() => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    // A second finger cancels whatever the first one started.
    if (gesture.current.kind !== 'pan' && gesture.current.kind !== 'none') useEditor.getState().cancel();
    const [a, b] = pts as [Point, Point];
    gesture.current = {
      kind: 'pinch',
      startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      startZoom: useCamera.getState().zoom,
      lastMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    useInteraction.getState().set({ gesture: 'pinch', snapLines: [], marquee: null, readout: null });
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = doc();
      if (!d || (e.button !== 0 && e.button !== 1)) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-canvas-ignore]')) return;
      // Commit any focused field (e.g. a properties input), then stop the browser from
      // moving focus on mousedown — it would steal focus from a text box we open here.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== viewportRef.current) active.blur();
      e.preventDefault();
      const p = local(e);
      pointers.current.set(e.pointerId, p);
      viewportRef.current?.setPointerCapture(e.pointerId);
      const kind = (e.pointerType as PointerKind) in DRAG_THRESHOLD ? (e.pointerType as PointerKind) : 'mouse';

      if (pointers.current.size >= 2) {
        startPinch();
        return;
      }

      const editor = useEditor.getState();
      const cam = useCamera.getState();
      const docPoint = screenToDoc(p);
      if (editor.editingTextId) editor.setEditingText(null);

      // Pan: middle button, held space, or the hand tool.
      if (e.button === 1 || useInteraction.getState().spaceHeld || editor.tool === 'hand') {
        gesture.current = { kind: 'pan', last: p, moved: false, start: p, touchTap: false };
        useInteraction.getState().set({ gesture: 'pan' });
        setCursor('grabbing');
        return;
      }

      // Crop mode: move/scale the photo or resize the crop window; anything else ends it.
      if (editor.croppingId) {
        const el = getElements(d, [editor.croppingId])[0];
        const meta = el?.type === 'image' ? assetMetaSync(el.assetId) : null;
        const hit =
          el?.type === 'image' && meta ? cropHitTest(el, meta.width, meta.height, p, docPoint, HANDLE_RADIUS[kind]) : null;
        if (el?.type === 'image' && meta && hit) {
          const dims = { w: meta.width, h: meta.height };
          if (hit.kind === 'frame') {
            const box = { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation };
            const hp = handlePoint(box, hit.handle);
            gesture.current = {
              kind: 'crop-frame',
              handle: hit.handle,
              start: el,
              grab: { x: docPoint.x - hp.x, y: docPoint.y - hp.y },
              ...dims,
            };
          } else if (hit.kind === 'corner') {
            const local = worldToFrame(el, docPoint);
            const startDist = Math.max(1, Math.hypot(local.x - hit.anchor.x, local.y - hit.anchor.y));
            gesture.current = { kind: 'crop-scale', start: el, anchor: hit.anchor, startDist, ...dims };
          } else {
            gesture.current = { kind: 'crop-pan', startDoc: docPoint, start: el, ...dims };
            setCursor('grabbing');
          }
          useInteraction.getState().set({ gesture: 'crop' });
          return;
        }
        commitCrop();
      }

      // Rulers: drag out a new guide.
      if (editor.showRulers && (p.x < RULER_SIZE || p.y < RULER_SIZE)) {
        const axis = p.y < RULER_SIZE ? 'y' : 'x';
        const position = axis === 'y' ? docPoint.y : docPoint.x;
        const result = addGuide(d, axis, position);
        editor.preview(() => result.doc);
        gesture.current = { kind: 'guide', id: result.id, axis, creating: true };
        useInteraction.getState().set({ gesture: 'guide' });
        return;
      }

      if (editor.tool === 'text') {
        addText(TEXT_PRESETS[0], docPoint, { edit: true, text: 'Your text' });
        return;
      }

      // Existing guides can be dragged (or dropped back on a ruler to delete).
      if (editor.showRulers) {
        const guide = (d.guides ?? []).find((g) =>
          g.axis === 'x'
            ? Math.abs((g.position - cam.x) * cam.zoom - p.x) < 5
            : Math.abs((g.position - cam.y) * cam.zoom - p.y) < 5,
        );
        if (guide) {
          gesture.current = { kind: 'guide', id: guide.id, axis: guide.axis, creating: false };
          useInteraction.getState().set({ gesture: 'guide' });
          return;
        }
      }

      // Transform handles of the current selection.
      const frame = transformFrame(d, editor.selection);
      if (frame && !frame.locked) {
        const handle = handleAt(frame, p, HANDLE_RADIUS[kind]);
        if (handle === 'rotate') {
          const center = boxCenter(frame.box);
          gesture.current = {
            kind: 'rotate',
            center,
            startAngle: angleFrom(center, docPoint),
            frame,
            start: getElements(d, frame.ids),
          };
          useInteraction.getState().set({ gesture: 'rotate' });
          return;
        }
        if (handle) {
          gesture.current = {
            kind: 'resize',
            handle,
            frame,
            grab: { x: docPoint.x - handlePoint(frame.box, handle).x, y: docPoint.y - handlePoint(frame.box, handle).y },
            targets: targetsFor(d, frame.ids),
            start: getElements(d, frame.ids),
          };
          useInteraction.getState().set({ gesture: 'resize' });
          return;
        }
      }

      const hit = hitTest(d, docPoint, cam.zoom);
      const deep = e.metaKey || e.ctrlKey;
      if (hit) {
        editor.setActiveSlide(slideIndexOf(hit, d));
        const already = editor.selection.includes(hit.id);
        let ids: string[];
        if (e.shiftKey) {
          const unit = deep ? [hit.id] : expandToGroups(d, [hit.id]);
          ids = already ? editor.selection.filter((id) => !unit.includes(id)) : [...editor.selection, ...unit];
        } else if (already) {
          ids = editor.selection;
        } else {
          ids = deep ? [hit.id] : expandToGroups(d, [hit.id]);
        }
        editor.select(ids);
        gesture.current = {
          kind: 'pending',
          start: p,
          startDoc: docPoint,
          ids,
          alt: e.altKey,
          pointer: kind,
          hitId: hit.id,
          wasSelected: already,
        };
        return;
      }

      // Dragging inside a multi-selection's frame moves it.
      if (frame && !frame.locked && pointInBox(docPoint, frame.box) && frame.ids.length > 1) {
        gesture.current = {
          kind: 'pending',
          start: p,
          startDoc: docPoint,
          ids: frame.ids,
          alt: e.altKey,
          pointer: kind,
          hitId: null,
          wasSelected: true,
        };
        return;
      }

      const strip = stripRegion(d);
      if (pointInBox(docPoint, { ...strip, rotation: 0 })) editor.setActiveSlide(Math.floor(docPoint.x / d.slideWidth));

      if (kind === 'touch') {
        gesture.current = { kind: 'pan', last: p, moved: false, start: p, touchTap: true };
        return;
      }
      const base = e.shiftKey ? editor.selection : [];
      if (!e.shiftKey) editor.clearSelection();
      gesture.current = { kind: 'marquee', startDoc: docPoint, base, active: false, start: p };
    },
    [local, setCursor, startPinch, viewportRef],
  );

  // Lets the pending→move transition re-run the move logic within the same event.
  const onPointerMoveRef = useRef<((e: React.PointerEvent<HTMLDivElement>) => void) | null>(null);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      const d = doc();
      if (!d) return;
      const p = local(e);
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
      const g = gesture.current;
      const editor = useEditor.getState();
      const cam = useCamera.getState();
      const docPoint = screenToDoc(p);
      const ui = useInteraction.getState();

      switch (g.kind) {
        case 'none': {
          if (e.pointerType !== 'mouse' || e.buttons) return;
          if (ui.spaceHeld || editor.tool === 'hand') return setCursor('grab');
          if (editor.tool === 'text') return setCursor('text');
          if (editor.croppingId) {
            const el = getElements(d, [editor.croppingId])[0];
            const meta = el?.type === 'image' ? assetMetaSync(el.assetId) : null;
            if (el?.type === 'image' && meta) {
              const hit = cropHitTest(el, meta.width, meta.height, p, docPoint, HANDLE_RADIUS.mouse);
              if (hit?.kind === 'frame') return setCursor(CURSORS[hit.handle]);
              if (hit?.kind === 'corner') return setCursor('nwse-resize');
              if (hit) return setCursor('grab');
            }
            return setCursor('default');
          }
          if (editor.showRulers && (p.x < RULER_SIZE || p.y < RULER_SIZE))
            return setCursor(p.y < RULER_SIZE ? 'row-resize' : 'col-resize');
          const frame = transformFrame(d, editor.selection);
          const handle = frame && !frame.locked ? handleAt(frame, p, HANDLE_RADIUS.mouse) : null;
          if (handle) return setCursor(handle === 'rotate' ? 'grab' : CURSORS[handle]);
          const hit = hitTest(d, docPoint, cam.zoom);
          if ((hit?.id ?? null) !== ui.hoverId) ui.set({ hoverId: hit?.id ?? null });
          setCursor(hit ? 'move' : 'default');
          return;
        }
        case 'pan': {
          const dx = p.x - g.last.x;
          const dy = p.y - g.last.y;
          if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) > DRAG_THRESHOLD.touch) g.moved = true;
          if (g.moved || !g.touchTap) useCamera.getState().panBy(dx, dy);
          g.last = p;
          return;
        }
        case 'pinch': {
          const pts = [...pointers.current.values()];
          if (pts.length < 2) return;
          const [a, b] = pts as [Point, Point];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const camera = useCamera.getState();
          camera.panBy(mid.x - g.lastMid.x, mid.y - g.lastMid.y);
          camera.zoomAt(mid, g.startZoom * (dist / g.startDist));
          g.lastMid = mid;
          return;
        }
        case 'pending': {
          if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < DRAG_THRESHOLD[g.pointer]) return;
          const els = getElements(d, g.ids);
          if (els.length === 0 || els.some((el) => el.locked)) {
            endGesture();
            return;
          }
          let baseDoc = d;
          let ids = g.ids;
          if (g.alt) {
            // Alt-drag duplicates, leaving the original in place.
            const dup = duplicateElements(d, g.ids, { x: 0, y: 0 });
            baseDoc = dup.doc;
            ids = dup.ids;
            editor.preview(() => baseDoc);
            editor.select(ids);
          }
          gesture.current = {
            kind: 'move',
            startDoc: g.startDoc,
            ids,
            startBounds: unionRects(getElements(baseDoc, ids).map(elementBounds))!,
            targets: targetsFor(baseDoc, ids),
            baseDoc,
          };
          ui.set({ gesture: 'move', hoverId: null });
          setCursor('move');
          onPointerMoveRef.current?.(e);
          return;
        }
        case 'move': {
          let dx = docPoint.x - g.startDoc.x;
          let dy = docPoint.y - g.startDoc.y;
          if (e.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) dy = 0;
            else dx = 0;
          }
          let lines = ui.snapLines;
          if (snapOn(e)) {
            const moved = { ...g.startBounds, x: g.startBounds.x + dx, y: g.startBounds.y + dy };
            const snap = snapRect(moved, g.targets, SNAP_PX / cam.zoom);
            if (!(e.shiftKey && dx === 0)) dx += snap.dx;
            if (!(e.shiftKey && dy === 0)) dy += snap.dy;
            lines = snap.lines;
          } else lines = [];
          editor.preview(() => translateElements(g.baseDoc, g.ids, dx, dy));
          ui.set({ snapLines: lines });
          return;
        }
        case 'resize': {
          const snapping = snapOn(e);
          const target = { x: docPoint.x - g.grab.x, y: docPoint.y - g.grab.y };
          const v = g.handle;
          if (snapping && g.frame.box.rotation === 0) {
            const threshold = SNAP_PX / cam.zoom;
            if (v.includes('e') || v.includes('w')) target.x = snapValue(target.x, g.targets.x, threshold);
            if (v.includes('n') || v.includes('s')) target.y = snapValue(target.y, g.targets.y, threshold);
          }
          const first = g.start[0]!;
          const isCorner = v.length === 2;
          if (g.frame.single && g.start.length === 1) {
            // Stickers and text corners always scale proportionally; Shift locks the ratio for the rest.
            const keepRatio = first.type === 'sticker' || (first.type === 'text' && isCorner) || e.shiftKey;
            const box = resizeBox(g.frame.box, v, target, { keepRatio, fromCenter: e.altKey, minSize: 8 });
            let next: DesignElement;
            if (first.type === 'text') {
              if (isCorner) {
                const s = box.width / g.frame.box.width;
                next = fitTextHeight({ ...scaleElementContent(first, s), x: box.x, y: box.y, width: box.width });
              } else {
                next = fitTextHeight({ ...first, x: box.x, y: box.y, width: box.width } as TextElement);
              }
            } else {
              next = { ...first, x: box.x, y: box.y, width: box.width, height: box.height };
            }
            editor.preview((base) => updateElements(base, [first.id], () => next));
            ui.set({ readout: { text: `${Math.round(next.width)} × ${Math.round(next.height)}`, x: p.x, y: p.y } });
          } else {
            const box = resizeBox(g.frame.box, v, target, { keepRatio: true, fromCenter: e.altKey, minSize: 8 });
            const s = box.width / g.frame.box.width;
            const byId = new Map(g.start.map((el) => [el.id, el]));
            editor.preview((base) =>
              updateElements(base, g.frame.ids, (el) => {
                const src = byId.get(el.id) ?? el;
                const c = boxCenter(src);
                const w = src.width * s;
                const h = src.height * s;
                const nx = box.x + (c.x - g.frame.box.x) * s;
                const ny = box.y + (c.y - g.frame.box.y) * s;
                return { ...scaleElementContent(src, s), x: nx - w / 2, y: ny - h / 2, width: w, height: h };
              }),
            );
            ui.set({ readout: { text: `${Math.round(box.width)} × ${Math.round(box.height)}`, x: p.x, y: p.y } });
          }
          return;
        }
        case 'rotate': {
          const angle = angleFrom(g.center, docPoint);
          const delta = angle - g.startAngle;
          if (g.frame.single && g.start.length === 1) {
            const el = g.start[0]!;
            const rotation = snapAngle(el.rotation + delta, e.shiftKey);
            editor.preview((base) => updateElements(base, [el.id], (x) => ({ ...x, rotation })));
            ui.set({ readout: { text: `${Math.round(rotation)}°`, x: p.x, y: p.y } });
          } else {
            const d2 = snapAngle(delta, e.shiftKey);
            const byId = new Map(g.start.map((el) => [el.id, el]));
            editor.preview((base) =>
              updateElements(base, g.frame.ids, (el) => {
                const src = byId.get(el.id) ?? el;
                const c = rotatePoint(boxCenter(src), g.center, d2);
                return { ...src, x: c.x - src.width / 2, y: c.y - src.height / 2, rotation: normalizeAngle(src.rotation + d2) };
              }),
            );
            ui.set({ readout: { text: `${Math.round(d2)}°`, x: p.x, y: p.y } });
          }
          return;
        }
        case 'marquee': {
          if (!g.active && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3) return;
          g.active = true;
          const rect = rectFromPoints(g.startDoc, docPoint);
          const hits = d.elements
            .filter((el) => !el.hidden && !el.locked && rectsIntersect(elementBounds(el), rect))
            .map((el) => el.id);
          const ids = expandToGroups(d, hits);
          editor.select([...new Set([...g.base, ...ids])]);
          ui.set({ marquee: rect, gesture: 'marquee' });
          return;
        }
        case 'crop-pan': {
          const a = worldToFrame(g.start, g.startDoc);
          const b = worldToFrame(g.start, docPoint);
          const next = panContent(g.start, g.w, g.h, b.x - a.x, b.y - a.y);
          editor.preview((base) => updateElements(base, [g.start.id], () => next));
          return;
        }
        case 'crop-frame': {
          const box0 = { x: g.start.x, y: g.start.y, width: g.start.width, height: g.start.height, rotation: g.start.rotation };
          const target = { x: docPoint.x - g.grab.x, y: docPoint.y - g.grab.y };
          const box = resizeBox(box0, g.handle, target, { keepRatio: e.shiftKey, fromCenter: e.altKey, minSize: 16 });
          const next = resizeFrameKeepingPhoto(g.start, box, g.w, g.h);
          editor.preview((base) => updateElements(base, [g.start.id], () => next));
          ui.set({ readout: { text: `${Math.round(box.width)} × ${Math.round(box.height)}`, x: p.x, y: p.y } });
          return;
        }
        case 'crop-scale': {
          const local = worldToFrame(g.start, docPoint);
          const dist = Math.hypot(local.x - g.anchor.x, local.y - g.anchor.y);
          const zoom = Math.max(1, g.start.zoom ?? 1) * (dist / g.startDist);
          const next = zoomContent(g.start, g.w, g.h, zoom, g.anchor);
          editor.preview((base) => updateElements(base, [g.start.id], () => next));
          ui.set({ readout: { text: `${Math.round((next.zoom ?? 1) * 100)}%`, x: p.x, y: p.y } });
          return;
        }
        case 'guide': {
          const position = g.axis === 'x' ? docPoint.x : docPoint.y;
          g.targets ??= targetsFor(d, []);
          const snapped = snapOn(e) ? snapValue(position, g.targets[g.axis], SNAP_PX / cam.zoom) : position;
          editor.preview((base) => {
            const withGuide = (base.guides ?? []).some((x) => x.id === g.id)
              ? base
              : { ...base, guides: [...(base.guides ?? []), { id: g.id, axis: g.axis, position: snapped }] };
            return moveGuide(withGuide, g.id, snapped);
          });
          return;
        }
      }
    },
    [local, setCursor, endGesture],
  );

  useEffect(() => {
    onPointerMoveRef.current = onPointerMove;
  }, [onPointerMove]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const p = local(e);
      pointers.current.delete(e.pointerId);
      if (viewportRef.current?.hasPointerCapture(e.pointerId)) viewportRef.current.releasePointerCapture(e.pointerId);
      const g = gesture.current;
      const editor = useEditor.getState();
      const d = doc();

      if (g.kind === 'pinch') {
        // Lifting one finger ends the pinch; the remaining finger does nothing until lifted.
        if (pointers.current.size === 0) endGesture();
        return;
      }

      // Double-tap / double-click detection (touch has no dblclick event).
      const now = performance.now();
      const isDouble =
        lastTap.current &&
        now - lastTap.current.at < 320 &&
        Math.hypot(p.x - lastTap.current.p.x, p.y - lastTap.current.p.y) < 24;
      lastTap.current = { at: now, p };

      switch (g.kind) {
        case 'pan':
          if (g.touchTap && !g.moved) editor.clearSelection();
          setCursor(useInteraction.getState().spaceHeld ? 'grab' : 'default');
          break;
        case 'pending':
          if (d && g.hitId) {
            const hit = getElements(d, [g.hitId])[0];
            if (isDouble && hit) {
              if (hit.type === 'text' && !hit.locked) editor.setEditingText(hit.id);
              else if (hit.type === 'image' && !hit.locked && hit.assetId) {
                if (!enterCrop(hit.id)) editor.select([hit.id]);
              } else if (hit.type === 'image' && !hit.locked) {
                editor.select([hit.id]);
                openPhotoPicker({ targetId: hit.id });
              } else editor.select([hit.id]);
              lastTap.current = null;
            } else if (g.wasSelected && !e.shiftKey && editor.selection.length > 1 && hit && !hit.groupId) {
              // Clicking one item of a multi-selection (without dragging) narrows to it.
              editor.select([hit.id]);
            }
          }
          break;
        case 'crop-pan':
        case 'crop-frame':
        case 'crop-scale':
          editor.commit();
          if (isDouble && g.kind === 'crop-pan') {
            commitCrop();
            lastTap.current = null;
          }
          setCursor('default');
          break;
        case 'move':
        case 'resize':
        case 'rotate':
          editor.commit();
          if (d && g.kind === 'move') {
            const moved = getElements(selectDoc(useEditor.getState())!, g.ids);
            if (moved.length) editor.setActiveSlide(slideIndexOf(moved[moved.length - 1]!, selectDoc(useEditor.getState())!));
          }
          break;
        case 'marquee':
          break;
        case 'guide': {
          const outOfRuler = g.axis === 'x' ? p.x < RULER_SIZE : p.y < RULER_SIZE;
          if (outOfRuler) {
            if (g.creating) editor.cancel();
            else editor.preview((base) => removeGuide(base, g.id));
          }
          editor.commit();
          break;
        }
      }
      endGesture();
    },
    [local, viewportRef, endGesture, setCursor],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
      const g = gesture.current;
      if (g.kind !== 'none' && g.kind !== 'pan' && g.kind !== 'pinch' && g.kind !== 'pending' && g.kind !== 'marquee')
        useEditor.getState().cancel();
      endGesture();
    },
    [endGesture],
  );

  /** Right-click selects what's under the pointer so the context menu acts on it. */
  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const d = doc();
      if (!d) return;
      const docPoint = screenToDoc(local(e));
      contextPoint.current = docPoint;
      const hit = hitTest(d, docPoint, useCamera.getState().zoom);
      const editor = useEditor.getState();
      if (hit && !editor.selection.includes(hit.id)) editor.select(expandToGroups(d, [hit.id]));
      if (!hit && !transformFrame(d, editor.selection)?.box) editor.clearSelection();
    },
    [local],
  );

  // Wheel / trackpad: pan by default, zoom with Ctrl/⌘ (trackpad pinches arrive as Ctrl+wheel).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = useCamera.getState();
      const rect = el.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const unit = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey || e.metaKey) {
        cam.zoomAt(p, cam.zoom * Math.exp(-clamp(e.deltaY * unit, -60, 60) * 0.006));
      } else if (e.shiftKey && e.deltaX === 0) {
        cam.panBy(-e.deltaY * unit, 0);
      } else {
        cam.panBy(-e.deltaX * unit, -e.deltaY * unit);
      }
    };
    // Safari trackpad pinch.
    let gestureZoom = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureZoom = useCamera.getState().zoom;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      const rect = el.getBoundingClientRect();
      useCamera.getState().zoomAt({ x: ge.clientX - rect.left, y: ge.clientY - rect.top }, gestureZoom * ge.scale);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [viewportRef]);

  // Hold space to pan; Escape cancels a gesture in progress.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isEditable(e.target) && !e.repeat) {
        e.preventDefault();
        useInteraction.getState().set({ spaceHeld: true });
        if (gesture.current.kind === 'none') setCursor('grab');
      }
      if (e.key === 'Escape' && gesture.current.kind !== 'none' && gesture.current.kind !== 'pan') {
        useEditor.getState().cancel();
        endGesture();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        useInteraction.getState().set({ spaceHeld: false });
        if (gesture.current.kind === 'none') setCursor('default');
      }
    };
    const blur = () => useInteraction.getState().set({ spaceHeld: false });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [setCursor, endGesture]);

  return useMemo(
    () => ({ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu, contextPoint }),
    [onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu],
  );
}
