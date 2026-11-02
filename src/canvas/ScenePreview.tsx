'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { DesignDocument, DesignElement } from '@/types/document';
import { ensureDocumentFonts } from './fonts';
import { scheduleDraw } from './draw-queue';
import { cn } from '@/utils/cn';
import { renderDocument, slideRegion, stripRegion } from './render';
import { assetsVersion, subscribeAssets } from '@/assets/cache';
import { resolveImage } from '@/images/resolver';

const serverVersion = () => 0;

type Region = { x: number; y: number; width: number; height: number };

/** Could this element draw into the region? (Generous: rotation, strokes and shadows reach past the box.) */
function touches(el: DesignElement, r: Region): boolean {
  const reach = Math.hypot(el.width, el.height) / 2 + 60;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return cx + reach > r.x && cx - reach < r.x + r.width && cy + reach > r.y && cy - reach < r.y + r.height;
}

const sameElements = (a: DesignElement[], b: DesignElement[]) => a.length === b.length && a.every((e, i) => e === b[i]);

interface ScenePreviewProps {
  doc: DesignDocument;
  /** Slide index, or `'strip'` to show the whole carousel strip. */
  slide?: number | 'strip';
  /**
   * `width` (default): fills the parent's width and sizes its own height from the aspect ratio.
   * `contain`: fits inside the parent box (the parent must have a definite size).
   */
  fit?: 'width' | 'contain';
  className?: string;
  style?: CSSProperties;
  /** Accessible description; previews are decorative when omitted. */
  label?: string;
  /** Render immediately instead of waiting until scrolled into view. */
  eager?: boolean;
  /** Cap on device-pixel ratio to bound memory for large grids. */
  maxDpr?: number;
}

/**
 * Renders a design with the same Canvas2D engine used for export, so what users
 * see in thumbnails and previews is exactly what they'll get.
 */
export function ScenePreview({
  doc,
  slide = 0,
  fit = 'width',
  className,
  style,
  label,
  eager = false,
  maxDpr = 2,
}: ScenePreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(() => eager || typeof IntersectionObserver === 'undefined');
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [fontTick, setFontTick] = useState(0);
  const assetTick = useSyncExternalStore(subscribeAssets, assetsVersion, serverVersion);

  const slideIndex = slide === 'strip' ? -1 : Math.min(slide, doc.slides.length - 1);
  const region = slide === 'strip' ? stripRegion(doc) : slideRegion(doc, slideIndex);
  const aspect = region.width / region.height;
  // What this preview shows. Designs are immutable, so when none of these change (an edit on
  // another slide, a selection change) the preview keeps its pixels instead of redrawing.
  const inRegion = doc.elements.filter((el) => touches(el, region));
  const [content, setContent] = useState(inRegion);
  if (!sameElements(content, inRegion)) setContent(inRegion);
  const slideFill = slideIndex >= 0 ? doc.slides[slideIndex]?.fill : null;
  const stripKey = `${doc.slides.length}|${doc.slideWidth}|${doc.slideHeight}`;

  useEffect(() => {
    if (visible || !boxRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // Layout size (not getBoundingClientRect): it ignores transforms such as a dialog's
    // zoom-in animation, which ResizeObserver wouldn't report once it settles.
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    if (typeof ResizeObserver === 'undefined') {
      measure();
      return;
    }
    // The first observation arrives after the browser's own layout, so mounting a page of
    // previews doesn't force a layout of the whole page from script.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void ensureDocumentFonts(doc).then((changed) => {
      if (!cancelled && changed) setFontTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, visible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas || !box || box.w === 0) return;
    // Drawn in a short slice (see draw-queue), so a grid of previews never blocks input.
    return scheduleDraw(canvas, () => {
      let cssW = box.w;
      let cssH = box.w / aspect;
      if (fit === 'contain' && box.h > 0) {
        cssW = Math.min(box.w, box.h * aspect);
        cssH = cssW / aspect;
      }
      const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, maxDpr);
      const pxW = Math.max(1, Math.round(cssW * dpr));
      const pxH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== pxW) canvas.width = pxW;
      if (canvas.height !== pxH) canvas.height = pxH;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pxW, pxH);
      renderDocument(ctx, doc, { region, scale: pxW / region.width, images: resolveImage });
    });
    // `doc` and `region` are read when drawing; what they contribute to this preview is
    // captured by `content`, `slideFill`, `doc.background` and `stripKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, slideFill, doc.background, stripKey, slide, box, visible, fontTick, assetTick, aspect, fit, maxDpr]);

  return (
    <div
      ref={boxRef}
      className={cn('relative flex items-center justify-center', className)}
      style={fit === 'width' ? { aspectRatio: `${aspect}`, ...style } : style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <canvas ref={canvasRef} className="block max-h-full max-w-full" />
    </div>
  );
}
