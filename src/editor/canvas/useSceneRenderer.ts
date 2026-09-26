'use client';

import { useEffect, useRef } from 'react';
import { renderCropPreview, renderDocument, stripRegion } from '@/canvas/render';
import { ensureDocumentFonts } from '@/canvas/fonts';
import { subscribeAssets } from '@/assets/cache';
import { resolveImage } from '@/images/resolver';
import { useCamera } from '../camera';
import { selectDoc, useEditor } from '../store';
import { usePlayback } from '../playback';

/**
 * Draws the visible part of the document into a single viewport-sized canvas.
 * Redraws are coalesced to one per animation frame and only happen when the
 * document, camera or the text being edited changes.
 */
export function useSceneRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const frame = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

      if (x1 <= x0 || y1 <= y0) return;
      const region = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      ctx.translate((region.x - cam.x) * cam.zoom, (region.y - cam.y) * cam.zoom);
      const playback = usePlayback.getState();
      const previewing = playback.slide;
      renderDocument(ctx, doc, {
        region,
        scale: cam.zoom,
        images: resolveImage,
        skip: editing ? new Set([editing]) : undefined,
        time: previewing === null ? undefined : (slide) => (slide === previewing ? playback.time : undefined),
      });
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

    let lastDoc = selectDoc(useEditor.getState());
    let lastEditing = useEditor.getState().editingTextId;
    let lastCropping = useEditor.getState().croppingId;
    const unsubEditor = useEditor.subscribe((s) => {
      const d = selectDoc(s);
      if (d !== lastDoc || s.editingTextId !== lastEditing || s.croppingId !== lastCropping) {
        if (d && d !== lastDoc) void ensureDocumentFonts(d).then((changed) => changed && schedule());
        lastDoc = d;
        lastEditing = s.editingTextId;
        lastCropping = s.croppingId;
        schedule();
      }
    });
    const unsubCamera = useCamera.subscribe(schedule);
    const unsubPlayback = usePlayback.subscribe(schedule);
    const unsubAssets = subscribeAssets(schedule);
    if (lastDoc) void ensureDocumentFonts(lastDoc).then((changed) => changed && schedule());
    schedule();

    return () => {
      unsubEditor();
      unsubCamera();
      unsubPlayback();
      unsubAssets();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [canvasRef]);
}
