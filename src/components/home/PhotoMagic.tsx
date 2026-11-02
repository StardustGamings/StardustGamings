'use client';

import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUi, type PhotoFlowMode } from '@/settings/ui-store';
import { SectionHeader } from './SectionHeader';

/* Small line diagrams of what each flow makes: neutral frames, one accent detail. */

function SeamlessArt() {
  return (
    <span className="relative flex h-full w-full items-center justify-center" aria-hidden>
      <span className="relative flex h-8 w-[84%] overflow-hidden rounded-[2px] border border-line-strong bg-bg-elevated">
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
    <span className="grid h-9 w-[52px] grid-cols-3 grid-rows-3 gap-[2px]" aria-hidden>
      {cells.map((c, i) => (
        <span key={i} className={`${c} rounded-[2px] border border-line-strong ${i === 2 ? 'bg-accent' : 'bg-bg-elevated'}`} />
      ))}
    </span>
  );
}

const FLOWS: { mode: PhotoFlowMode; title: string; body: string; art: ReactNode }[] = [
  { mode: 'seamless', title: 'Seamless swipe', body: 'One panorama across every slide.', art: <SeamlessArt /> },
  { mode: 'collage', title: 'Collage maker', body: 'Shuffle layouts, lock the photos you love.', art: <CollageArt /> },
];

/** Photo-first flows (the photo dump sits in Start something) as a plain list: small diagrams, a title, one line each. */
export function PhotoMagic() {
  const open = useUi((s) => s.openPhotoFlow);
  return (
    <section aria-labelledby="photo-magic" className="mt-10">
      <SectionHeader id="photo-magic" title="From your photos" description="Runs on this device. Everything stays editable." />
      <ul className="divide-y divide-line border-y border-line sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {FLOWS.map((c) => (
          <li key={c.mode}>
            <button
              type="button"
              onClick={() => open(c.mode, 'new')}
              className="group flex w-full items-center gap-3.5 py-3 text-left transition-colors hover:bg-surface-hover sm:px-3"
            >
              <span className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-md bg-surface">{c.art}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-subheading">{c.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">{c.body}</span>
              </span>
              <ChevronRight className="mr-1 size-4 shrink-0 text-fg-subtle transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
