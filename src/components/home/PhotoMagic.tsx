'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useUi, type PhotoFlowMode } from '@/settings/ui-store';
import { SectionHeader } from './SectionHeader';

const TILE = ['#FF5CAA', '#A06BFF', '#3CF0FF', '#C6FF3D', '#FFD23D', '#FF7A3D'];

function DumpArt() {
  return (
    <span className="relative block h-full w-full" aria-hidden>
      {[-14, -4, 7, 16].map((r, i) => (
        <span
          key={r}
          className="absolute top-1/2 left-1/2 h-16 w-13 rounded-[6px] border-[3px] border-white shadow-[var(--shadow-soft)] transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-[var(--dx)]"
          style={
            {
              background: `linear-gradient(135deg, ${TILE[i]}, ${TILE[i + 1]})`,
              transform: `translate(-50%, -50%) rotate(${r}deg)`,
              '--dx': `${(i - 1.5) * 12}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function SeamlessArt() {
  return (
    <span className="relative flex h-full w-full items-center justify-center" aria-hidden>
      <span className="relative h-16 w-[88%] overflow-hidden rounded-[8px]">
        <span
          className="absolute inset-y-0 -left-4 w-[140%] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:-translate-x-6"
          style={{ background: 'linear-gradient(90deg, #FF7A3D, #FF5CAA 30%, #A06BFF 55%, #3CF0FF 80%, #C6FF3D)' }}
        />
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute inset-y-0 w-px border-l border-dashed border-white/80"
            style={{ left: `${i * 25}%` }}
          />
        ))}
      </span>
    </span>
  );
}

function CollageArt() {
  const cells = [
    'col-span-2 row-span-2',
    'col-span-1 row-span-1',
    'col-span-1 row-span-1',
    'col-span-1 row-span-1',
    'col-span-2 row-span-1',
  ];
  return (
    <span className="grid h-16 w-24 grid-cols-3 grid-rows-3 gap-1" aria-hidden>
      {cells.map((c, i) => (
        <span
          key={i}
          className={`${c} rounded-[4px] transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-95`}
          style={{ background: TILE[(i + 1) % TILE.length], transitionDelay: `${i * 40}ms` }}
        />
      ))}
    </span>
  );
}

const CARDS: { mode: PhotoFlowMode; title: string; body: string; art: ReactNode; accent: string }[] = [
  {
    mode: 'dump',
    title: 'Smart photo dump',
    body: 'Pick 3–20 photos and a vibe. Get a finished carousel.',
    art: <DumpArt />,
    accent: 'linear-gradient(135deg, rgb(255 92 170 / 0.25), rgb(160 107 255 / 0.25))',
  },
  {
    mode: 'seamless',
    title: 'Seamless swipe',
    body: 'One continuous panorama across every slide.',
    art: <SeamlessArt />,
    accent: 'linear-gradient(135deg, rgb(255 122 61 / 0.25), rgb(60 240 255 / 0.25))',
  },
  {
    mode: 'collage',
    title: 'Collage maker',
    body: 'Shuffle until it slaps. Lock the ones you love.',
    art: <CollageArt />,
    accent: 'linear-gradient(135deg, rgb(198 255 61 / 0.25), rgb(60 240 255 / 0.25))',
  },
];

export function PhotoMagic() {
  const open = useUi((s) => s.openPhotoFlow);
  return (
    <section aria-labelledby="photo-magic" className="mt-10">
      <SectionHeader
        id="photo-magic"
        eyebrow="Photo magic"
        title="Start from your photos"
        description="Runs on your device. Everything it makes stays fully editable."
      />
      <ul className="grid gap-3 sm:grid-cols-3">
        {CARDS.map((c, i) => (
          <motion.li
            key={c.mode}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 300, damping: 26 }}
          >
            <motion.button
              type="button"
              onClick={() => open(c.mode, 'new')}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              className="group flex h-full w-full items-center gap-4 rounded-[22px] border border-line bg-surface p-3 text-left transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[var(--shadow-lift)]"
            >
              <span
                className="flex h-24 w-28 shrink-0 items-center justify-center rounded-[16px]"
                style={{ background: c.accent }}
              >
                {c.art}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold">{c.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-subtle">{c.body}</span>
              </span>
            </motion.button>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
