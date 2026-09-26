'use client';

import { useRef, useState } from 'react';
import type { CurvePoint, ImageCurves } from '@/types/document';
import { curveTable, IDENTITY_CURVE } from '@/images/adjustments';
import { clamp } from '@/utils/math';
import { cn } from '@/utils/cn';

const SIZE = 220;
const CHANNELS: { id: keyof ImageCurves; label: string; color: string }[] = [
  { id: 'rgb', label: 'RGB', color: 'var(--fg)' },
  { id: 'r', label: 'Red', color: '#FF5C7A' },
  { id: 'g', label: 'Green', color: '#3DDB8B' },
  { id: 'b', label: 'Blue', color: '#4C8DFF' },
];

/**
 * Tone-curve editor: drag points, tap the curve to add one, double-tap (or drag
 * off the chart) to remove one. Points are keyboard-adjustable with arrow keys.
 */
export function CurveEditor({
  curves,
  onChange,
}: {
  curves: ImageCurves | undefined;
  onChange: (channel: keyof ImageCurves, points: CurvePoint[] | undefined) => void;
}) {
  const [channel, setChannel] = useState<keyof ImageCurves>('rgb');
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ index: number; pointerId: number } | null>(null);
  const points = curves?.[channel] ?? IDENTITY_CURVE;
  const meta = CHANNELS.find((c) => c.id === channel)!;

  const commit = (next: CurvePoint[]) => {
    const identity = next.length === 2 && next.every((p) => Math.abs(p.x - p.y) < 1e-3);
    onChange(channel, identity ? undefined : next.map((p) => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4) })));
  };

  const toPoint = (e: { clientX: number; clientY: number }): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  /** Moves point `i`, keeping endpoints on the edges and inner points between their neighbours. */
  const moved = (list: CurvePoint[], i: number, p: CurvePoint): CurvePoint[] => {
    const next = [...list];
    const last = list.length - 1;
    const x = i === 0 ? 0 : i === last ? 1 : clamp(p.x, list[i - 1]!.x + 0.01, list[i + 1]!.x - 0.01);
    next[i] = { x, y: clamp(p.y, 0, 1) };
    return next;
  };

  const table = curveTable(points);
  const path = Array.from({ length: 65 }, (_, i) => {
    const x = i / 64;
    const y = table[Math.round(x * 255)]! / 255;
    return `${i === 0 ? 'M' : 'L'}${(x * SIZE).toFixed(1)} ${((1 - y) * SIZE).toFixed(1)}`;
  }).join(' ');

  return (
    <div>
      <div className="mb-2 flex gap-1" role="radiogroup" aria-label="Curve channel">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={channel === c.id}
            onClick={() => setChannel(c.id)}
            className={cn(
              'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full text-[11.5px] font-semibold transition-colors',
              channel === c.id ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-hover',
            )}
          >
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.label}
            {curves?.[c.id] && <span className="sr-only"> (edited)</span>}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="aspect-square w-full touch-none rounded-[12px] border border-line bg-bg-sunken/70"
        data-testid="curve-editor"
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-curve-point]')) return;
          // Tap the chart: add a point on the curve at that input level.
          const p = toPoint(e);
          const y = table[Math.round(p.x * 255)]! / 255;
          const next = [...points, { x: p.x, y: Math.abs(p.y - y) < 0.12 ? y : p.y }].sort((a, b) => a.x - b.x);
          if (next.length > 16) return;
          const index = next.findIndex((q) => q.x === p.x);
          commit(next);
          drag.current = { index, pointerId: e.pointerId };
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current || drag.current.pointerId !== e.pointerId) return;
          commit(moved(points, drag.current.index, toPoint(e)));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          const rect = svgRef.current!.getBoundingClientRect();
          const outside = e.clientY < rect.top - 24 || e.clientY > rect.bottom + 24;
          if (outside && d.index > 0 && d.index < points.length - 1) commit(points.filter((_, i) => i !== d.index));
        }}
      >
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t} stroke="var(--border)" strokeWidth="1">
            <line x1={t * SIZE} y1={0} x2={t * SIZE} y2={SIZE} />
            <line x1={0} y1={t * SIZE} x2={SIZE} y2={t * SIZE} />
          </g>
        ))}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="var(--border-strong)" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            data-curve-point={i}
            tabIndex={0}
            role="slider"
            aria-label={`Curve point ${i + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p.y * 100)}
            aria-valuetext={`Input ${Math.round(p.x * 100)}%, output ${Math.round(p.y * 100)}%`}
            cx={p.x * SIZE}
            cy={(1 - p.y) * SIZE}
            r={7}
            fill="var(--bg-elevated)"
            stroke={meta.color}
            strokeWidth="2.5"
            className="cursor-grab outline-none focus-visible:stroke-[4]"
            onPointerDown={(e) => {
              e.stopPropagation();
              drag.current = { index: i, pointerId: e.pointerId };
              svgRef.current?.setPointerCapture(e.pointerId);
            }}
            onDoubleClick={() => i > 0 && i < points.length - 1 && commit(points.filter((_, j) => j !== i))}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 0.05 : 0.01;
              const delta = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
              if (delta) {
                e.preventDefault();
                e.stopPropagation();
                commit(moved(points, i, { x: p.x + delta[0]!, y: p.y + delta[1]! }));
              } else if ((e.key === 'Delete' || e.key === 'Backspace') && i > 0 && i < points.length - 1) {
                e.preventDefault();
                e.stopPropagation();
                commit(points.filter((_, j) => j !== i));
              }
            }}
          />
        ))}
      </svg>
      <p className="mt-1.5 text-[11px] text-fg-subtle">Tap the curve to add a point · drag it off the chart to remove.</p>
    </div>
  );
}
