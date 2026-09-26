'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { DesignDocument } from '@/types/document';
import { ScenePreview } from '@/canvas/ScenePreview';
import { useResolvedMotion } from '@/hooks/usePreferences';
import { cn } from '@/utils/cn';

/**
 * Live swipe preview: the carousel as someone scrolling their feed would see
 * it — one slide at a time, swiping with touch, mouse drag, arrow keys or the
 * dots. Slides sit edge to edge, so seamless panoramas show their continuity
 * mid-swipe. (Stardeck's own phone frame — not any app's interface.)
 */
export function CarouselPreview({
  doc,
  className,
  style,
  handle = 'you',
}: {
  doc: DesignDocument;
  className?: string;
  style?: CSSProperties;
  handle?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const drag = useRef<{ x: number; left: number; t: number; pointerId: number } | null>(null);
  const motion = useResolvedMotion();
  const n = doc.slides.length;
  const current = Math.min(index, n - 1);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      const target = Math.max(0, Math.min(n - 1, i));
      track.scrollTo({ left: target * track.clientWidth, behavior: motion === 'full' ? 'smooth' : 'auto' });
      setIndex(target);
    },
    [n, motion],
  );

  // Keep the position valid when the design shrinks.
  useEffect(() => {
    if (index > n - 1) goTo(n - 1);
  }, [n, index, goTo]);

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3 rounded-[28px] border border-line bg-bg-elevated p-3 shadow-[var(--shadow-lift)]',
        className,
      )}
      style={style}
      data-testid="carousel-preview"
    >
      <div className="flex items-center gap-2 px-1">
        <span aria-hidden className="size-7 rounded-full bg-nova" />
        <span className="text-[13px] font-bold">{handle}</span>
        <span
          className="ml-auto rounded-full bg-surface-active px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
          aria-live="polite"
        >
          {current + 1} / {n}
        </span>
      </div>
      <div
        className="group relative overflow-hidden rounded-[14px] bg-bg-sunken"
        style={{ aspectRatio: `${doc.slideWidth} / ${doc.slideHeight}` }}
      >
        <div
          ref={trackRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Swipe preview"
          className="hide-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onScroll={(e) => {
            const t = e.currentTarget;
            if (!drag.current) setIndex(Math.round(t.scrollLeft / Math.max(1, t.clientWidth)));
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              e.stopPropagation();
              goTo(current + 1);
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              goTo(current - 1);
            }
          }}
          // Mouse drag to swipe (touch uses native scrolling with snap points).
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            const t = e.currentTarget;
            t.setPointerCapture(e.pointerId);
            t.style.scrollSnapType = 'none';
            drag.current = { x: e.clientX, left: t.scrollLeft, t: performance.now(), pointerId: e.pointerId };
          }}
          onPointerMove={(e) => {
            if (!drag.current || drag.current.pointerId !== e.pointerId) return;
            e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (!d) return;
            drag.current = null;
            const t = e.currentTarget;
            const dx = e.clientX - d.x;
            const fast = Math.abs(dx) / Math.max(1, performance.now() - d.t) > 0.4;
            const from = Math.round(d.left / t.clientWidth);
            const next = fast || Math.abs(dx) > t.clientWidth * 0.25 ? from - Math.sign(dx) : from;
            t.style.scrollSnapType = '';
            goTo(next);
          }}
        >
          {doc.slides.map((s, i) => (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${n}`}
              className="relative h-full w-full shrink-0 snap-start select-none"
            >
              <ScenePreview doc={doc} slide={i} fit="contain" className="size-full" maxDpr={2} />
            </div>
          ))}
        </div>
        {current > 0 && (
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goTo(current - 1)}
            className="absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        {current < n - 1 && (
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(current + 1)}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-1" role="tablist" aria-label="Slides">
          {doc.slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === current ? 'w-4 bg-accent' : 'w-1.5 bg-fg/25 hover:bg-fg/50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
