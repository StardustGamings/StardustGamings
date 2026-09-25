'use client';

import { useMemo, useState } from 'react';
import type { FormatId } from '@/types/project';
import { FORMAT_ORDER, FORMATS } from '@/projects/formats';
import { getTemplate, TEMPLATES } from '@/templates/registry';
import { useTrends } from '@/trends/store';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/home/SectionHeader';
import { cn } from '@/utils/cn';
import { EffectCard } from './EffectCard';
import { InspirationFeed } from './InspirationFeed';
import { PaletteCard } from './PaletteCard';
import { StickerTile } from './StickerTile';
import { TemplateCard } from './TemplateCard';
import { TypeCard } from './TypeCard';

export function DiscoverView() {
  const pack = useTrends((s) => s.pack);
  const [format, setFormat] = useState<FormatId | 'all'>('all');
  const templates = useMemo(() => (format === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.format === format)), [format]);
  const formatsWithTemplates = FORMAT_ORDER.filter((f) => TEMPLATES.some((t) => t.format === f));

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
        />
        <div
          className="-mx-4 mb-6 hide-scrollbar flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          role="group"
          aria-label="Filter templates by format"
        >
          {(['all', ...formatsWithTemplates] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
                format === f ? 'border-transparent bg-fg text-bg' : 'border-line text-fg-muted hover:text-fg',
              )}
            >
              {f === 'all' ? `All · ${TEMPLATES.length}` : FORMATS[f].label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} subtitle={t.description} />
          ))}
        </div>
      </section>

      <section aria-labelledby="layouts" className="mb-14">
        <SectionHeader id="layouts" eyebrow="Layouts" title="Trending layouts" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {pack.layouts.map((l) => (
            <TemplateCard
              key={l.id}
              template={getTemplate(l.templateId)!}
              title={l.name}
              subtitle={l.description}
              heat={l.heat}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="formats" className="mb-14">
        <SectionHeader id="formats" eyebrow="Formats" title="Carousel styles & meme formats" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {pack.formats.map((f) => (
            <div key={f.id}>
              <TemplateCard template={getTemplate(f.templateId)!} title={f.name} subtitle={`${f.kind} — ${f.description}`} />
            </div>
          ))}
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
          description="Live previews. Applying them to your photos arrives with the photo editor."
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
