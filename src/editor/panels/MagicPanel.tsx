'use client';

import Link from 'next/link';
import { Check, Copy, Cpu, Dices, Images, Maximize2, Plus, Server, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DesignDocument } from '@/types/document';
import { ScenePreview } from '@/canvas/ScenePreview';
import { createDocument } from '@/projects/document';
import { derivePalette } from '@/templates/describe';
import { applyConcept } from '@/ai/backgrounds';
import { captionToText } from '@/ai/captions';
import { aiServerHost } from '@/ai/cloud';
import { generatePalettes, paletteFromPhotos, paletteMood } from '@/ai/palettes';
import { RESIZE_TARGETS } from '@/ai/resize';
import { CAPTION_TONES, type BackgroundConcept, type CaptionResult, type CaptionTone, type FontPairing } from '@/ai/schemas';
import { aiServerEnabled, backgroundIdeas, pairFonts, writeCaptions, type AiSource } from '@/ai/service';
import { SIZE_PRESETS } from '@/projects/formats';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { fontStack, loadFont } from '@/typography/fonts';
import { normalizeHex } from '@/utils/color';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast-store';
import * as ai from '../ai-actions';
import { selectDoc, useEditor } from '../store';
import { Section } from './fields';

const TONE_LABELS: Record<CaptionTone, string> = {
  casual: 'Casual',
  hype: 'Hype',
  minimal: 'Minimal',
  witty: 'Witty',
  aesthetic: 'Aesthetic',
  professional: 'Pro',
};

function SourceBadge({ source }: { source: AiSource }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-fg-subtle" data-testid="ai-source">
      {source === 'server' ? <Server className="size-3" /> : <Cpu className="size-3" />}
      {source === 'server' ? 'AI server' : 'On this device'}
    </span>
  );
}

function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors',
            value === o.value ? 'border-transparent bg-fg text-bg' : 'border-line text-fg-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${what} copied`, tone: 'success', duration: 1800 });
  } catch {
    toast({ title: 'Clipboard blocked', description: 'Select the text and copy it instead.', tone: 'info' });
  }
}

/* ───────────── Caption ───────────── */

function CaptionSection({ doc, format }: { doc: DesignDocument; format: string }) {
  const [tone, setTone] = useState<CaptionTone>('casual');
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ result: CaptionResult; source: AiSource } | null>(null);
  const run = async (nextSeed = seed) => {
    setBusy(true);
    const request = {
      texts: ai.designTexts(doc),
      format,
      slides: doc.slides.length,
      tone,
      mood: paletteMood(derivePalette(doc)),
    };
    const a = await writeCaptions(request, nextSeed);
    if (a.notice) toast({ title: a.notice, tone: 'info', duration: 3000 });
    setAnswer(a);
    setBusy(false);
  };
  return (
    <Section title="Caption" action={answer ? <SourceBadge source={answer.source} /> : undefined}>
      <p className="text-[12px] text-fg-muted">Captions and hashtags written from the words in your design.</p>
      <Chips
        value={tone}
        onChange={setTone}
        label="Caption tone"
        options={CAPTION_TONES.map((t) => ({ value: t, label: TONE_LABELS[t] }))}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={busy}
          icon={<Sparkles className="size-4" />}
          onClick={() => void run()}
          data-testid="caption-write"
        >
          Write captions
        </Button>
        {answer && (
          <Button
            size="sm"
            icon={<Dices className="size-4" />}
            onClick={() => {
              setSeed(seed + 1);
              void run(seed + 1);
            }}
          >
            More ideas
          </Button>
        )}
      </div>
      {answer?.result.captions.map((c, i) => (
        <div key={`${i}-${c.text}`} className="rounded-[12px] border border-line bg-surface p-3" data-testid="caption-card">
          <p className="text-[13px] leading-snug whitespace-pre-wrap">{c.text}</p>
          {c.hashtags.length > 0 && <p className="mt-1.5 text-[12px] leading-snug text-accent-text">{c.hashtags.join(' ')}</p>}
          <div className="mt-2 flex items-center gap-1.5">
            <Button
              size="sm"
              icon={<Copy className="size-3.5" />}
              onClick={() => void copy(captionToText(c), 'Caption')}
              aria-label={`Copy caption ${i + 1}`}
            >
              Copy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus className="size-3.5" />}
              onClick={() => ai.addCaptionText(c.text)}
              aria-label={`Add caption ${i + 1} to the design`}
            >
              Add as text
            </Button>
            <span className="ml-auto font-mono text-[10.5px] text-fg-subtle tabular-nums">{captionToText(c).length}/2200</span>
          </div>
        </div>
      ))}
    </Section>
  );
}

/* ───────────── Palette ───────────── */

function PaletteSection({ doc }: { doc: DesignDocument }) {
  const photoPalette = useMemo(() => paletteFromPhotos(ai.designPhotoPalettes(doc)), [doc]);
  const designColors = useMemo(() => derivePalette(doc, 6), [doc]);
  const [base, setBase] = useState<string | null>(null);
  const baseColor = base ?? photoPalette[0] ?? designColors.find((c) => c !== '#FFFFFF' && c !== '#000000') ?? '#7A5CFF';
  const generated = useMemo(() => generatePalettes(baseColor), [baseColor]);
  const all = [
    ...(photoPalette.length
      ? [
          {
            id: 'photos',
            name: 'From your photos',
            description: 'The colours in your photos, with a light and a dark for text.',
            colors: photoPalette,
          },
        ]
      : []),
    ...generated,
  ];
  return (
    <Section title="Colour palette">
      <div className="flex items-center gap-2">
        <label
          className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-line-strong"
          style={{ background: baseColor }}
        >
          <span className="sr-only">Base colour</span>
          <input
            type="color"
            value={normalizeHex(baseColor)?.slice(0, 7) ?? '#7A5CFF'}
            onChange={(e) => setBase(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <p className="text-[12px] text-fg-muted">
          Palettes built around <span className="font-mono">{baseColor}</span>
          {photoPalette.length ? ', from your photos' : ''}. Pick another base to explore.
        </p>
      </div>
      <div className="flex flex-col gap-2" data-testid="palette-list">
        {all.map((p) => (
          <div key={p.id} className="flex items-center gap-2" data-testid="palette-row">
            <button
              type="button"
              onClick={() => ai.applyPalette(p.name, p.colors)}
              className="group flex min-w-0 flex-1 flex-col gap-1 text-left"
              aria-label={`Recolour with ${p.name}`}
              title={p.description}
            >
              <span className="flex h-7 overflow-hidden rounded-[8px] border border-line transition-transform group-hover:scale-[1.02]">
                {p.colors.map((c, i) => (
                  <span key={`${c}-${i}`} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="truncate text-[11.5px] font-semibold text-fg-muted group-hover:text-fg">{p.name}</span>
            </button>
            <button
              type="button"
              aria-label={`Copy ${p.name} HEX codes`}
              onClick={() => void copy(p.colors.join(', '), `${p.name} colours`)}
              className="flex size-8 items-center justify-center rounded-[8px] text-fg-subtle hover:bg-surface-hover hover:text-fg"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────── Fonts ───────────── */

/** The headline's first few whole words, for a font sample that fits one line. */
function shortSample(text: string, max = 26): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  let out = words[0]!.slice(0, max);
  for (const w of words.slice(1)) {
    if (out.length + 1 + w.length > max) return `${out.replace(/[.,;:!?—–-]+$/u, '')}…`;
    out += ` ${w}`;
  }
  return out;
}

function PairingRow({ p, sample }: { p: FontPairing; sample: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([loadFont(p.heading, p.headingWeight, 'normal'), loadFont(p.body, p.bodyWeight, 'normal')]).then(
      () => alive && setReady(true),
    );
    return () => {
      alive = false;
    };
  }, [p]);
  return (
    <button
      type="button"
      onClick={() => void ai.applyPairing(p)}
      className="flex flex-col gap-1 rounded-[12px] border border-line px-3 py-2 text-left transition-colors hover:border-line-strong"
      aria-label={`Use ${p.heading} with ${p.body}`}
      data-testid="pairing-row"
    >
      <span
        className="truncate text-[20px] leading-tight transition-opacity"
        style={{ fontFamily: fontStack(p.heading), fontWeight: p.headingWeight, opacity: ready ? 1 : 0.7 }}
      >
        {sample}
      </span>
      <span className="text-[12px] text-fg-muted" style={{ fontFamily: fontStack(p.body), fontWeight: p.bodyWeight }}>
        {p.heading} + {p.body}
      </span>
      <span className="text-[11px] leading-snug text-fg-subtle">{p.reason}</span>
    </button>
  );
}

function FontSection({ doc }: { doc: DesignDocument }) {
  const [answer, setAnswer] = useState<{ result: FontPairing[]; source: AiSource } | null>(null);
  const [busy, setBusy] = useState(false);
  const headline = useMemo(() => ai.headlineElement(doc), [doc]);
  const run = async () => {
    setBusy(true);
    const a = await pairFonts({
      current: headline?.fontFamily,
      headline: headline?.text.slice(0, 120),
      vibe: paletteMood(derivePalette(doc)),
    });
    if (a.notice) toast({ title: a.notice, tone: 'info', duration: 3000 });
    setAnswer(a);
    setBusy(false);
  };
  const sample = headline ? shortSample(headline.text) : 'Create. Swipe. Flex.';
  return (
    <Section title="Font pairing" action={answer ? <SourceBadge source={answer.source} /> : undefined}>
      <p className="text-[12px] text-fg-muted">Heading + body combinations that work together — tap one to restyle all text.</p>
      <Button
        size="sm"
        loading={busy}
        icon={<Sparkles className="size-4" />}
        onClick={() => void run()}
        data-testid="fonts-suggest"
        className="self-start"
      >
        Suggest pairings
      </Button>
      {answer?.result.map((p) => (
        <PairingRow key={`${p.heading}+${p.body}`} p={p} sample={sample} />
      ))}
    </Section>
  );
}

/* ───────────── Background ───────────── */

function ConceptCard({ concept, doc }: { concept: BackgroundConcept; doc: DesignDocument }) {
  const preview = useMemo(() => {
    const base = createDocument({ width: doc.slideWidth, height: doc.slideHeight });
    return applyConcept(base, concept, 'all', 'pv-');
  }, [concept, doc.slideWidth, doc.slideHeight]);
  return (
    <div className="flex flex-col gap-1.5" data-testid="concept-card">
      <div
        className="overflow-hidden rounded-[10px] border border-line"
        style={{ aspectRatio: `${doc.slideWidth} / ${doc.slideHeight}` }}
      >
        <ScenePreview doc={preview} slide={0} maxDpr={1.5} label={concept.name} />
      </div>
      <p className="truncate text-[12px] font-semibold" title={concept.description}>
        {concept.name}
      </p>
      <div className="flex gap-1">
        <Button
          size="sm"
          className="flex-1 px-1"
          onClick={() => ai.applyBackground(concept, 'slide')}
          aria-label={`${concept.name} on this slide`}
        >
          This slide
        </Button>
        {doc.slides.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            className="px-1.5"
            onClick={() => ai.applyBackground(concept, 'all')}
            aria-label={`${concept.name} on every slide`}
          >
            All
          </Button>
        )}
      </div>
    </div>
  );
}

function BackgroundSection({ doc }: { doc: DesignDocument }) {
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ result: BackgroundConcept[]; source: AiSource } | null>(null);
  const run = async (nextSeed: number) => {
    setBusy(true);
    const photos = paletteFromPhotos(ai.designPhotoPalettes(doc));
    const palette = (photos.length ? photos : derivePalette(doc, 6)).slice(0, 8);
    const a = await backgroundIdeas(
      {
        palette: palette.length ? palette : ['#0B0A12', '#7A5CFF', '#C6FF3D', '#F4F1EA'],
        aspect: doc.slideWidth / doc.slideHeight,
        vibe: paletteMood(palette),
      },
      nextSeed,
    );
    if (a.notice) toast({ title: a.notice, tone: 'info', duration: 3000 });
    setAnswer(a);
    setBusy(false);
  };
  return (
    <Section title="Background ideas" action={answer ? <SourceBadge source={answer.source} /> : undefined}>
      <p className="text-[12px] text-fg-muted">
        Concepts in your design’s colours. They go behind everything, as editable shapes.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={busy}
          icon={<Sparkles className="size-4" />}
          onClick={() => void run(seed)}
          data-testid="backgrounds-suggest"
        >
          Suggest backgrounds
        </Button>
        {answer && (
          <Button
            size="sm"
            icon={<Dices className="size-4" />}
            onClick={() => {
              setSeed(seed + 1);
              void run(seed + 1);
            }}
          >
            More
          </Button>
        )}
      </div>
      {answer && (
        <div className="grid grid-cols-2 gap-3">
          {answer.result.map((c, i) => (
            <ConceptCard key={`${seed}-${i}-${c.name}`} concept={c} doc={doc} />
          ))}
        </div>
      )}
    </Section>
  );
}

/* ───────────── Panel ───────────── */

/**
 * The editor's AI tools (M). Everything runs on the device; when this site has
 * an AI server and it's turned on in Settings, captions, fonts and backgrounds
 * ask it first — the header says so, and says what is sent.
 */
export function MagicPanel() {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const cloud = useSettings((s) => s.privacy.cloudFeatures);
  const openResize = useUi((s) => s.openResize);
  const openPhotoFlow = useUi((s) => s.openPhotoFlow);
  if (!doc || !meta) return null;
  const server = cloud && aiServerEnabled();
  return (
    <div data-testid="magic-panel">
      <div className="flex items-start gap-2 px-4 pt-4 text-[12px] text-fg-muted" data-testid="ai-privacy-note">
        {server ? (
          <Server className="mt-0.5 size-4 shrink-0 text-violet" />
        ) : (
          <Check className="mt-0.5 size-4 shrink-0 text-success" />
        )}
        <p>
          {server
            ? `Captions, fonts and backgrounds ask the AI server (${aiServerHost()}) — it gets your design’s text and colours, never photos. Palettes and resize stay on this device.`
            : 'Every tool here runs on this device. Nothing is uploaded.'}{' '}
          <Link href="/settings/#ai" className="font-semibold underline-offset-2 hover:underline">
            AI settings
          </Link>
        </p>
      </div>

      <CaptionSection doc={doc} format={meta.format} />
      <PaletteSection doc={doc} />
      <FontSection doc={doc} />
      <BackgroundSection doc={doc} />

      <Section title="Resize">
        <p className="text-[12px] text-fg-muted">
          Adapt this design to another size — backgrounds fill, text re-wraps, collages re-arrange.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RESIZE_TARGETS.slice(0, 4).map((id) => (
            <Button
              key={id}
              size="sm"
              icon={<Maximize2 className="size-3.5" />}
              onClick={() => openResize(id)}
              aria-label={`Resize to ${SIZE_PRESETS[id].ratio}`}
            >
              {SIZE_PRESETS[id].ratio}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => openResize()}>
            More sizes…
          </Button>
        </div>
      </Section>

      <Section title="Photos → carousel">
        <p className="text-[12px] text-fg-muted">
          Pick photos and let <strong>Auto</strong> choose the cover, order and style from the photos themselves (measured on this
          device).
        </p>
        <Button
          size="sm"
          icon={<Images className="size-4" />}
          className="self-start"
          onClick={() => openPhotoFlow('dump', 'current')}
        >
          Make a photo dump
        </Button>
      </Section>
    </div>
  );
}
