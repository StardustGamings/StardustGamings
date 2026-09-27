'use client';

import { Eye, GalleryHorizontal, Sparkles } from 'lucide-react';
import type { CollageFamily } from '@/types/document';
import { FAMILY_LABELS } from '@/layouts/collage';
import { useUi } from '@/settings/ui-store';
import { makeCollage } from '../layout-actions';
import { useSelectedElements } from './useSelection';

/** Tiny line drawings of each collage style. */
export function FamilyGlyph({ family, className }: { family: CollageFamily; className?: string }) {
  const common = { fill: 'currentColor', fillOpacity: 0.28, stroke: 'currentColor', strokeWidth: 1.5 };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {family === 'grid' && (
        <>
          <rect x="4" y="6" width="22" height="16" {...common} />
          <rect x="28" y="6" width="16" height="16" {...common} />
          <rect x="4" y="25" width="13" height="17" {...common} />
          <rect x="19" y="25" width="25" height="17" {...common} />
        </>
      )}
      {family === 'editorial' && (
        <>
          <rect x="4" y="5" width="24" height="38" {...common} />
          <rect x="30" y="5" width="14" height="18" {...common} />
          <rect x="30" y="25" width="14" height="18" {...common} />
        </>
      )}
      {family === 'bento' && (
        <>
          <rect x="4" y="5" width="22" height="22" rx="4" {...common} />
          <rect x="28" y="5" width="16" height="12" rx="4" {...common} />
          <rect x="28" y="19" width="16" height="24" rx="4" {...common} />
          <rect x="4" y="29" width="22" height="14" rx="4" {...common} />
        </>
      )}
      {family === 'scrapbook' && (
        <>
          <rect x="6" y="8" width="20" height="16" transform="rotate(-8 16 16)" {...common} />
          <rect x="22" y="14" width="20" height="16" transform="rotate(10 32 22)" {...common} />
          <rect x="10" y="26" width="20" height="16" transform="rotate(4 20 34)" {...common} />
        </>
      )}
      {family === 'polaroid' && (
        <>
          <rect x="6" y="8" width="18" height="22" transform="rotate(-7 15 19)" {...common} fillOpacity={0.12} />
          <rect x="8" y="10" width="14" height="13" transform="rotate(-7 15 19)" {...common} />
          <rect x="24" y="16" width="18" height="22" transform="rotate(6 33 27)" {...common} fillOpacity={0.12} />
          <rect x="26" y="18" width="14" height="13" transform="rotate(6 33 27)" {...common} />
        </>
      )}
      {family === 'filmstrip' && (
        <>
          <rect x="2" y="14" width="44" height="20" {...common} fillOpacity={0.5} />
          {[5, 18, 31].map((x) => (
            <rect
              key={x}
              x={x}
              y="18"
              width="11"
              height="12"
              fill="currentColor"
              fillOpacity={0.15}
              stroke="currentColor"
              strokeWidth={1}
            />
          ))}
        </>
      )}
    </svg>
  );
}

const FAMILIES = Object.keys(FAMILY_LABELS) as CollageFamily[];

export function LayoutsPanel() {
  const openFlow = useUi((s) => s.openPhotoFlow);
  const setPreview = useUi((s) => s.setCarouselPreview);
  const photos = useSelectedElements().filter((e) => e.type === 'image' && e.assetId && !e.locked);
  const fromSelection = photos.length >= 2;

  return (
    <div data-testid="layouts-panel">
      <div className="flex flex-col gap-2 p-4">
        <button
          type="button"
          onClick={() => openFlow('dump', 'current')}
          className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-accent"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink bg-nova">
            <Sparkles className="size-4" />
          </span>
          <span>
            <span className="block text-[13.5px] font-bold">Smart photo dump</span>
            <span className="block text-[12px] leading-snug text-fg-subtle">Pick photos and a vibe — get finished slides.</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => openFlow('seamless', 'current')}
          className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-accent"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg">
            <GalleryHorizontal className="size-4" />
          </span>
          <span>
            <span className="block text-[13.5px] font-bold">Seamless swipe</span>
            <span className="block text-[12px] leading-snug text-fg-subtle">One continuous panorama across slides.</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="flex h-9 items-center justify-center gap-2 rounded-lg border border-line text-[12.5px] font-semibold text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          <Eye className="size-4" /> Swipe preview
        </button>
      </div>

      <h3 className="px-4 pt-1 text-label">Collage</h3>
      <p className="px-4 pt-1 text-[12px] text-fg-subtle" aria-live="polite">
        {fromSelection
          ? `Arrange the ${photos.length} selected photos on their slide.`
          : 'Pick photos next, or select 2+ photos on the canvas first.'}
      </p>
      <div className="grid grid-cols-3 gap-2 p-4">
        {FAMILIES.map((f) => (
          <button
            key={f}
            type="button"
            aria-label={`${FAMILY_LABELS[f]} collage`}
            onClick={() => (fromSelection ? makeCollage(f) : openFlow('collage', 'current', f))}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-line bg-surface p-2.5 text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            <FamilyGlyph family={f} className="size-11" />
            <span className="text-[11.5px] font-semibold">{FAMILY_LABELS[f]}</span>
          </button>
        ))}
      </div>
      <p className="px-4 pb-4 text-[11.5px] text-fg-subtle">
        Select any collage photo to shuffle, remix (more chaotic, minimal, aesthetic, editorial, Gen-Z) or keep a photo in place.
      </p>
    </div>
  );
}
