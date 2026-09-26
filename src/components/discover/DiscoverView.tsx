'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { TEMPLATE_CATALOG } from '@/templates/registry';
import { useTemplateLookup } from '@/templates/store';
import { useTrends, useTrendLooks } from '@/trends/store';
import { formatCategory } from '@/trends/pack';
import type { FormatCategory, TrendPack } from '@/trends/schema';
import { buttonClasses } from '@/components/ui/button-styles';
import { SectionHeader } from '@/components/home/SectionHeader';
import { DropHeader } from './DropHeader';
import { EffectCard, FilterCard } from './EffectCard';
import { InspirationFeed } from './InspirationFeed';
import { KitCard } from './KitCard';
import { LayoutRuleCard } from './LayoutRuleCard';
import { PaletteCard } from './PaletteCard';
import { StickerTile } from './StickerTile';
import { TemplateCard, TemplateCardSkeleton } from './TemplateCard';
import { TypeCard } from './TypeCard';

const FORMAT_SECTIONS: { category: FormatCategory; id: string; eyebrow: string; title: string; description: string }[] = [
  {
    category: 'carousel',
    id: 'carousel-styles',
    eyebrow: 'Carousel styles',
    title: 'How carousels are being built',
    description: 'Swipe-worthy structures — pick one and drop your photos in.',
  },
  {
    category: 'meme',
    id: 'meme-formats',
    eyebrow: 'Meme formats',
    title: 'Formats everyone’s remixing',
    description: 'Original takes on the meme shapes of the month. Add your pics and a caption.',
  },
  {
    category: 'social',
    id: 'social-formats',
    eyebrow: 'Social formats',
    title: 'Posts people are making',
    description: 'Threads, hot takes, polls and cards — ready to fill in.',
  },
];

/** The categories in the order they appear, with whether this drop has anything for them. */
function categories(pack: TrendPack, looks: number) {
  const has = (c: FormatCategory) => pack.formats.some((f) => formatCategory(f) === c);
  return [
    { id: 'kits', label: 'Kits', show: pack.styles.length > 0 },
    { id: 'templates', label: 'Templates', show: pack.templates.length > 0 },
    { id: 'layouts', label: 'Layouts', show: pack.layouts.length + pack.layoutRules.length > 0 },
    { id: 'fonts', label: 'Fonts', show: pack.typography.length > 0 },
    { id: 'colours', label: 'Colours', show: pack.palettes.length > 0 },
    { id: 'filters', label: 'Filters', show: looks > 0 },
    { id: 'effects', label: 'Effects', show: pack.effects.length > 0 },
    { id: 'stickers', label: 'Stickers', show: pack.stickers.length > 0 },
    ...FORMAT_SECTIONS.map((s) => ({ id: s.id, label: s.eyebrow, show: has(s.category) })),
    { id: 'inspiration', label: 'Inspiration', show: true },
  ].filter((c) => c.show);
}

function CategoryNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="Trend categories"
      className="sticky top-[72px] z-20 -mx-4 mb-10 hide-scrollbar overflow-x-auto bg-bg/80 px-4 py-2 glass-strong sm:mx-0 sm:rounded-full sm:px-2"
      data-testid="trend-categories"
    >
      <ul className="flex gap-1">
        {items.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              className="inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold whitespace-nowrap text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              {c.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const byHeat = <T extends { heat?: number }>(list: T[]) => [...list].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));

export function DiscoverView() {
  const pack = useTrends((s) => s.pack);
  const markSeen = useTrends((s) => s.markSeen);
  const newDrop = useTrends((s) => s.newDrop);
  const looks = useTrendLooks();
  const templates = useTemplateLookup();
  const nav = categories(pack, looks.length);

  // Opening Discover counts as having seen the newest drop.
  useEffect(() => {
    if (newDrop) markSeen();
  }, [newDrop, markSeen]);

  const section = 'mb-14 scroll-mt-40';

  return (
    <>
      <DropHeader />
      <CategoryNav items={nav} />

      {pack.styles.length > 0 && (
        <section aria-labelledby="kits-title" id="kits" className={section}>
          <SectionHeader
            id="kits-title"
            eyebrow="Trend kits"
            title="Restyle anything in one tap"
            description="A palette, a type pairing, a filter and motion that belong together. In the editor, the Trends tool (R) puts a kit on your own design."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {byHeat(pack.styles).map((s) => (
              <KitCard key={`${pack.id}-${s.id}`} pack={pack} style={s} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="templates-title" id="templates" className={section}>
        <SectionHeader
          id="templates-title"
          eyebrow="Templates"
          title="Trending templates"
          description="Every template is fully original and yours to remix."
          action={
            <Link href="/templates/" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              All {TEMPLATE_CATALOG.length} <ArrowRight className="size-4" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {byHeat(pack.templates).map((t) => {
            const template = templates.get(t.templateId);
            return template ? (
              <TemplateCard key={t.templateId} template={template} subtitle={t.label} heat={t.heat} />
            ) : (
              <TemplateCardSkeleton key={t.templateId} />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="layouts-title" id="layouts" className={section}>
        <SectionHeader
          id="layouts-title"
          eyebrow="Layouts"
          title="Trending layouts"
          description="Layout rules run on your own photos, on this device — no upload, no AI service."
        />
        {pack.layoutRules.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {byHeat(pack.layoutRules).map((r) => (
              <LayoutRuleCard key={r.id} rule={r} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {byHeat(pack.layouts).map((l) => {
            const template = templates.get(l.templateId);
            return template ? (
              <TemplateCard key={l.id} template={template} title={l.name} subtitle={l.description} heat={l.heat} />
            ) : (
              <TemplateCardSkeleton key={l.id} />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="fonts-title" id="fonts" className={section}>
        <SectionHeader
          id="fonts-title"
          eyebrow="Fonts"
          title="Font pairings people are saving"
          description="Tap one to type your own words and start a post with it."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {byHeat(pack.typography).map((t) => (
            <TypeCard key={t.id} typo={t} />
          ))}
        </div>
      </section>

      <section aria-labelledby="colours-title" id="colours" className={section}>
        <SectionHeader id="colours-title" eyebrow="Colours" title="Palettes" description="Tap a swatch to copy its HEX code." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {byHeat(pack.palettes).map((p) => (
            <PaletteCard key={p.id} palette={p} />
          ))}
        </div>
      </section>

      {looks.length > 0 && (
        <section aria-labelledby="filters-title" id="filters" className={section}>
          <SectionHeader
            id="filters-title"
            eyebrow="Filters"
            title="New filters in this drop"
            description="Delivered as data and run by the editor’s own pipeline. Select a photo and open Filters (F) — they’re under Trending."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {looks.map((l) => (
              <FilterCard key={l.id} look={l} heat={pack.looks.find((x) => x.id === l.id)?.heat ?? 0} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="effects-title" id="effects" className={section}>
        <SectionHeader
          id="effects-title"
          eyebrow="Effects"
          title="Looks of the month"
          description="Rendered with the editor’s own filters. Select a photo and open Filters (F) to use them — hold a card to compare."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byHeat(pack.effects).map((e) => (
            <EffectCard key={e.id} effect={e} />
          ))}
        </div>
      </section>

      <section aria-labelledby="stickers-title" id="stickers" className={section}>
        <SectionHeader
          id="stickers-title"
          eyebrow="Stickers"
          title="Sticker drop"
          description="Tap to save a transparent PNG. In the editor they’re in Stickers, under this drop’s tab."
        />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {pack.stickers.map((s) => (
            <StickerTile key={s} stickerId={s} />
          ))}
        </div>
      </section>

      {FORMAT_SECTIONS.map((s) => {
        const list = byHeat(pack.formats.filter((f) => formatCategory(f) === s.category));
        if (!list.length) return null;
        return (
          <section key={s.id} aria-labelledby={`${s.id}-title`} id={s.id} className={section}>
            <SectionHeader id={`${s.id}-title`} eyebrow={s.eyebrow} title={s.title} description={s.description} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((f) => {
                const template = templates.get(f.templateId);
                return template ? (
                  <TemplateCard key={f.id} template={template} title={f.name} subtitle={f.description} heat={f.heat} />
                ) : (
                  <TemplateCardSkeleton key={f.id} />
                );
              })}
            </div>
          </section>
        );
      })}

      <section aria-labelledby="inspiration-title" id="inspiration" className="scroll-mt-40">
        <SectionHeader
          id="inspiration-title"
          eyebrow="Inspiration"
          title="Remix feed"
          description="Our templates re-coloured with this drop’s palettes."
        />
        <InspirationFeed />
      </section>
    </>
  );
}
