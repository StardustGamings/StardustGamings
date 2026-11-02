import type { DesignDocument } from '@/types/document';
import type { Rect } from '@/canvas/render/types';
import { elementBounds } from '@/canvas/render/renderer';

/** A value to snap to on one axis, with the span it occupies on the other axis. */
export interface SnapTarget {
  value: number;
  start: number;
  end: number;
}

export interface SnapTargets {
  x: SnapTarget[];
  y: SnapTarget[];
}

/** A guide line to draw: on `axis` at `position`, spanning `from`..`to` on the other axis. */
export interface SnapLine {
  axis: 'x' | 'y';
  position: number;
  from: number;
  to: number;
}

export interface SnapOptions {
  elements?: boolean;
  gridSize?: number | null;
}

export const GRID_COLUMNS = 12;

export function collectSnapTargets(doc: DesignDocument, exclude: Set<string>, opts: SnapOptions = {}): SnapTargets {
  const W = doc.slideWidth;
  const H = doc.slideHeight;
  const x: SnapTarget[] = [];
  const y: SnapTarget[] = [];
  doc.slides.forEach((_, i) => {
    for (const v of [i * W, i * W + W / 2, (i + 1) * W]) x.push({ value: v, start: 0, end: H });
  });
  const stripW = W * doc.slides.length;
  for (const v of [0, H / 2, H]) y.push({ value: v, start: 0, end: stripW });

  for (const g of doc.guides ?? []) {
    if (g.axis === 'x') x.push({ value: g.position, start: 0, end: H });
    else y.push({ value: g.position, start: 0, end: stripW });
  }

  if (opts.elements !== false) {
    for (const el of doc.elements) {
      if (exclude.has(el.id) || el.hidden) continue;
      const b = elementBounds(el);
      for (const v of [b.x, b.x + b.width / 2, b.x + b.width]) x.push({ value: v, start: b.y, end: b.y + b.height });
      for (const v of [b.y, b.y + b.height / 2, b.y + b.height]) y.push({ value: v, start: b.x, end: b.x + b.width });
    }
  }

  if (opts.gridSize && opts.gridSize > 0) {
    const g = opts.gridSize;
    for (let v = 0; v <= stripW + 0.5; v += g) x.push({ value: v, start: 0, end: H });
    for (let v = 0; v <= H + 0.5; v += g) y.push({ value: v, start: 0, end: stripW });
  }
  return { x, y };
}

function bestOffset(candidates: number[], targets: SnapTarget[], threshold: number): number | null {
  let best: number | null = null;
  for (const t of targets) {
    for (const c of candidates) {
      const d = t.value - c;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best;
}

function linesFor(axis: 'x' | 'y', candidates: number[], targets: SnapTarget[], span: [number, number]): SnapLine[] {
  const lines: SnapLine[] = [];
  const seen = new Set<number>();
  for (const t of targets) {
    if (seen.has(t.value)) continue;
    if (candidates.some((c) => Math.abs(c - t.value) < 0.5)) {
      seen.add(t.value);
      lines.push({ axis, position: t.value, from: Math.min(span[0], t.start), to: Math.max(span[1], t.end) });
    }
  }
  return lines;
}

/** Snaps a moving rectangle's edges/centre to the targets. Threshold is in document units. */
export function snapRect(rect: Rect, targets: SnapTargets, threshold: number): { dx: number; dy: number; lines: SnapLine[] } {
  const xs = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
  const ys = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
  const dx = bestOffset(xs, targets.x, threshold) ?? 0;
  const dy = bestOffset(ys, targets.y, threshold) ?? 0;
  const moved = { x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height };
  const lines = [
    ...linesFor('x', [moved.x, moved.x + moved.width / 2, moved.x + moved.width], targets.x, [moved.y, moved.y + moved.height]),
    ...linesFor('y', [moved.y, moved.y + moved.height / 2, moved.y + moved.height], targets.y, [moved.x, moved.x + moved.width]),
  ];
  return { dx, dy, lines };
}

/** Snaps a single coordinate (e.g. a dragged edge). */
export function snapValue(value: number, targets: SnapTarget[], threshold: number): number {
  const d = bestOffset([value], targets, threshold);
  return d === null ? value : value + d;
}

export const gridSizeFor = (doc: DesignDocument) => doc.slideWidth / GRID_COLUMNS;
