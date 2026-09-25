'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { DesignDocument } from '@/types/document';
import { ensureDocumentFonts } from './fonts';
import { cn } from '@/utils/cn';
import { renderDocument, slideRegion, stripRegion } from './render';

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

  const region = slide === 'strip' ? stripRegion(doc) : slideRegion(doc, Math.min(slide, doc.slides.length - 1));
  const aspect = region.width / region.height;

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

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox((prev) => (prev && prev.w === rect.width && prev.h === rect.height ? prev : { w: rect.width, h: rect.height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
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
    renderDocument(ctx, doc, { region, scale: pxW / region.width });
    // `region` is derived from doc + slide, both of which are dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, slide, box, visible, fontTick, aspect, fit, maxDpr]);

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
