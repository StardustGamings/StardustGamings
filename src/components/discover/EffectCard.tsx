'use client';

import { useEffect, useRef, useState } from 'react';
import { useClientValue } from '@/hooks/useClientValue';
import type { TrendEffect } from '@/trends/schema';
import { lookFilter, type LookDefinition } from '@/filters/looks';
import { findLook } from '@/trends/pack';
import { useTrends } from '@/trends/store';
import { lookPreview } from '@/filters/preview';
import { Badge } from '@/components/ui/Badge';
import { samplePhoto, samplePhotoCanvas } from './sample-photo';

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const OVERLAYS: Record<TrendEffect['overlay'], React.CSSProperties | null> = {
  none: null,
  grain: { backgroundImage: GRAIN, opacity: 0.35, mixBlendMode: 'overlay' },
  bloom: { background: 'radial-gradient(circle at 60% 55%, rgba(255,255,255,0.55), transparent 55%)', mixBlendMode: 'screen' },
  scanlines: {
    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px)',
    mixBlendMode: 'multiply',
  },
  leak: { background: 'radial-gradient(circle at 0% 20%, rgba(255,120,40,0.85), transparent 50%)', mixBlendMode: 'screen' },
  vignette: { background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,0.75))' },
  fade: { background: 'rgba(255,248,235,0.18)', mixBlendMode: 'screen' },
};

/** The trend's look rendered by the real photo pipeline onto the sample photo. */
export function LookRender({ look, intensity, hidden }: { look: LookDefinition; intensity: number; hidden: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const photo = samplePhotoCanvas();
    const canvas = ref.current;
    if (!photo || !canvas) return;
    let live = true;
    void lookPreview(photo, { filter: lookFilter(look, intensity) }, 480).then((out) => {
      if (!live || !out) return;
      canvas.width = out.width;
      canvas.height = out.height;
      canvas.getContext('2d')?.drawImage(out, 0, 0);
    });
    return () => {
      live = false;
    };
  }, [look, intensity]);
  return <canvas ref={ref} aria-hidden className={`absolute inset-0 size-full object-cover ${hidden ? 'opacity-0' : ''}`} />;
}

/**
 * An effect from the trend pack, previewed on a sample photo: rendered with the
 * editor's own filter when the pack names one, otherwise a CSS approximation.
 * Press and hold to compare with the original.
 */
export function EffectCard({ effect }: { effect: TrendEffect }) {
  const src = useClientValue(samplePhoto, null);
  const [comparing, setComparing] = useState(false);
  const pack = useTrends((s) => s.pack);
  const look = findLook(pack, effect.look);
  const overlay = look ? null : OVERLAYS[effect.overlay];

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        className="relative block aspect-[4/3] w-full overflow-hidden bg-bg-sunken select-none"
        aria-label={`Hold to compare ${effect.name} with the original`}
        onPointerDown={() => setComparing(true)}
        onPointerUp={() => setComparing(false)}
        onPointerLeave={() => setComparing(false)}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setComparing(true)}
        onKeyUp={() => setComparing(false)}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img
            src={src}
            alt=""
            draggable={false}
            className="size-full object-cover transition-[filter] duration-300"
            style={{ filter: comparing || look ? 'none' : effect.css }}
          />
        )}
        {src && look && <LookRender look={look} intensity={effect.intensity ?? 100} hidden={comparing} />}
        {overlay && !comparing && <span aria-hidden className="absolute inset-0" style={overlay} />}
        <span className="absolute bottom-2 left-2 rounded-xs bg-ink/70 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
          {comparing ? 'Original' : 'Hold to compare'}
        </span>
      </button>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-subheading">{effect.name}</p>
          {look ? <Badge tone="accent">Filter · {look.name}</Badge> : <Badge>Preview</Badge>}
        </div>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-fg-muted">{effect.description}</p>
      </div>
    </div>
  );
}

/**
 * A filter from the trend pack (a look defined as data), on the sample photo
 * through the real pipeline. Hold to compare.
 */
export function FilterCard({ look }: { look: LookDefinition }) {
  const src = useClientValue(samplePhoto, null);
  const [comparing, setComparing] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface" data-testid="filter-card">
      <button
        type="button"
        className="relative block aspect-[4/3] w-full overflow-hidden bg-bg-sunken select-none"
        aria-label={`Hold to compare ${look.name} with the original`}
        onPointerDown={() => setComparing(true)}
        onPointerUp={() => setComparing(false)}
        onPointerLeave={() => setComparing(false)}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setComparing(true)}
        onKeyUp={() => setComparing(false)}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={src} alt="" draggable={false} className="size-full object-cover" />
        )}
        {src && <LookRender look={look} intensity={100} hidden={comparing} />}
        <span className="absolute bottom-2 left-2 rounded-xs bg-ink/70 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
          {comparing ? 'Original' : 'Hold to compare'}
        </span>
      </button>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-subheading">{look.name}</p>
          <Badge>New filter</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-fg-muted">{look.description}</p>
      </div>
    </div>
  );
}
