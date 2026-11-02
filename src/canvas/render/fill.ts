import type { Fill, GradientStop } from '@/types/document';
import { clamp, degToRad } from '@/utils/math';
import type { Ctx2D } from './types';

function addStops(gradient: CanvasGradient, stops: GradientStop[]): void {
  for (const stop of stops) {
    try {
      gradient.addColorStop(clamp(stop.offset, 0, 1), stop.color);
    } catch {
      /* Invalid colour strings are ignored rather than breaking the whole render. */
    }
  }
}

/** Canvas paint for a fill applied to the box (x, y, w, h). */
export function createFillStyle(ctx: Ctx2D, fill: Fill, x: number, y: number, w: number, h: number): string | CanvasGradient {
  switch (fill.type) {
    case 'solid':
      return fill.color;
    case 'linear': {
      // CSS semantics: 0deg points up, 90deg points right; the gradient line is
      // long enough that the corners hit the first/last stop.
      const rad = degToRad(fill.angle);
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
      addStops(g, fill.stops);
      return g;
    }
    case 'radial': {
      const cx = x + fill.cx * w;
      const cy = y + fill.cy * h;
      const r = Math.max(1, fill.radius * Math.max(w, h));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      addStops(g, fill.stops);
      return g;
    }
  }
}

const cssStops = (stops: GradientStop[]) =>
  stops.map((s) => `${s.color} ${Math.round(clamp(s.offset, 0, 1) * 1000) / 10}%`).join(', ');

/** Equivalent CSS `background` value — used for swatches and DOM previews. */
export function fillToCss(fill: Fill): string {
  switch (fill.type) {
    case 'solid':
      return fill.color;
    case 'linear':
      return `linear-gradient(${fill.angle}deg, ${cssStops(fill.stops)})`;
    case 'radial':
      return `radial-gradient(circle at ${fill.cx * 100}% ${fill.cy * 100}%, ${cssStops(fill.stops)})`;
  }
}

/** Representative flat colour (first stop for gradients). */
export function fillPrimaryColor(fill: Fill): string {
  return fill.type === 'solid' ? fill.color : (fill.stops[0]?.color ?? '#000000');
}
