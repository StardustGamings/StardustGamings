import type { ImageClip, ShapeElement } from '@/types/document';
import type { Ctx2D } from './types';

export function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  if (r === 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx: Ctx2D, w: number, h: number, points: number, inner: number): void {
  ctx.beginPath();
  const n = Math.max(3, Math.round(points));
  // A regular polygon (inner = 1) has n corners; a star alternates n outer and n inner ones.
  const polygon = inner >= 1;
  const count = polygon ? n : n * 2;
  for (let i = 0; i < count; i++) {
    const r = polygon || i % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const px = w / 2 + (Math.cos(a) * r * w) / 2;
    const py = h / 2 + (Math.sin(a) * r * h) / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Builds the path for a shape in its local box. Returns false for open (stroke-only) shapes. */
export function traceShape(ctx: Ctx2D, el: ShapeElement): boolean {
  const { width: w, height: h } = el;
  switch (el.shape) {
    case 'rect':
      roundRectPath(ctx, 0, 0, w, h, el.cornerRadius ?? 0);
      return true;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      return true;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      return true;
    case 'star':
      starPath(ctx, w, h, el.points ?? 5, el.innerRadius ?? 0.45);
      return true;
    case 'polygon':
      starPath(ctx, w, h, el.points ?? 6, 1);
      return true;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      return false;
    case 'arrow': {
      const head = Math.min(h * 1.5, w * 0.35, Math.max(12, (el.stroke?.width ?? 4) * 4));
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.moveTo(w - head, h / 2 - head * 0.6);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w - head, h / 2 + head * 0.6);
      return false;
    }
  }
}

/** Builds the clip path for an image frame in its local box. */
export function traceClip(ctx: Ctx2D, clip: ImageClip, w: number, h: number, radius: number): void {
  switch (clip) {
    case 'rect':
      roundRectPath(ctx, 0, 0, w, h, radius);
      return;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      return;
    case 'arch': {
      // A rectangle with a semicircular (or elliptical, for narrow frames) top.
      const r = Math.min(w / 2, h);
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, r);
      ctx.ellipse(w / 2, r, w / 2, r, 0, Math.PI, 0);
      ctx.lineTo(w, h);
      ctx.closePath();
      return;
    }
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.96);
      ctx.bezierCurveTo(w * 0.1, h * 0.7, -w * 0.02, h * 0.42, w * 0.06, h * 0.22);
      ctx.bezierCurveTo(w * 0.15, h * 0.02, w * 0.42, -h * 0.02, w * 0.5, h * 0.2);
      ctx.bezierCurveTo(w * 0.58, -h * 0.02, w * 0.85, h * 0.02, w * 0.94, h * 0.22);
      ctx.bezierCurveTo(w * 1.02, h * 0.42, w * 0.9, h * 0.7, w * 0.5, h * 0.96);
      ctx.closePath();
      return;
    case 'star':
      starPath(ctx, w, h, 5, 0.5);
      return;
    case 'hexagon':
      starPath(ctx, w, h, 6, 1);
      return;
  }
}
