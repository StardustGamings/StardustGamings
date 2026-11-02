import type { DesignDocument } from '@/types/document';
import { renderDocument, slideRegion } from '@/canvas/render/renderer';
import type { Ctx2D, ImageResolver } from '@/canvas/render/types';
import { easeInOutCubic } from './engine';
import { frameAt, type FrameSlide, type Sequence } from './sequence';

/**
 * Draws one frame of a design playing as a video: the slide(s) on screen at
 * time `g`, each at its own point in time, composed with the transition. The
 * canvas is one slide at `scale` (device pixels per design unit). The same
 * function drives the in-app preview and MP4 / GIF export.
 */
export function drawFrame(
  ctx: Ctx2D,
  doc: DesignDocument,
  seq: Sequence,
  g: number,
  opts: { scale: number; images?: ImageResolver; placeholders?: boolean },
): FrameSlide[] {
  const frames = frameAt(seq, g);
  const w = doc.slideWidth * opts.scale;
  const h = doc.slideHeight * opts.scale;
  const order = new Map(seq.slides.map((s, i) => [s, i]));
  const times = new Map(frames.map((f) => [f.slide, f.t]));
  const current = order.get(frames[frames.length - 1]?.slide ?? 0) ?? 0;
  // Slides already played are over; later ones haven't started (their animated elements are hidden).
  const time = (slide: number) => times.get(slide) ?? ((order.get(slide) ?? Infinity) < current ? Infinity : -Infinity);

  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  for (const f of frames) {
    const q = easeInOutCubic(f.progress);
    ctx.save();
    if (f.role !== 'only') {
      switch (seq.motion.transition) {
        case 'swipe':
          ctx.translate(f.role === 'out' ? -q * w : (1 - q) * w, 0);
          break;
        case 'fade':
          if (f.role === 'in') ctx.globalAlpha = q;
          break;
        case 'zoom': {
          const s = f.role === 'out' ? 1 + 0.14 * q : 0.9 + 0.1 * q;
          ctx.globalAlpha = f.role === 'out' ? 1 - q : q;
          ctx.translate(w / 2, h / 2);
          ctx.scale(s, s);
          ctx.translate(-w / 2, -h / 2);
          break;
        }
        case 'cut':
          break;
      }
    }
    renderDocument(ctx, doc, {
      region: slideRegion(doc, f.slide),
      scale: opts.scale,
      images: opts.images,
      placeholders: opts.placeholders,
      time,
    });
    ctx.restore();
  }
  ctx.restore();
  return frames;
}
