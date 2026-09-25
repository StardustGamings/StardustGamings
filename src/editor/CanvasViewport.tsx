'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { cn } from '@/utils/cn';
import { clamp } from '@/utils/math';
import { safeZones } from './safe-areas';
import { selectDoc, useEditor } from './store';
import { fitZoom, ZOOM_MAX, ZOOM_MIN } from './zoom';

const GRID_COLUMNS = 12;

export function useViewportZoom(size: { width: number; height: number } | null) {
  const doc = useEditor(selectDoc);
  const zoom = useEditor((s) => s.zoom);
  if (!doc || !size) return 0.25;
  if (zoom !== null) return zoom;
  const across = Math.min(doc.slides.length, Math.max(1, Math.floor(size.width / 440)));
  return fitZoom(size, { width: doc.slideWidth, height: doc.slideHeight }, across, size.width < 640 ? 20 : 56);
}

export function CanvasViewport({ onZoomComputed }: { onZoomComputed?: (zoom: number) => void }) {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const activeSlide = useEditor((s) => s.activeSlide);
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const setZoom = useEditor((s) => s.setZoom);
  const showGrid = useEditor((s) => s.showGrid);
  const showSafeArea = useEditor((s) => s.showSafeArea);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const zoom = useViewportZoom(size);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => onZoomComputed?.(zoom), [zoom, onZoomComputed]);

  // Keep the active slide in view when it changes from the filmstrip or keyboard.
  useEffect(() => {
    slideRefs.current[activeSlide]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeSlide]);

  // Trackpad pinch / Ctrl+wheel zoom (needs a non-passive listener to prevent page zoom).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const current = useEditor.getState().zoom ?? zoom;
      setZoom(clamp(current * Math.exp(-e.deltaY * 0.01), ZOOM_MIN, ZOOM_MAX));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, setZoom]);

  if (!doc || !meta) return null;
  const w = doc.slideWidth * zoom;
  const h = doc.slideHeight * zoom;
  const zones = showSafeArea ? safeZones(meta.sizeId, doc.slideWidth, doc.slideHeight) : [];
  // Profile-grid crops only ever apply to the first slide of a feed post.
  const zonesFor = (i: number) => (meta.sizeId === 'ig-portrait' && i > 0 ? [] : zones);
  const multi = doc.slides.length > 1;

  return (
    <div
      ref={scrollerRef}
      className="relative size-full overflow-auto overscroll-contain bg-canvas [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]"
      data-testid="canvas-viewport"
    >
      {/* Auto margins (not justify-center) keep overflowing strips scrollable from the first slide. */}
      <div className="flex min-h-full w-max min-w-full p-5 pt-9 sm:p-14">
        <div
          className="relative m-auto flex shrink-0 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]"
          style={{ width: w * doc.slides.length, height: h }}
        >
          {doc.slides.map((slide, i) => (
            <div
              key={slide.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              role="button"
              tabIndex={-1}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === activeSlide ? 'true' : undefined}
              onPointerDown={() => setActiveSlide(i)}
              className="relative shrink-0"
              style={{ width: w, height: h }}
            >
              <ScenePreview
                doc={doc}
                slide={i}
                eager
                maxDpr={2}
                className="size-full"
                style={{ width: w, height: h }}
                fit="contain"
              />

              {showGrid && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgb(160 107 255 / 0.35) 1px, transparent 1px), linear-gradient(to bottom, rgb(160 107 255 / 0.35) 1px, transparent 1px)',
                    backgroundSize: `${w / GRID_COLUMNS}px ${w / GRID_COLUMNS}px`,
                  }}
                />
              )}

              {zonesFor(i).map((z, zi) => (
                <div
                  key={zi}
                  aria-hidden
                  className="pointer-events-none absolute flex items-start justify-center overflow-hidden border border-dashed border-[#FF5C7A]/70 bg-[repeating-linear-gradient(45deg,rgb(255_92_122/0.16)_0_6px,transparent_6px_12px)]"
                  style={{ left: z.x * zoom, top: z.y * zoom, width: z.width * zoom, height: z.height * zoom }}
                >
                  {z.label && h > 220 && z.width * zoom > 90 && (
                    <span className="mt-1 rounded-full bg-[#FF5C7A] px-1.5 py-px text-[9px] font-bold tracking-wide whitespace-nowrap text-white uppercase">
                      {z.label}
                    </span>
                  )}
                </div>
              ))}

              {multi && (
                <span
                  className={cn(
                    'pointer-events-none absolute -top-6 left-0 font-mono text-[11px] font-semibold transition-colors',
                    i === activeSlide ? 'text-accent-text' : 'text-fg-subtle',
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              )}
              {multi && i > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 border-l border-dashed border-white/50 mix-blend-difference"
                />
              )}
              {multi && i === activeSlide && (
                <span aria-hidden className="pointer-events-none absolute -inset-[3px] rounded-[3px] border-2 border-accent" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
