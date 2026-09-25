'use client';

import { motion } from 'motion/react';
import { FORMAT_ORDER, FORMATS, SIZE_PRESETS } from '@/projects/formats';
import { useUi } from '@/settings/ui-store';
import { FormatIcon } from './FormatIcon';
import { SectionHeader } from './SectionHeader';

export function QuickCreate() {
  const openNewProject = useUi((s) => s.openNewProject);
  return (
    <section aria-labelledby="quick-create" className="mt-10">
      <SectionHeader id="quick-create" eyebrow="Quick create" title="What are we making?" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {FORMAT_ORDER.map((id, i) => {
          const f = FORMATS[id];
          const size = SIZE_PRESETS[f.sizeId];
          const ratio = size.width / size.height;
          return (
            <motion.li
              key={id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, type: 'spring', stiffness: 300, damping: 26 }}
            >
              <motion.button
                type="button"
                onClick={() => openNewProject(id)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="group relative flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-line bg-surface p-3 text-left transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[var(--shadow-lift)]"
                aria-label={`New ${f.label}: ${f.tagline}`}
              >
                <span className="relative flex h-24 items-center justify-center" aria-hidden>
                  <span
                    className="absolute inset-0 rounded-[16px] opacity-20 transition-opacity duration-300 group-hover:opacity-40"
                    style={{ background: `linear-gradient(135deg, ${f.accent[0]}, ${f.accent[1]})` }}
                  />
                  <span
                    className="relative flex items-center justify-center rounded-[8px] text-ink shadow-[var(--shadow-soft)] transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-110 group-hover:rotate-[-4deg]"
                    style={{
                      background: `linear-gradient(135deg, ${f.accent[0]}, ${f.accent[1]})`,
                      width: ratio >= 1 ? 64 : 64 * ratio,
                      height: ratio >= 1 ? 64 / ratio : 64,
                    }}
                  >
                    <FormatIcon format={id} className="size-5" />
                  </span>
                  {f.id === 'carousel' && (
                    <span className="absolute bottom-2 flex gap-1">
                      {[0, 1, 2, 3].map((d) => (
                        <span key={d} className="size-1 rounded-full bg-fg/40 first:bg-fg" />
                      ))}
                    </span>
                  )}
                </span>
                <span className="mt-3 block text-sm font-bold">{f.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-fg-subtle">{f.tagline}</span>
              </motion.button>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
