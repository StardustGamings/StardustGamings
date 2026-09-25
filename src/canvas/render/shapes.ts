import type { ShapeElement } from '@/types/document';
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
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
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
