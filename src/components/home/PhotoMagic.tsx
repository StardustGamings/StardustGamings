'use client';

import type { ReactNode } from 'react';
import { useUi, type PhotoFlowMode } from '@/settings/ui-store';
import { SectionHeader } from './SectionHeader';

/* Small line diagrams of what each flow makes: neutral frames, one accent detail. */

function DumpArt() {
  return (
    <span className="relative block h-full w-full" aria-hidden>
      {[-10, -2, 7].map((r, i) => (
        <span
          key={r}
          className="absolute top-1/2 left-1/2 h-12 w-10 rounded-xs border border-line-strong bg-bg-elevated"
          style={{ transform: `translate(calc(-50% + ${(i - 1) * 10}px), -50%) rotate(${r}deg)` }}
        />
      ))}
      <span className="absolute top-1/2 left-1/2 size-2 translate-x-[10px] -translate-y-[14px] rounded-full bg-accent" />
    </span>
  );
}

function SeamlessArt() {
  return (
    <span className="relative flex h-full w-full items-center justify-center" aria-hidden>
      <span className="relative flex h-11 w-[84%] overflow-hidden rounded-xs border border-line-strong bg-bg-elevated">
        {[1, 2, 3].map((i) => (
          <span key={i} className="absolute inset-y-0 border-l border-dashed border-line-strong" style={{ left: `${i * 25}%` }} />
        ))}
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path
            d="M0 24 L18 14 L32 20 L52 6 L70 18 L84 12 L100 20"
            fill="none"
            stroke="var(--accent-text)"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    </span>
  );
}

function CollageArt() {
  const cells = ['col-span-2 row-span-2', '', '', '', 'col-span-2'];
  return (
    <span className="grid h-12 w-[72px] grid-cols-3 grid-rows-3 gap-[3px]" aria-hidden>
      {cells.map((c, i) => (
        <span key={i} className={`${c} rounded-[2px] border border-line-strong ${i === 2 ? 'bg-accent' : 'bg-bg-elevated'}`} />
      ))}
    </span>
  );
}

const CARDS: { mode: PhotoFlowMode; title: string; body: string; art: ReactNode }[] = [
  { mode: 'dump', title: 'Smart photo dump', body: 'Pick 3–20 photos and a vibe. Get a finished carousel.', art: <DumpArt /> },
  { mode: 'seamless', title: 'Seamless swipe', body: 'One continuous panorama across every slide.', art: <SeamlessArt /> },
  { mode: 'collage', title: 'Collage maker', body: 'Shuffle the layout; lock the photos you want to keep.', art: <CollageArt /> },
];

export function PhotoMagic() {
  const open = useUi((s) => s.openPhotoFlow);
  return (
    <section aria-labelledby="photo-magic" className="mt-8">
      <SectionHeader
        id="photo-magic"
        title="Start from your photos"
        description="Runs on your device. Everything it makes stays fully editable."
      />
      <ul className="grid gap-2.5 sm:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.mode}>
            <button
              type="button"
              onClick={() => open(c.mode, 'new')}
              className="group flex h-full w-full items-center gap-3.5 rounded-lg border border-line bg-surface p-2.5 text-left transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-hover active:scale-[0.99]"
            >
              <span className="flex h-[72px] w-24 shrink-0 items-center justify-center rounded-md bg-bg-sunken">{c.art}</span>
              <span className="min-w-0">
                <span className="block text-subheading">{c.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-muted">{c.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
