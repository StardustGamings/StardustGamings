'use client';

import Link from 'next/link';
import { ArrowRight, Flame, Lightbulb } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DesignDocument } from '@/types/document';
import { ScenePreview } from '@/canvas/ScenePreview';
import { useTrendLooks, useTrends } from '@/trends/store';
import { findLook, resolveStyle } from '@/trends/pack';
import { restyleDocument, styleKit, type RestyleParts } from '@/trends/restyle';
import { suggestTrends, type Suggestion } from '@/trends/suggest';
import type { TrendPack, TrendStyle } from '@/trends/schema';
import { stickerName } from '@/stickers/library';
import { fontStack } from '@/typography/fonts';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { specStyle } from '@/components/discover/TypeCard';
import { useTypographyReady } from '@/components/discover/KitCard';
import { autoAnimateSlides } from '../animation-actions';
import * as trend from '../trend-actions';
import { selectDoc, useEditor } from '../store';
import { Section } from './fields';

const PARTS: { key: keyof RestyleParts; label: string }[] = [
  { key: 'colors', label: 'Colours' },
  { key: 'fonts', label: 'Fonts' },
  { key: 'look', label: 'Filter' },
  { key: 'motion', label: 'Motion' },
];

function stickerDoc(ref: string): DesignDocument {
  return {
    version: 1,
    slideWidth: 100,
    slideHeight: 100,
    background: { type: 'solid', color: 'rgba(0,0,0,0)' },
    slides: [{ id: 's', fill: null }],
    elements: [{ id: 'st', type: 'sticker', stickerId: ref, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 }],
  };
}

/** The design, restyled with a kit, shown on the slide being edited. */
function KitRow({
  pack,
  style,
  parts,
  doc,
  slide,
}: {
  pack: TrendPack;
  style: TrendStyle;
  parts: RestyleParts;
  doc: DesignDocument;
  slide: number;
}) {
  const ready = useTypographyReady(pack, style);
  const preview = useMemo(
    () => (ready ? restyleDocument(doc, styleKit(pack, style), { ...parts, motion: false }) : null),
    [ready, doc, pack, style, parts],
  );
  const { palette } = resolveStyle(pack, style);
  const [busy, setBusy] = useState(false);
  const aspect = doc.slideWidth / doc.slideHeight;
  return (
    <div className="flex gap-3 rounded-lg border border-line p-2" data-testid="kit-row">
      <div className="w-20 shrink-0 overflow-hidden rounded-md bg-bg-sunken" style={{ aspectRatio: aspect }}>
        {preview && <ScenePreview doc={preview} slide={slide} maxDpr={1.5} label={`This design as ${style.name}`} />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-[13px] font-bold">{style.name}</p>
        <p className="line-clamp-2 text-[11.5px] leading-snug text-fg-subtle">{style.description}</p>
        <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
          {palette.colors.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        <Button
          size="sm"
          variant="primary"
          className="mt-auto self-start"
          loading={busy}
          aria-label={`Restyle as ${style.name}`}
          data-testid="kit-apply"
          onClick={async () => {
            setBusy(true);
            await trend.applyKit(style, parts);
            setBusy(false);
          }}
        >
          Restyle
        </Button>
      </div>
    </div>
  );
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      switch (s.kind) {
        case 'kit':
          await trend.applyKit(s.style, {});
          break;
        case 'look':
          trend.applyTrendLook(s.look, s.intensity);
          break;
        case 'fonts':
          await trend.applyTrendFonts(s.typography);
          break;
        case 'motion':
          autoAnimateSlides('all', s.vibe);
          break;
        case 'dump':
          trend.startTrendDump(s.ruleId);
          break;
        case 'format':
          trend.openTrendFormat(s.templateId);
          break;
      }
    } finally {
      setBusy(false);
    }
  };
  const label = s.kind === 'dump' ? 'Pick photos' : s.kind === 'format' ? 'Preview' : 'Apply';
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface p-3" data-testid="trend-suggestion">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold">{s.title}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-fg-subtle">{s.detail}</p>
      </div>
      <Button size="sm" loading={busy} onClick={() => void run()} aria-label={`${label}: ${s.title}`}>
        {label}
      </Button>
    </div>
  );
}

/**
 * The editor's Trends tool (R): ideas from the current trend drop for the
 * design that's open — a kit that restyles everything, or one part at a time.
 */
export function TrendsPanel() {
  const doc = useEditor(selectDoc);
  const slide = useEditor((s) => s.activeSlide);
  const pack = useTrends((s) => s.pack);
  const looks = useTrendLooks();
  const [parts, setParts] = useState<Required<RestyleParts>>({ colors: true, fonts: true, look: true, motion: true });
  const suggestions = useMemo(() => (doc ? suggestTrends(doc, pack) : []), [doc, pack]);
  const kits = useMemo(() => [...pack.styles].sort((a, b) => b.heat - a.heat), [pack]);
  // The drop's own filters, then built-in looks its effects point at.
  const filters = useMemo(() => {
    const out = [...looks];
    for (const e of pack.effects) {
      const look = findLook(pack, e.look);
      if (look && !out.some((l) => l.id === look.id)) out.push(look);
    }
    return out;
  }, [looks, pack]);
  const stickerDocs = useMemo(() => new Map(pack.stickers.map((ref) => [ref, stickerDoc(ref)])), [pack]);

  if (!doc) return null;
  return (
    <div data-testid="trends-panel">
      <div className="flex items-center gap-2 px-4 pt-4">
        <Flame className="size-4 text-accent-text" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{pack.title}</p>
        <Link href="/discover/" className="inline-flex items-center gap-1 text-[12px] font-semibold text-fg-muted hover:text-fg">
          Discover <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {suggestions.length > 0 && (
        <Section title="Suggested for this design">
          {suggestions.map((s) => (
            <SuggestionCard key={s.key} s={s} />
          ))}
        </Section>
      )}

      {kits.length > 0 && (
        <Section title="Restyle with a kit">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="What a kit changes">
            {PARTS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={parts[p.key]}
                onClick={() => setParts((cur) => ({ ...cur, [p.key]: !cur[p.key] }))}
                className={cn(
                  'h-7 rounded-sm border px-2.5 text-[11.5px] font-semibold transition-colors',
                  parts[p.key] ? 'border-line-strong bg-surface-active text-fg' : 'border-line text-fg-muted hover:text-fg',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {kits.map((k) => (
            <KitRow key={`${pack.id}-${k.id}`} pack={pack} style={k} parts={parts} doc={doc} slide={slide} />
          ))}
        </Section>
      )}

      <Section title="Palettes">
        <div className="grid grid-cols-2 gap-2">
          {pack.palettes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => trend.applyTrendPalette(p.name, p.colors)}
              className="group flex flex-col gap-1 text-left"
              aria-label={`Recolour with ${p.name}`}
            >
              <span className="flex h-8 overflow-hidden rounded-md border border-line transition-transform group-hover:scale-[1.03]">
                {p.colors.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="truncate text-[11.5px] font-semibold text-fg-muted group-hover:text-fg">{p.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Fonts">
        {pack.typography.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => void trend.applyTrendFonts(t)}
            className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-line-strong"
            aria-label={`Set text in ${t.name}: ${t.heading.family} and ${t.body.family}`}
          >
            <span className="truncate text-[22px] leading-tight" style={specStyle(t.heading)}>
              {t.sample}
            </span>
            <span className="shrink-0 text-[10.5px] text-fg-subtle" style={{ fontFamily: fontStack(t.body.family) }}>
              {t.vibe}
            </span>
          </button>
        ))}
      </Section>

      {filters.length > 0 && (
        <Section title="Filters">
          <p className="text-[11.5px] text-fg-subtle">Puts the filter on every photo in the design.</p>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => trend.applyTrendLook(l)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-[12px] font-semibold transition-colors hover:border-accent"
              >
                <span
                  className="size-3 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${l.swatch[0]}, ${l.swatch[1]})` }}
                />
                {l.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {pack.stickers.length > 0 && (
        <Section title="Stickers">
          <div className="grid grid-cols-4 gap-2">
            {pack.stickers.map((ref) => (
              <button
                key={ref}
                type="button"
                aria-label={`Add ${stickerName(ref)} sticker`}
                onClick={() => trend.addTrendSticker(ref)}
                className="flex aspect-square items-center justify-center rounded-lg border border-line bg-[#8f8ba3] p-2 transition-colors hover:border-fg-subtle"
              >
                <ScenePreview doc={stickerDocs.get(ref)!} className="w-full" maxDpr={2} />
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
