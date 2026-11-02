import type { DesignElement } from '@/types/document';
import type { Rect } from '@/canvas/render/types';
import { elementBounds } from '@/canvas/render/renderer';
import { degToRad } from '@/utils/math';

export interface Point {
  x: number;
  y: number;
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Direction of each resize handle in the element's local frame. */
export const HANDLE_VECTORS: Record<Handle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
};

export const CORNER_HANDLES: Handle[] = ['nw', 'ne', 'se', 'sw'];
export const ALL_HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export function rotatePoint(p: Point, center: Point, deg: number): Point {
  if (!deg) return { ...p };
  const r = degToRad(deg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export const boxCenter = (b: Pick<Box, 'x' | 'y' | 'width' | 'height'>): Point => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

/** Corners (tl, tr, br, bl) of a rotated box in document space. */
export function boxCorners(b: Box): [Point, Point, Point, Point] {
  const c = boxCenter(b);
  const pts: Point[] = [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ];
  return pts.map((p) => rotatePoint(p, c, b.rotation)) as [Point, Point, Point, Point];
}

/** Axis-aligned bounds of a rotated box. */
export function boxBounds(b: Box): { x: number; y: number; width: number; height: number } {
  const pts = boxCorners(b);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Position of a handle on a rotated box in document space. */
export function handlePoint(b: Box, handle: Handle): Point {
  const v = HANDLE_VECTORS[handle];
  const c = boxCenter(b);
  return rotatePoint({ x: c.x + (v.x * b.width) / 2, y: c.y + (v.y * b.height) / 2 }, c, b.rotation);
}

/** Point-in-rotated-box test with an optional tolerance (in document units). */
export function pointInBox(p: Point, b: Box, tolerance = 0): boolean {
  const c = boxCenter(b);
  const local = rotatePoint(p, c, -b.rotation);
  return (
    local.x >= b.x - tolerance &&
    local.x <= b.x + b.width + tolerance &&
    local.y >= b.y - tolerance &&
    local.y <= b.y + b.height + tolerance
  );
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const selectionBounds = (elements: DesignElement[]): Rect | null => unionRects(elements.map(elementBounds));

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export interface ResizeOptions {
  keepRatio?: boolean;
  fromCenter?: boolean;
  minSize?: number;
}

/**
 * Resizes a (possibly rotated) box by dragging one handle to `pointer` (document
 * space). The opposite handle stays fixed unless `fromCenter` is set.
 */
export function resizeBox(start: Box, handle: Handle, pointer: Point, opts: ResizeOptions = {}): Box {
  const min = opts.minSize ?? 4;
  const v = HANDLE_VECTORS[handle];
  const c = boxCenter(start);
  const local = rotatePoint(pointer, c, -start.rotation);
  const px = local.x - c.x;
  const py = local.y - c.y;
  const anchorX = opts.fromCenter ? 0 : (-v.x * start.width) / 2;
  const anchorY = opts.fromCenter ? 0 : (-v.y * start.height) / 2;

  let w = start.width;
  let h = start.height;
  if (v.x !== 0) w = opts.fromCenter ? 2 * Math.abs(px) : (px - anchorX) * v.x;
  if (v.y !== 0) h = opts.fromCenter ? 2 * Math.abs(py) : (py - anchorY) * v.y;
  w = Math.max(min, w);
  h = Math.max(min, h);

  if (opts.keepRatio && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    if (v.x !== 0 && v.y !== 0) {
      const s = Math.max(w / start.width, h / start.height);
      w = Math.max(min, start.width * s);
      h = Math.max(min, start.height * s);
    } else if (v.x !== 0) h = w / ratio;
    else w = h * ratio;
  }

  const cx = opts.fromCenter || v.x === 0 ? 0 : anchorX + (v.x * w) / 2;
  const cy = opts.fromCenter || v.y === 0 ? 0 : anchorY + (v.y * h) / 2;
  const center = rotatePoint({ x: c.x + cx, y: c.y + cy }, c, start.rotation);
  return { x: center.x - w / 2, y: center.y - h / 2, width: w, height: h, rotation: start.rotation };
}

/** Angle (degrees, 0 = up, clockwise) from `center` towards `p`. */
export function angleFrom(center: Point, p: Point): number {
  return (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI + 90;
}

export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.round(a * 100) / 100;
}

/** Snaps to `step` increments when `force`, otherwise gently to right angles. */
export function snapAngle(deg: number, force: boolean, step = 15): number {
  if (force) return normalizeAngle(Math.round(deg / step) * step);
  const nearest = Math.round(deg / 90) * 90;
  return normalizeAngle(Math.abs(deg - nearest) < 3 ? nearest : deg);
}
