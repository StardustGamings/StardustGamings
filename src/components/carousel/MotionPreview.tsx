'use client';

import { Pause, Play, Repeat } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DesignDocument } from '@/types/document';
import { drawFrame } from '@/animations/frame';
import { planSequence } from '@/animations/sequence';
import { subscribeAssets } from '@/assets/cache';
import { ensureDocumentFonts } from '@/canvas/fonts';
import { resolveImage, setLivePlayback } from '@/images/resolver';
import { pauseAllPlayers } from '@/assets/video';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/utils/cn';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Plays a design as a video — every slide in turn with its animations and the
 * transitions between them — exactly as MP4 / GIF export renders it.
 */
export function MotionPreview({ doc, autoPlay = true }: { doc: DesignDocument; autoPlay?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const seq = useMemo(() => planSequence(doc), [doc]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [loop, setLoop] = useState(true);
  const [width, setWidth] = useState(320);
  const timeRef = useRef(0);
  const jump = (t: number) => {
    timeRef.current = t;
    setTime(t);
  };

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw whenever time, size, fonts or photos change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (width * dpr) / doc.slideWidth;
    const draw = () => {
      canvas.width = Math.max(1, Math.round(doc.slideWidth * scale));
      canvas.height = Math.max(1, Math.round(doc.slideHeight * scale));
      drawFrame(ctx, doc, seq, time, { scale, images: resolveImage, placeholders: false });
    };
    draw();
    void ensureDocumentFonts(doc).then((changed) => changed && draw());
    return subscribeAssets(draw);
  }, [doc, seq, width, time]);

  // Videos inside the design play in real time while the preview plays.
  useEffect(() => {
    setLivePlayback(playing);
    if (!playing) pauseAllPlayers();
    return () => {
      setLivePlayback(false);
      pauseAllPlayers();
    };
  }, [playing]);

  // The clock.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      let t = timeRef.current + (now - last);
      last = now;
      if (t >= seq.total) {
        if (!loop) {
          jump(seq.total);
          setPlaying(false);
          return;
        }
        t = 0;
      }
      jump(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, seq.total]);

  return (
    <div className="flex flex-col gap-3" data-testid="motion-preview">
      <div ref={boxRef} className="overflow-hidden rounded-[18px] bg-black shadow-[var(--shadow-lift)]">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ aspectRatio: `${doc.slideWidth} / ${doc.slideHeight}` }}
          role="img"
          aria-label="Video preview of the design"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => {
            if (!playing && time >= seq.total) jump(0);
            setPlaying(!playing);
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fg text-bg [&_svg]:size-4"
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <Slider
          aria-label="Video time"
          value={time}
          min={0}
          max={Math.max(1, seq.total)}
          step={10}
          onChange={(t) => {
            setPlaying(false);
            jump(t);
          }}
          valueText={seconds(time)}
        />
        <span className="shrink-0 font-mono text-[12px] text-fg-muted tabular-nums">
          {seconds(time)} / {seconds(seq.total)}
        </span>
        <button
          type="button"
          aria-label="Loop"
          aria-pressed={loop}
          onClick={() => setLoop(!loop)}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-[10px] [&_svg]:size-4',
            loop ? 'bg-surface-active text-fg' : 'text-fg-muted hover:bg-surface-hover',
          )}
        >
          <Repeat />
        </button>
      </div>
    </div>
  );
}
