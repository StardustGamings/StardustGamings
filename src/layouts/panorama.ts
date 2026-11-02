import type { PanoramaLayout } from '@/types/document';
import { clamp } from '@/utils/math';
import { aspectOf, type LayoutResult, type PhotoRef, type Slot } from './types';

/**
 * Seamless swipe: photos laid edge to edge across a run of slides, so each
 * swipe reveals the continuation of the previous slide. One photo becomes a
 * panorama split across the slides; several flow in a row, their widths
 * following their shapes, crossing the slide edges on purpose.
 */

export type PanoramaParams = Pick<PanoramaLayout, 'slides' | 'spacing' | 'margin' | 'align'>;

export interface Size {
  width: number;
  height: number;
}

/** Heights for each photo (stagger alternates tall and short). */
function heights(n: number, slide: Size, p: PanoramaParams): number[] {
  const h = slide.height * (1 - 2 * clamp(p.margin, 0, 0.35));
  return Array.from({ length: n }, (_, i) => (p.align === 'stagger' && n > 1 && i % 2 === 1 ? h * 0.78 : h));
}

export function generatePanorama(photos: PhotoRef[], slide: Size, startX: number, p: PanoramaParams): LayoutResult {
  const n = photos.length;
  if (n === 0) return { slots: [], assign: [], layers: [] };
  const total = slide.width * Math.max(1, p.slides);
  const gap = n === 1 ? slide.width * clamp(p.spacing, 0, 0.3) : slide.width * clamp(p.spacing, 0, 0.3);
  const hs = heights(n, slide, p);
  const natural = photos.map((ph, i) => aspectOf(ph) * hs[i]!);
  const available = total - gap * (n + 1);
  const k = available / natural.reduce((a, b) => a + b, 0);
  const margin = slide.height * clamp(p.margin, 0, 0.35);
  const slots: Slot[] = [];
  let x = startX + gap;
  photos.forEach((_, i) => {
    const w = natural[i]! * k;
    const h = hs[i]!;
    let y: number;
    if (p.align === 'top') y = margin * 0.35;
    else if (p.align === 'bottom') y = slide.height - h - margin * 0.35;
    else if (p.align === 'stagger' && n > 1) y = i % 2 === 0 ? margin * 0.6 : slide.height - h - margin * 0.6;
    else y = (slide.height - h) / 2;
    slots.push({ x, y, width: w, height: h, rotation: 0 });
    x += w + gap;
  });
  return { slots, assign: photos.map((_, i) => i), layers: slots.map((_, i) => ({ slot: i })) };
}

/** How many slides these photos want so they aren't cropped much (2 … 10). */
export function suggestedSlides(photos: PhotoRef[], slide: Size, p: Omit<PanoramaParams, 'slides'>): number {
  if (photos.length === 0) return 3;
  const hs = heights(photos.length, slide, { ...p, slides: 1 });
  const width = photos.reduce((sum, ph, i) => sum + aspectOf(ph) * hs[i]!, 0);
  const gaps = slide.width * clamp(p.spacing, 0, 0.3) * (photos.length + 1);
  return clamp(Math.round((width + gaps) / slide.width), 2, 10);
}

/** How much each photo is stretched (1 = its natural shape); far from 1 means heavy cropping. */
export function panoramaFit(result: LayoutResult, photos: PhotoRef[]): number {
  const ratios = result.slots.map((s, i) => s.width / s.height / aspectOf(photos[i]!));
  return Math.max(...ratios.map((r) => Math.max(r, 1 / r)));
}
