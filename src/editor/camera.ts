'use client';

import { create } from 'zustand';
import type { Rect } from '@/canvas/render/types';
import type { Point } from './core/geometry';
import { clamp } from '@/utils/math';

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 8;

interface CameraState {
  /** Document point shown at the viewport's top-left corner. */
  x: number;
  y: number;
  zoom: number;
  /** Viewport size in CSS pixels. */
  vw: number;
  vh: number;
  /** Bounds of the content (the slide strip) used to keep it reachable. */
  content: Rect | null;
  ready: boolean;
  setViewport: (vw: number, vh: number) => void;
  setContent: (rect: Rect) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screen: Point, zoom: number) => void;
  fitTo: (rect: Rect, padding?: number, maxZoom?: number) => void;
  /** Forget the framing (e.g. when a different project opens) so it refits. */
  reset: () => void;
}

/** Keeps at least a sliver of the content on screen so users can't get lost. */
function clampPosition(s: Pick<CameraState, 'x' | 'y' | 'zoom' | 'vw' | 'vh' | 'content'>, x: number, y: number) {
  if (!s.content) return { x, y };
  const margin = 80 / s.zoom;
  const viewW = s.vw / s.zoom;
  const viewH = s.vh / s.zoom;
  const c = s.content;
  return {
    x: clamp(x, c.x - viewW + margin, c.x + c.width - margin),
    y: clamp(y, c.y - viewH + margin, c.y + c.height - margin),
  };
}

export const useCamera = create<CameraState>()((set, get) => ({
  x: 0,
  y: 0,
  zoom: 0.25,
  vw: 0,
  vh: 0,
  content: null,
  ready: false,
  setViewport: (vw, vh) => {
    const s = get();
    if (s.vw === vw && s.vh === vh) return;
    // Keep the centre of the view stable while the viewport resizes (panels opening, rotation).
    const cx = s.x + s.vw / 2 / s.zoom;
    const cy = s.y + s.vh / 2 / s.zoom;
    set({ vw, vh, x: s.vw ? cx - vw / 2 / s.zoom : s.x, y: s.vh ? cy - vh / 2 / s.zoom : s.y });
  },
  setContent: (content) => set({ content }),
  panBy: (dx, dy) => {
    const s = get();
    set(clampPosition(s, s.x - dx / s.zoom, s.y - dy / s.zoom));
  },
  zoomAt: (screen, zoom) => {
    const s = get();
    const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    // Keep the document point under the cursor fixed.
    const docX = s.x + screen.x / s.zoom;
    const docY = s.y + screen.y / s.zoom;
    const next = { ...s, zoom: z };
    set({ zoom: z, ...clampPosition(next, docX - screen.x / z, docY - screen.y / z) });
  },
  fitTo: (rect, padding = 56, maxZoom = 1) => {
    const s = get();
    if (!s.vw || !s.vh) return;
    const z = clamp(Math.min((s.vw - padding * 2) / rect.width, (s.vh - padding * 2) / rect.height, maxZoom), ZOOM_MIN, ZOOM_MAX);
    set({
      zoom: z,
      x: rect.x + rect.width / 2 - s.vw / 2 / z,
      y: rect.y + rect.height / 2 - s.vh / 2 / z,
      ready: true,
    });
  },
  reset: () => set({ ready: false, content: null }),
}));

export const screenToDoc = (p: Point, cam = useCamera.getState()): Point => ({
  x: cam.x + p.x / cam.zoom,
  y: cam.y + p.y / cam.zoom,
});
export const docToScreen = (p: Point, cam = useCamera.getState()): Point => ({
  x: (p.x - cam.x) * cam.zoom,
  y: (p.y - cam.y) * cam.zoom,
});
