import type { ImageElement } from '@/types/document';
import { clamp, degToRad } from '@/utils/math';

/**
 * How a photo sits inside its frame. Everything is expressed relative to the
 * frame so resizing the frame behaves like CSS `object-fit` + `object-position`,
 * while crop mode can still move/scale the photo freely.
 *
 * Coordinates: "frame space" is the element's local box (0..w, 0..h, before the
 * element's own rotation). "Photo axes" are frame axes rotated by `straighten`.
 */

export type ContentProps = Pick<
  ImageElement,
  'width' | 'height' | 'fit' | 'focusX' | 'focusY' | 'zoom' | 'straighten' | 'turns' | 'flipX' | 'flipY'
>;

export interface ContentLayout {
  /** Scale from source pixels to element units. */
  scale: number;
  /** Photo size after quarter turns, in element units. */
  width: number;
  height: number;
  /** Frame's bounding box measured along the photo axes. */
  coverWidth: number;
  coverHeight: number;
  /** Offset of the photo centre from the frame centre, along the photo axes. */
  offsetX: number;
  offsetY: number;
  /** Straighten angle in radians. */
  angle: number;
}

/** Source size after the element's quarter turns. */
export function orientedSize(width: number, height: number, turns = 0): { width: number; height: number } {
  return turns % 2 === 1 ? { width: height, height: width } : { width, height };
}

/** Base (zoom = 1) scale for a frame. */
export function baseScale(p: ContentProps, srcW: number, srcH: number): number {
  const { width: W, height: H } = orientedSize(srcW, srcH, p.turns);
  const a = degToRad(p.straighten ?? 0);
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  if (p.fit === 'contain') return Math.min(p.width / (W * c + H * s), p.height / (W * s + H * c));
  return Math.max((p.width * c + p.height * s) / W, (p.width * s + p.height * c) / H);
}

export function contentLayout(p: ContentProps, srcW: number, srcH: number): ContentLayout {
  const { width: W, height: H } = orientedSize(srcW, srcH, p.turns);
  const angle = degToRad(p.straighten ?? 0);
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const coverWidth = p.width * c + p.height * s;
  const coverHeight = p.width * s + p.height * c;
  const scale = baseScale(p, srcW, srcH) * Math.max(1, p.zoom ?? 1);
  const width = W * scale;
  const height = H * scale;
  const fx = clamp(p.focusX ?? 0.5, 0, 1);
  const fy = clamp(p.focusY ?? 0.5, 0, 1);
  return {
    scale,
    width,
    height,
    coverWidth,
    coverHeight,
    offsetX: (coverWidth - width) * (fx - 0.5),
    offsetY: (coverHeight - height) * (fy - 0.5),
    angle,
  };
}

/** Inverse of the offset formula: the focus that produces `offset` (0.5 when there's no slack). */
function focusFor(offset: number, cover: number, size: number): number {
  const slack = cover - size;
  if (Math.abs(slack) < 1e-6) return 0.5;
  return clamp(0.5 + offset / slack, 0, 1);
}

const rotate = (x: number, y: number, rad: number) => ({
  x: x * Math.cos(rad) - y * Math.sin(rad),
  y: x * Math.sin(rad) + y * Math.cos(rad),
});

/** Photo corners in frame space (TL, TR, BR, BL of the oriented photo). */
export function photoCornersInFrame(p: ContentProps, srcW: number, srcH: number): { x: number; y: number }[] {
  const l = contentLayout(p, srcW, srcH);
  const cx = p.width / 2;
  const cy = p.height / 2;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const r = rotate(l.offsetX + (sx! * l.width) / 2, l.offsetY + (sy! * l.height) / 2, l.angle);
    return { x: cx + r.x, y: cy + r.y };
  });
}

/** Moves the photo by (dx, dy) in frame space; clamps so the frame stays covered. */
export function panContent<T extends ContentProps>(p: T, srcW: number, srcH: number, dx: number, dy: number): T {
  const l = contentLayout(p, srcW, srcH);
  const d = rotate(dx, dy, -l.angle);
  return {
    ...p,
    focusX: focusFor(l.offsetX + d.x, l.coverWidth, l.width),
    focusY: focusFor(l.offsetY + d.y, l.coverHeight, l.height),
  };
}

/**
 * Sets the zoom, keeping the photo point under `anchor` (frame space, defaults
 * to the frame centre) in place as far as the frame-coverage rule allows.
 */
export function zoomContent<T extends ContentProps>(
  p: T,
  srcW: number,
  srcH: number,
  zoom: number,
  anchor?: { x: number; y: number },
): T {
  const z0 = Math.max(1, p.zoom ?? 1);
  const z1 = clamp(zoom, 1, 20);
  const l0 = contentLayout(p, srcW, srcH);
  const next = { ...p, zoom: z1 };
  const l1 = contentLayout(next, srcW, srcH);
  const a = anchor ?? { x: p.width / 2, y: p.height / 2 };
  // Anchor relative to frame centre, in photo axes.
  const ar = rotate(a.x - p.width / 2, a.y - p.height / 2, -l0.angle);
  const k = z1 / z0;
  const ox = ar.x - (ar.x - l0.offsetX) * k;
  const oy = ar.y - (ar.y - l0.offsetY) * k;
  return { ...next, focusX: focusFor(ox, l1.coverWidth, l1.width), focusY: focusFor(oy, l1.coverHeight, l1.height) };
}

type Frame = Pick<ImageElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>;

/**
 * Crop-window resize: the frame changes to `box` while the photo stays put on
 * the canvas (same size and position), within the coverage rule.
 */
export function resizeFrameKeepingPhoto<T extends ContentProps & Frame>(p: T, box: Frame, srcW: number, srcH: number): T {
  const l0 = contentLayout(p, srcW, srcH);
  const rot = degToRad(p.rotation);
  const centre0 = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
  const centre1 = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // Photo centre in world space.
  const off = rotate(l0.offsetX, l0.offsetY, l0.angle);
  const offWorld = rotate(off.x, off.y, rot);
  const photo = { x: centre0.x + offWorld.x, y: centre0.y + offWorld.y };

  const resized = { ...p, x: box.x, y: box.y, width: box.width, height: box.height };
  const base1 = baseScale(resized, srcW, srcH);
  const zoom = clamp(l0.scale / base1, 1, 20);
  const withZoom = { ...resized, zoom };
  const l1 = contentLayout(withZoom, srcW, srcH);
  const rel = rotate(photo.x - centre1.x, photo.y - centre1.y, -rot);
  const inPhoto = rotate(rel.x, rel.y, -l1.angle);
  return {
    ...withZoom,
    focusX: focusFor(inPhoto.x, l1.coverWidth, l1.width),
    focusY: focusFor(inPhoto.y, l1.coverHeight, l1.height),
  };
}

/** Frame size for an aspect ratio, keeping the frame's area and centre. */
export function frameForAspect(frame: Frame, ratio: number): Frame {
  const area = frame.width * frame.height;
  const width = Math.sqrt(area * ratio);
  const height = width / ratio;
  return {
    ...frame,
    x: frame.x + frame.width / 2 - width / 2,
    y: frame.y + frame.height / 2 - height / 2,
    width,
    height,
  };
}

/** Frame-space point → document space for an element box. */
export function frameToWorld(el: Frame, p: { x: number; y: number }): { x: number; y: number } {
  const r = rotate(p.x - el.width / 2, p.y - el.height / 2, degToRad(el.rotation));
  return { x: el.x + el.width / 2 + r.x, y: el.y + el.height / 2 + r.y };
}

/** Document-space point → frame space for an element box. */
export function worldToFrame(el: Frame, p: { x: number; y: number }): { x: number; y: number } {
  const r = rotate(p.x - el.x - el.width / 2, p.y - el.y - el.height / 2, -degToRad(el.rotation));
  return { x: r.x + el.width / 2, y: r.y + el.height / 2 };
}

/** Whole-photo corners in document space (crop-mode chrome). */
export function photoQuad(el: ContentProps & Frame, srcW: number, srcH: number): { x: number; y: number }[] {
  return photoCornersInFrame(el, srcW, srcH).map((p) => frameToWorld(el, p));
}

/** Point-in-convex-quad test (corners in order). */
export function pointInQuad(p: { x: number; y: number }, quad: { x: number; y: number }[]): boolean {
  let sign = 0;
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % quad.length]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross !== 0) {
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
  }
  return true;
}
