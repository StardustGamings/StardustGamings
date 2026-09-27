'use client';

import { useEffect, useRef } from 'react';
import { unionRects } from '../core/geometry';
import { getElements } from '../core/ops';
import { elementBounds } from '@/canvas/render/renderer';
import { useCamera } from '../camera';
import { selectDoc, useEditor } from '../store';
import { RULER_SIZE } from './useCanvasInteractions';

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

/** Picks a labelled tick spacing that lands roughly every 70 screen pixels. */
function tickStep(zoom: number) {
  return STEPS.find((s) => s * zoom >= 70) ?? STEPS[STEPS.length - 1]!;
}

function readVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Top/left rulers in slide-relative units (each slide starts at 0), with the
 * selection's extent highlighted. Drag from a ruler to create a guide.
 */
export function Rulers() {
  const topRef = useRef<HTMLCanvasElement>(null);
  const leftRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      frame = 0;
      const cam = useCamera.getState();
      const editor = useEditor.getState();
      const doc = selectDoc(editor);
      if (!doc || !cam.vw) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bg = readVar('--bg-elevated', '#15151f');
      const fg = readVar('--fg-subtle', '#75738c');
      const accent = readVar('--accent', '#c6ff3d');
      const sel = unionRects(getElements(doc, editor.selection).map(elementBounds));
      const step = tickStep(cam.zoom);

      const paint = (canvas: HTMLCanvasElement | null, horizontal: boolean) => {
        if (!canvas) return;
        const length = horizontal ? cam.vw : cam.vh;
        const w = horizontal ? length : RULER_SIZE;
        const h = horizontal ? RULER_SIZE : length;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        const origin = horizontal ? cam.x : cam.y;
        const toScreen = (v: number) => (v - origin) * cam.zoom;

        if (sel) {
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.28;
          const a = toScreen(horizontal ? sel.x : sel.y);
          const b = toScreen(horizontal ? sel.x + sel.width : sel.y + sel.height);
          if (horizontal) ctx.fillRect(a, 0, b - a, h);
          else ctx.fillRect(0, a, w, b - a);
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = fg;
        ctx.fillStyle = fg;
        ctx.lineWidth = 1;
        ctx.font = '600 9px ui-monospace, monospace';
        const period = horizontal ? doc.slideWidth : Infinity;
        const start = Math.floor(origin / (step / 5)) * (step / 5);
        const end = origin + length / cam.zoom;
        ctx.beginPath();
        for (let v = start; v <= end; v += step / 5) {
          const s = Math.round(toScreen(v)) + 0.5;
          const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
          const size = major ? RULER_SIZE * 0.55 : RULER_SIZE * 0.22;
          if (horizontal) {
            ctx.moveTo(s, RULER_SIZE);
            ctx.lineTo(s, RULER_SIZE - size);
          } else {
            ctx.moveTo(RULER_SIZE, s);
            ctx.lineTo(RULER_SIZE - size, s);
          }
          if (major) {
            const value = Number.isFinite(period) ? ((v % period) + period) % period : v;
            const label = String(Math.round(value));
            if (horizontal) ctx.fillText(label, s + 3, 9);
            else {
              ctx.save();
              ctx.translate(9, s - 3);
              ctx.rotate(-Math.PI / 2);
              ctx.fillText(label, 0, 0);
              ctx.restore();
            }
          }
        }
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.globalAlpha = 0.5;
        if (horizontal) ctx.fillRect(0, h - 1, w, 1);
        else ctx.fillRect(w - 1, 0, 1, h);
        ctx.globalAlpha = 1;
      };
      paint(topRef.current, true);
      paint(leftRef.current, false);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    schedule();
    const unsubA = useCamera.subscribe(schedule);
    const unsubB = useEditor.subscribe(schedule);
    return () => {
      unsubA();
      unsubB();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <canvas ref={topRef} className="absolute top-0 left-0 z-10" aria-hidden />
      <canvas ref={leftRef} className="absolute top-0 left-0 z-10" aria-hidden />
      <div
        aria-hidden
        className="absolute top-0 left-0 z-10 border-r border-b border-line bg-bg-elevated"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      />
    </>
  );
}
