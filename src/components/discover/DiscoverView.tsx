'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TEMPLATE_CATALOG } from '@/templates/registry';
import { useTemplateLookup, useTemplates } from '@/templates/store';
import { useTrends } from '@/trends/store';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { SectionHeader } from '@/components/home/SectionHeader';
import { EffectCard } from './EffectCard';
import { InspirationFeed } from './InspirationFeed';
import { PaletteCard } from './PaletteCard';
import { StickerTile } from './StickerTile';
import { TemplateCard, TemplateCardSkeleton } from './TemplateCard';
import { TypeCard } from './TypeCard';

/** A varied first row: one template per format, round-robin. */
function useTemplateTeaser(count: number) {
  const { bundled } = useTemplates();
  const byFormat = new Map<string, typeof bundled>();
  bundled.forEach((t) => byFormat.set(t.format, [...(byFormat.get(t.format) ?? []), t]));
  const queues = [...byFormat.values()].map((q) => [...q]);
  const out: typeof bundled = [];
  while (out.length < count && queues.some((q) => q.length))
    queues.forEach((q) => q.length && out.length < count && out.push(q.shift()!));
  return out;
}

export function DiscoverView() {
  const pack = useTrends((s) => s.pack);
  const templates = useTemplateLookup();
  const teaser = useTemplateTeaser(10);

  return (
    <>
      <header
        className="relative mb-12 overflow-hidden rounded-[32px] border border-line p-6 sm:p-10"
        style={{
          background: `linear-gradient(120deg, ${pack.accent[0]}33, transparent 45%), linear-gradient(300deg, ${pack.accent[1]}40, transparent 50%)`,
        }}
      >
        <Badge tone="accent">Trend pack · {pack.publishedAt.slice(0, 7)}</Badge>
        <h1 className="mt-4 text-4xl font-extrabold sm:text-6xl">{pack.title}</h1>
        <p className="mt-3 max-w-xl text-fg-muted">{pack.subtitle}</p>
        <p className="mt-6 text-xs text-fg-subtle">
          Trend packs are plain JSON — new drops arrive without an app update, and everything here works offline.
        </p>
      </header>

      <section aria-labelledby="templates" className="mb-14">
        <SectionHeader
          id="templates"
          eyebrow="Templates"
          title="Start from something good"
          description="Every template is fully original and yours to remix."
          action={
            <Link href="/templates/" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              All {TEMPLATE_CATALOG.length} <ArrowRight className="size-4" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {teaser.length
            ? teaser.map((t) => <TemplateCard key={t.id} template={t} subtitle={t.description} />)
            : Array.from({ length: 10 }, (_, i) => <TemplateCardSkeleton key={i} />)}
        </div>
      </section>

      <section aria-labelledby="layouts" className="mb-14">
        <SectionHeader id="layouts" eyebrow="Layouts" title="Trending layouts" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {pack.layouts.map((l) => {
            const template = templates.get(l.templateId);
            return template ? (
              <TemplateCard key={l.id} template={template} title={l.name} subtitle={l.description} heat={l.heat} />
            ) : (
              <TemplateCardSkeleton key={l.id} />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="formats" className="mb-14">
        <SectionHeader id="formats" eyebrow="Formats" title="Carousel styles & meme formats" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {pack.formats.map((f) => {
            const template = templates.get(f.templateId);
            return (
              <div key={f.id}>
                {template ? (
                  <TemplateCard template={template} title={f.name} subtitle={`${f.kind} — ${f.description}`} />
                ) : (
                  <TemplateCardSkeleton />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="type" className="mb-14">
        <SectionHeader
          id="type"
          eyebrow="Typography"
          title="Font pairings people are saving"
          description="Tap one to type your own words and start a post with it."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pack.typography.map((t) => (
            <TypeCard key={t.id} typo={t} />
          ))}
        </div>
      </section>

      <section aria-labelledby="palettes" className="mb-14">
        <SectionHeader id="palettes" eyebrow="Colour" title="Palettes" description="Tap a swatch to copy its HEX code." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pack.palettes.map((p) => (
            <PaletteCard key={p.id} palette={p} />
          ))}
        </div>
      </section>

      <section aria-labelledby="effects" className="mb-14">
        <SectionHeader
          id="effects"
          eyebrow="Effects"
          title="Looks of the month"
          description="Rendered with the editor’s own filters. Select a photo and open Filters (F) to use them — hold a card to compare."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pack.effects.map((e) => (
            <EffectCard key={e.id} effect={e} />
          ))}
        </div>
      </section>

      <section aria-labelledby="stickers" className="mb-14">
        <SectionHeader id="stickers" eyebrow="Stickers" title="Sticker drop" description="Tap to save a transparent PNG." />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {pack.stickers.map((s) => (
            <StickerTile key={s} stickerId={s} />
          ))}
        </div>
      </section>

      <section aria-labelledby="inspiration-title" id="inspiration" className="scroll-mt-24">
        <SectionHeader
          id="inspiration-title"
          eyebrow="Inspiration"
          title="Remix feed"
          description="Our templates re-coloured with this month’s palettes."
        />
        <InspirationFeed />
      </section>
    </>
  );
}
