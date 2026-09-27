'use client';

import { FORMAT_ORDER, FORMATS, SIZE_PRESETS } from '@/projects/formats';
import { useUi } from '@/settings/ui-store';
import { FormatIcon } from './FormatIcon';
import { SectionHeader } from './SectionHeader';

/** One tile per format, drawn at the format's real proportions. */
export function QuickCreate() {
  const openNewProject = useUi((s) => s.openNewProject);
  return (
    <section aria-labelledby="quick-create" className="mt-8">
      <SectionHeader id="quick-create" title="What are we making?" />
      <ul className="grid grid-cols-4 gap-2 sm:gap-2.5 xl:grid-cols-8">
        {FORMAT_ORDER.map((id) => {
          const f = FORMATS[id];
          const size = SIZE_PRESETS[f.sizeId];
          const ratio = size.width / size.height;
          const box = 44;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => openNewProject(id)}
                className="group flex h-full w-full flex-col rounded-lg border border-line bg-surface p-1.5 text-left transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-hover active:scale-[0.99] sm:p-2.5"
                aria-label={`New ${f.label}: ${f.tagline}`}
              >
                <span className="flex h-14 items-center justify-center rounded-md bg-bg-sunken sm:h-[76px]" aria-hidden>
                  <span
                    className="flex scale-75 items-center justify-center rounded-xs border-[1.5px] border-fg-subtle text-fg-subtle transition-colors duration-150 group-hover:border-accent-text group-hover:text-accent-text sm:scale-100"
                    style={{ width: ratio >= 1 ? box : box * ratio, height: ratio >= 1 ? box / ratio : box }}
                  >
                    <FormatIcon format={id} className="size-3.5" />
                  </span>
                  {f.id === 'carousel' && (
                    <span className="ml-1 hidden gap-1 sm:flex" aria-hidden>
                      <span className="h-[44px] w-1.5 rounded-xs border-[1.5px] border-line-strong" />
                      <span className="h-[44px] w-1 rounded-xs border-[1.5px] border-line" />
                    </span>
                  )}
                </span>
                <span className="mt-2 block truncate px-0.5 text-[12px] font-semibold sm:mt-2.5 sm:px-0 sm:text-subheading">
                  {f.label}
                </span>
                <span className="mt-0.5 block px-0.5 text-meta sm:px-0">{size.ratio}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
