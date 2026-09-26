'use client';

import { Pause, Play } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElement } from '@/types/document';
import { ENTER_PRESETS, EXIT_PRESETS, LOOP_PRESETS } from '@/animations/engine';
import { homeSlide, slideDuration } from '@/animations/sequence';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';
import { elementLabel } from './core/ops';
import * as anim from './animation-actions';
import { ElementIcon } from './panels/ElementIcon';
import { formatSeconds, usePlayback } from './playback';
import { selectDoc, useEditor } from './store';

const LABEL_W = 156;
const SNAP = 50;
const snap = (ms: number) => Math.max(0, Math.round(ms / SNAP) * SNAP);

type Drag =
  | { kind: 'scrub' }
  | { kind: 'move'; id: string; startX: number; delay: number }
  | { kind: 'resize'; id: string; startX: number; duration: number }
  | { kind: 'exit'; id: string; startX: number; duration: number }
  | { kind: 'end'; startX: number; duration: number };

/**
 * The active slide's timeline: when each element enters (drag a bar to move it,
 * its right edge to change how long it takes), exits and loops; how long the
 * slide lasts (drag the end marker); and a playhead to scrub or play.
 */
export function Timeline() {
  const doc = useEditor(selectDoc);
  const active = useEditor((s) => s.activeSlide);
  const selection = useEditor((s) => s.selection);
  const { slide, time, playing } = usePlayback();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (!doc) return null;
  const duration = slideDuration(doc, active);
  const elements = doc.elements.filter((el) => !el.hidden && homeSlide(doc, el) === active).reverse();
  const track = Math.max(80, width - LABEL_W - 16);
  const span = Math.max(
    duration,
    ...elements.map((el) => (el.animation?.enter ? el.animation.enter.delay + el.animation.enter.duration : 0)),
  );
  const scale = track / span;
  const x = (ms: number) => ms * scale;
  const here = slide === active;
  const step = span > 8000 ? 2000 : span > 4000 ? 1000 : 500;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => i * step);

  const seekAt = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect();
    usePlayback.getState().seek(active, (clientX - rect.left - LABEL_W) / scale);
  };

  const begin = (e: ReactPointerEvent, d: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = d;
    if (d.kind === 'scrub') seekAt(e.clientX);
    if ('id' in d) useEditor.getState().select([d.id]);
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'scrub') return seekAt(e.clientX);
    const dms = (e.clientX - d.startX) / scale;
    if (d.kind === 'move') anim.patchEnter([d.id], { delay: snap(d.delay + dms) }, `timeline-move-${d.id}`);
    if (d.kind === 'resize')
      anim.patchEnter([d.id], { duration: Math.max(100, snap(d.duration + dms)) }, `timeline-size-${d.id}`);
    if (d.kind === 'exit')
      anim.patchExit([d.id], { duration: Math.max(100, Math.min(duration, snap(d.duration - dms))) }, `timeline-exit-${d.id}`);
    if (d.kind === 'end') anim.setSlideDuration(active, d.duration + dms, 'timeline-end');
  };
  const end = () => {
    drag.current = null;
  };

  const keyBar = (e: KeyboardEvent, el: DesignElement) => {
    const enter = el.animation?.enter;
    if (!enter) return;
    const delta = e.key === 'ArrowRight' ? 100 : e.key === 'ArrowLeft' ? -100 : 0;
    if (!delta) return;
    e.preventDefault();
    if (e.shiftKey) anim.patchEnter([el.id], { duration: Math.max(100, enter.duration + delta) }, `timeline-key-size-${el.id}`);
    else anim.patchEnter([el.id], { delay: Math.max(0, enter.delay + delta) }, `timeline-key-move-${el.id}`);
  };

  return (
    <section
      aria-label="Timeline"
      data-testid="timeline"
      className="z-10 hidden shrink-0 border-x-0 border-b-0 glass-strong lg:block"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div ref={box} className="relative px-2 py-1.5">
        {/* Header: transport + ruler */}
        <div className="flex h-8 items-center">
          <div className="flex shrink-0 items-center gap-1.5" style={{ width: LABEL_W }}>
            <IconButton
              label={playing && here ? 'Pause' : 'Play slide'}
              icon={playing && here ? <Pause /> : <Play />}
              size="sm"
              onClick={() => (playing && here ? usePlayback.getState().pause() : usePlayback.getState().play(active))}
            />
            <span className="font-mono text-[11px] text-fg-muted tabular-nums">
              {formatSeconds(here ? time : 0)} / {formatSeconds(duration)}
            </span>
          </div>
          <div
            className="relative h-full cursor-ew-resize"
            style={{ width: track }}
            onPointerDown={(e) => begin(e, { kind: 'scrub' })}
            data-testid="timeline-ruler"
            role="slider"
            aria-label="Playhead"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.round(here ? time : 0)}
            aria-valuetext={formatSeconds(here ? time : 0)}
            tabIndex={0}
            onKeyDown={(e) => {
              const delta = e.key === 'ArrowRight' ? 100 : e.key === 'ArrowLeft' ? -100 : 0;
              if (!delta) return;
              e.preventDefault();
              usePlayback.getState().seek(active, (here ? time : 0) + delta);
            }}
          >
            {ticks.map((t) => (
              <span key={t} className="absolute top-1 text-[10px] text-fg-subtle tabular-nums" style={{ left: x(t) }}>
                <span className="absolute top-3.5 left-0 h-2 w-px bg-line-strong" />
                {t / 1000}s
              </span>
            ))}
            {/* Slide end marker (drag to change the slide's length). */}
            <span
              role="slider"
              aria-label="Slide length"
              aria-valuemin={500}
              aria-valuemax={60000}
              aria-valuenow={duration}
              aria-valuetext={formatSeconds(duration)}
              tabIndex={0}
              title="Drag to change how long this slide lasts"
              data-testid="slide-end"
              onPointerDown={(e) => begin(e, { kind: 'end', startX: e.clientX, duration })}
              onKeyDown={(e) => {
                const delta = e.key === 'ArrowRight' ? 250 : e.key === 'ArrowLeft' ? -250 : 0;
                if (!delta) return;
                e.preventDefault();
                anim.setSlideDuration(active, duration + delta, 'timeline-end-key');
              }}
              className="absolute top-0 bottom-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize justify-center"
              style={{ left: x(duration) }}
            >
              <span className="h-full w-1 rounded-full bg-warning" />
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="max-h-[132px] overflow-y-auto">
          {elements.length === 0 && (
            <p className="py-3 text-center text-[12px] text-fg-muted">This slide is empty — add something to animate.</p>
          )}
          {elements.map((el) => {
            const a = el.animation;
            const selected = selection.includes(el.id);
            return (
              <div key={el.id} className={cn('flex h-7 items-center rounded-[8px]', selected && 'bg-surface-active/60')}>
                <button
                  type="button"
                  onClick={() => useEditor.getState().select([el.id])}
                  className="flex shrink-0 items-center gap-1.5 truncate pr-2 pl-1 text-left text-[12px] font-medium text-fg-muted hover:text-fg"
                  style={{ width: LABEL_W }}
                >
                  <ElementIcon el={el} className="size-3.5 shrink-0" />
                  <span className="truncate">{elementLabel(el)}</span>
                </button>
                <div className="relative h-full" style={{ width: track }} onPointerDown={(e) => begin(e, { kind: 'scrub' })}>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                  {a?.loop && (
                    <span
                      className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,var(--color-violet)_0_6px,transparent_6px_10px)] opacity-70"
                      style={{ left: 0, width: x(duration) }}
                      title={`${LOOP_PRESETS[a.loop.preset].label} loop`}
                    />
                  )}
                  {a?.enter && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`${elementLabel(el)}: ${ENTER_PRESETS[a.enter.preset].label} at ${formatSeconds(a.enter.delay)} for ${formatSeconds(a.enter.duration)} (arrows move, Shift+arrows resize)`}
                      data-testid="enter-bar"
                      onKeyDown={(e) => keyBar(e, el)}
                      onPointerDown={(e) => begin(e, { kind: 'move', id: el.id, startX: e.clientX, delay: a.enter!.delay })}
                      className={cn(
                        'absolute top-1 bottom-1 flex cursor-grab items-center overflow-hidden rounded-[6px] bg-accent pl-1.5 text-[10px] font-bold text-accent-fg active:cursor-grabbing',
                        selected && 'ring-2 ring-fg/60',
                      )}
                      style={{ left: x(a.enter.delay), width: Math.max(10, x(a.enter.duration)) }}
                    >
                      <span className="truncate">{ENTER_PRESETS[a.enter.preset].label}</span>
                      <span
                        aria-hidden
                        data-testid="enter-bar-end"
                        onPointerDown={(e) =>
                          begin(e, { kind: 'resize', id: el.id, startX: e.clientX, duration: a.enter!.duration })
                        }
                        className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize bg-accent-fg/20"
                      />
                    </span>
                  )}
                  {a?.exit && (
                    <span
                      className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded-[6px] bg-pink pr-1.5 text-[10px] font-bold text-ink"
                      style={{ left: x(duration - a.exit.duration), width: Math.max(10, x(a.exit.duration)) }}
                      title={`${EXIT_PRESETS[a.exit.preset].label} exit`}
                    >
                      <span
                        aria-hidden
                        onPointerDown={(e) =>
                          begin(e, { kind: 'exit', id: el.id, startX: e.clientX, duration: a.exit!.duration })
                        }
                        className="absolute top-0 bottom-0 left-0 w-2 cursor-col-resize bg-ink/15"
                      />
                      <span className="ml-auto truncate">{EXIT_PRESETS[a.exit.preset].label}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        {here && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1.5 bottom-1.5 z-20 w-0.5 rounded-full bg-fg"
            style={{ left: 8 + LABEL_W + x(time) }}
            data-testid="playhead"
          />
        )}
      </div>
    </section>
  );
}
