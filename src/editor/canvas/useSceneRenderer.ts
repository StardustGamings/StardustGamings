'use client';

import { useEffect, useRef } from 'react';
import type { DesignDocument } from '@/types/document';
import { renderCropPreview, renderDocument, stripRegion, type RenderOptions } from '@/canvas/render';
import { ensureDocumentFonts } from '@/canvas/fonts';
import { assetsVersion, subscribeAssets } from '@/assets/cache';
import { resolveImage } from '@/images/resolver';
import { useCamera } from '../camera';
import { gestureBase, selectDoc, useEditor } from '../store';
import { usePlayback } from '../playback';

/**
 * Draws the visible part of the document into a single viewport-sized canvas.
 * Redraws are coalesced to one per animation frame and only happen when the
 * document, camera or the text being edited changes.
 *
 * During a gesture (a drag, a resize, a slider) only a few elements change, so
 * everything below them and everything above them is drawn once into two cached
 * layers; each frame then draws those two bitmaps and just the changing elements.
 */

/** The run of elements a gesture has changed so far (by position), or null when caching wouldn't be safe or useful. */
function changedRun(base: DesignDocument, doc: DesignDocument): { lo: number; hi: number } | null {
  if (
    base.elements.length !== doc.elements.length ||
    base.background !== doc.background ||
    base.slides !== doc.slides ||
    base.slideWidth !== doc.slideWidth ||
    base.slideHeight !== doc.slideHeight
  )
    return null;
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < doc.elements.length; i++) {
    const a = base.elements[i]!;
    const b = doc.elements[i]!;
    if (a.id !== b.id) return null; // reordered
    if (a !== b) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  // Everything between the first and last changed element is redrawn each frame; a wide run isn't worth caching.
  if (lo < 0 || hi - lo > 24) return null;
  return { lo, hi };
}

interface Layers {
  key: string;
  base: DesignDocument;
  lo: number;
  hi: number;
  below: HTMLCanvasElement;
  above: HTMLCanvasElement;
}

function layerCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/** Frees a layer's pixels now rather than whenever it's collected. */
const release = (l: Layers | null) => {
  if (!l) return;
  l.below.width = l.below.height = 0;
  l.above.width = l.above.height = 0;
};

export function useSceneRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const frame = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let layers: Layers | null = null;
    let fontEpoch = 0;

    const draw = () => {
      frame.current = 0;
      const doc = selectDoc(useEditor.getState());
      const { editingTextId: editing, croppingId } = useEditor.getState();
      const cam = useCamera.getState();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pxW = Math.max(1, Math.round(cam.vw * dpr));
      const pxH = Math.max(1, Math.round(cam.vh * dpr));
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pxW, pxH);
      if (!doc || !cam.vw) return;

      const strip = stripRegion(doc);
      const view = { x: cam.x, y: cam.y, width: cam.vw / cam.zoom, height: cam.vh / cam.zoom };
      const x0 = Math.max(strip.x, view.x);
      const y0 = Math.max(strip.y, view.y);
      const x1 = Math.min(strip.x + strip.width, view.x + view.width);
      const y1 = Math.min(strip.y + strip.height, view.y + view.height);

      // Soft drop shadow under the artboards.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 40 * dpr;
      ctx.shadowOffsetY = 16 * dpr;
      ctx.fillStyle = '#000';
      ctx.fillRect((strip.x - cam.x) * cam.zoom, (strip.y - cam.y) * cam.zoom, strip.width * cam.zoom, strip.height * cam.zoom);
      ctx.restore();

      if (x1 <= x0 || y1 <= y0) {
        release(layers);
        layers = null;
        return;
      }
      const region = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      const playback = usePlayback.getState();
      const previewing = playback.slide;
      const paint = (target: CanvasRenderingContext2D, extra: Partial<RenderOptions> = {}) => {
        target.setTransform(dpr, 0, 0, dpr, 0, 0);
        target.translate((region.x - cam.x) * cam.zoom, (region.y - cam.y) * cam.zoom);
        renderDocument(target, doc, {
          region,
          scale: cam.zoom,
          images: resolveImage,
          skip: editing ? new Set([editing]) : undefined,
          time: previewing === null ? undefined : (slide) => (slide === previewing ? playback.time : undefined),
          ...extra,
        });
      };

      // Mid-gesture: reuse cached layers for everything the gesture hasn't touched.
      const base = gestureBase();
      const run = base && previewing === null && !croppingId ? changedRun(base, doc) : null;
      if (base && run) {
        const key = [pxW, pxH, dpr, cam.x, cam.y, cam.zoom, region.x, region.width, assetsVersion(), fontEpoch, editing].join(
          '|',
        );
        if (!layers || layers.base !== base || layers.key !== key || run.lo < layers.lo || run.hi > layers.hi) {
          release(layers);
          // Widen the redrawn run a little, so a gesture that spreads to a neighbour keeps its cache.
          const lo = run.lo;
          const hi = Math.min(doc.elements.length - 1, run.hi + 2);
          const below = layerCanvas(pxW, pxH);
          const above = layerCanvas(pxW, pxH);
          paint(below.getContext('2d')!, { include: (i) => i < lo });
          paint(above.getContext('2d')!, { include: (i) => i > hi, background: false });
          layers = { key, base, lo, hi, below, above };
        }
        const { lo, hi, below, above } = layers;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(below, 0, 0);
        paint(ctx, { include: (i) => i >= lo && i <= hi, background: false });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(above, 0, 0);
        return;
      }
      if (layers) {
        release(layers);
        layers = null;
      }

      paint(ctx);
      // Crop mode: the whole photo, ghosted, on top of everything (it may extend past the slide).
      if (croppingId) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(-cam.x * cam.zoom, -cam.y * cam.zoom);
        renderCropPreview(ctx, doc, croppingId, { scale: cam.zoom, images: resolveImage });
      }
    };

    const schedule = () => {
      if (!frame.current) frame.current = requestAnimationFrame(draw);
    };
    const fontsLoaded = (changed: boolean) => {
      if (!changed) return;
      fontEpoch++;
      schedule();
    };

    let lastDoc = selectDoc(useEditor.getState());
    let lastEditing = useEditor.getState().editingTextId;
    let lastCropping = useEditor.getState().croppingId;
    const unsubEditor = useEditor.subscribe((s) => {
      const d = selectDoc(s);
      if (d !== lastDoc || s.editingTextId !== lastEditing || s.croppingId !== lastCropping) {
        if (d && d !== lastDoc) void ensureDocumentFonts(d).then(fontsLoaded);
        lastDoc = d;
        lastEditing = s.editingTextId;
        lastCropping = s.croppingId;
        schedule();
      }
    });
    const unsubCamera = useCamera.subscribe(schedule);
    const unsubPlayback = usePlayback.subscribe(schedule);
    const unsubAssets = subscribeAssets(schedule);
    if (lastDoc) void ensureDocumentFonts(lastDoc).then(fontsLoaded);
    schedule();

    return () => {
      unsubEditor();
      unsubCamera();
      unsubPlayback();
      unsubAssets();
      release(layers);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [canvasRef]);
}
