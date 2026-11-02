'use client';

import Link from 'next/link';
import { FORMAT_ORDER, FORMATS, SIZE_PRESETS } from '@/projects/formats';
import { useUi } from '@/settings/ui-store';
import { SectionHeader } from './SectionHeader';

/** Three slides in a row: the carousel mark on the primary tile. */
function CarouselGlyph() {
  return (
    <span aria-hidden className="flex items-end gap-1">
      <span className="h-7 w-[22px] rounded-[3px] border-[1.5px] border-current" />
      <span className="h-7 w-[22px] rounded-[3px] border-[1.5px] border-current opacity-60" />
      <span className="h-7 w-2.5 rounded-l-[3px] border-[1.5px] border-r-0 border-current opacity-35" />
    </span>
  );
}

/** A loose stack of photos: the photo dump mark. */
function DumpGlyph() {
  return (
    <span aria-hidden className="relative block h-7 w-12">
      {[-9, -1, 8].map((r, i) => (
        <span
          key={r}
          className="absolute top-0 left-1/2 h-7 w-[22px] rounded-[3px] border-[1.5px] border-fg-muted bg-surface"
          style={{ transform: `translateX(calc(-50% + ${(i - 1) * 9}px)) rotate(${r}deg)` }}
        />
      ))}
      <span className="absolute top-1 left-1/2 size-1.5 translate-x-[11px] rounded-full bg-accent" />
    </span>
  );
}

/**
 * The ways in: a carousel (the main thing people make) and a photo dump as two large actions,
 * then every other format as a row of shapes drawn at their real proportions.
 */
export function QuickCreate() {
  const openNewProject = useUi((s) => s.openNewProject);
  const openPhotoFlow = useUi((s) => s.openPhotoFlow);
  const carousel = FORMATS.carousel;
  const others = FORMAT_ORDER.filter((id) => id !== 'carousel');

  return (
    <section aria-labelledby="quick-create" className="mt-10">
      <SectionHeader id="quick-create" title="Start something" />
      <div className="grid grid-cols-2 gap-2.5 sm:max-w-lg">
        <button
          type="button"
          onClick={() => openNewProject('carousel')}
          aria-label={`New ${carousel.label}: ${carousel.tagline}`}
          className="flex h-[108px] pressable flex-col justify-between rounded-lg bg-accent p-3.5 text-left text-accent-fg hover:bg-accent-hover"
        >
          <CarouselGlyph />
          <span>
            <span className="block text-[15px] leading-tight font-semibold">New carousel</span>
            <span className="mt-0.5 block text-[12px] font-medium text-accent-fg">
              {SIZE_PRESETS[carousel.sizeId].ratio} · swipeable
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => openPhotoFlow('dump', 'new')}
          aria-label="Smart photo dump: pick 3–20 photos and a vibe, get a finished carousel"
          className="flex h-[108px] pressable flex-col justify-between rounded-lg border border-line bg-surface p-3.5 text-left hover:border-line-strong"
        >
          <DumpGlyph />
          <span>
            <span className="block text-[15px] leading-tight font-semibold">Photo dump</span>
            <span className="mt-0.5 block text-[12px] text-fg-muted">From 3–20 photos</span>
          </span>
        </button>
      </div>

      <ul className="-mx-4 mt-4 hide-scrollbar flex gap-0.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {others.map((id) => {
          const f = FORMATS[id];
          const size = SIZE_PRESETS[f.sizeId];
          const ratio = size.width / size.height;
          const box = 34;
          return (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => openNewProject(id)}
                aria-label={`New ${f.label}: ${f.tagline}`}
                className="group flex w-[78px] pressable flex-col items-center rounded-md pt-2 pb-1.5 hover:bg-surface-hover"
              >
                <span className="flex h-10 items-center justify-center" aria-hidden>
                  <span
                    className="rounded-[3px] border-[1.5px] border-fg-subtle transition-colors duration-150 group-hover:border-accent-text"
                    style={{ width: ratio >= 1 ? box : box * ratio, height: ratio >= 1 ? box / ratio : box }}
                  />
                </span>
                <span className="mt-1.5 max-w-full truncate px-1 text-[12.5px] font-medium">{f.label}</span>
                <span className="text-[11px] text-fg-subtle tabular-nums">{size.ratio}</span>
              </button>
            </li>
          );
        })}
        <li className="shrink-0">
          <Link
            href="/templates/"
            className="group flex w-[78px] pressable flex-col items-center rounded-md pt-2 pb-1.5 hover:bg-surface-hover"
          >
            <span className="flex h-10 items-center justify-center" aria-hidden>
              <span className="grid size-[30px] grid-cols-2 gap-[3px]">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="rounded-[2px] border-[1.5px] border-fg-subtle transition-colors duration-150 group-hover:border-accent-text"
                  />
                ))}
              </span>
            </span>
            <span className="mt-1.5 text-[12.5px] font-medium">Template</span>
            <span className="text-[11px] text-fg-subtle">Browse</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
