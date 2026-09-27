'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useTemplateLookup } from '@/templates/store';
import { useTrendLooks, useTrends } from '@/trends/store';
import { Segmented } from '@/components/ui/Segmented';
import { buttonClasses } from '@/components/ui/button-styles';
import { SectionHeader } from '@/components/home/SectionHeader';
import { EffectCard, FilterCard } from './EffectCard';
import { PaletteCard } from './PaletteCard';
import { Rail } from './Rail';
import { StickerTile } from './StickerTile';
import { TemplateCard, TemplateCardSkeleton } from './TemplateCard';
import { TypeCard } from './TypeCard';

type Tab = 'templates' | 'typography' | 'layouts' | 'effects' | 'palettes' | 'stickers' | 'formats';

const TABS: { value: Tab; label: string }[] = [
  { value: 'templates', label: 'Templates' },
  { value: 'typography', label: 'Typography' },
  { value: 'layouts', label: 'Layouts' },
  { value: 'effects', label: 'Filters & effects' },
  { value: 'palettes', label: 'Palettes' },
  { value: 'stickers', label: 'Stickers' },
  { value: 'formats', label: 'Memes & formats' },
];

export function Trending() {
  const pack = useTrends((s) => s.pack);
  const [tab, setTab] = useState<Tab>('templates');
  const templates = useTemplateLookup();
  const looks = useTrendLooks();
  const newDrop = useTrends((s) => s.newDrop);

  const content = () => {
    switch (tab) {
      case 'templates':
        return (
          <Rail label="Trending templates" itemClassName="w-[200px] sm:w-[230px]">
            {pack.templates.map((t) => {
              const template = templates.get(t.templateId);
              return template ? (
                <TemplateCard key={t.templateId} template={template} subtitle={t.label} />
              ) : (
                <TemplateCardSkeleton key={t.templateId} />
              );
            })}
          </Rail>
        );
      case 'layouts':
        return (
          <Rail label="Trending layouts" itemClassName="w-[200px] sm:w-[230px]">
            {pack.layouts.map((l) => {
              const template = templates.get(l.templateId);
              return template ? (
                <TemplateCard key={l.id} template={template} title={l.name} subtitle={l.description} />
              ) : (
                <TemplateCardSkeleton key={l.id} />
              );
            })}
          </Rail>
        );
      case 'typography':
        return (
          <Rail label="Trending typography" itemClassName="w-[260px] self-stretch">
            {pack.typography.map((t) => (
              <TypeCard key={t.id} typo={t} />
            ))}
          </Rail>
        );
      case 'effects':
        return (
          <Rail label="Trending effects" itemClassName="w-[260px]">
            {[
              ...looks.map((l) => <FilterCard key={`look-${l.id}`} look={l} />),
              ...pack.effects.map((e) => <EffectCard key={e.id} effect={e} />),
            ]}
          </Rail>
        );
      case 'palettes':
        return (
          <Rail label="Trending palettes" itemClassName="w-[240px]">
            {pack.palettes.map((p) => (
              <PaletteCard key={p.id} palette={p} />
            ))}
          </Rail>
        );
      case 'formats':
        return (
          <Rail label="Trending formats" itemClassName="w-[200px] sm:w-[230px]">
            {pack.formats.map((f) => {
              const template = templates.get(f.templateId);
              return template ? (
                <TemplateCard key={f.id} template={template} title={f.name} subtitle={`${f.kind} — ${f.description}`} />
              ) : (
                <TemplateCardSkeleton key={f.id} />
              );
            })}
          </Rail>
        );
      case 'stickers':
        return (
          <Rail label="Trending stickers" itemClassName="w-[120px]">
            {pack.stickers.map((s) => (
              <StickerTile key={s} stickerId={s} />
            ))}
          </Rail>
        );
    }
  };

  return (
    <section aria-labelledby="trending" className="mt-10">
      <SectionHeader
        id="trending"
        eyebrow={newDrop ? `New drop · ${pack.title}` : `Trending · ${pack.title}`}
        title="What’s hot right now"
        description={pack.subtitle}
        action={
          <Link href="/discover/" className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}>
            Discover <ArrowRight className="size-4" />
          </Link>
        }
      />
      <div className="-mx-4 mb-5 hide-scrollbar overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented value={tab} onChange={setTab} options={TABS} aria-label="Trending category" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {content()}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
