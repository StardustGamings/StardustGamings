'use client';

import { motion } from 'motion/react';
import { Minus, Plus, Ruler } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Fill } from '@/types/document';
import type { FormatId, SizePresetId } from '@/types/project';
import { CUSTOM_SIZE_LIMITS, FORMAT_ORDER, FORMATS, MAX_SLIDES, SIZE_PRESETS, ratioLabel } from '@/projects/formats';
import { fillToCss } from '@/canvas/render';
import { ScenePreview } from '@/canvas/ScenePreview';
import { templatesForFormat } from '@/templates/registry';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { TextField } from '@/components/ui/TextField';
import { FormatIcon } from '@/components/home/FormatIcon';
import { cn } from '@/utils/cn';
import { clamp } from '@/utils/math';
import { useCreateFromTemplate, useCreateProject } from './useCreateProject';

const BACKGROUNDS: { id: string; label: string; fill: Fill }[] = [
  { id: 'paper', label: 'Paper', fill: { type: 'solid', color: '#F4F1EA' } },
  { id: 'white', label: 'White', fill: { type: 'solid', color: '#FFFFFF' } },
  { id: 'ink', label: 'Ink', fill: { type: 'solid', color: '#0B0A12' } },
  { id: 'lime', label: 'Acid lime', fill: { type: 'solid', color: '#C6FF3D' } },
  { id: 'lilac', label: 'Lilac', fill: { type: 'solid', color: '#E4DAFF' } },
  {
    id: 'haze',
    label: 'Sunday haze',
    fill: {
      type: 'linear',
      angle: 180,
      stops: [
        { offset: 0, color: '#E9DFFF' },
        { offset: 1, color: '#FFE3D3' },
      ],
    },
  },
  {
    id: 'nova',
    label: 'Nova',
    fill: {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#C6FF3D' },
        { offset: 0.5, color: '#3CF0C8' },
        { offset: 1, color: '#A06BFF' },
      ],
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    fill: {
      type: 'radial',
      cx: 0.5,
      cy: 0.3,
      radius: 0.9,
      stops: [
        { offset: 0, color: '#3A1D8F' },
        { offset: 1, color: '#07070B' },
      ],
    },
  },
];

function SizeGlyph({ width, height, active }: { width: number; height: number; active: boolean }) {
  const max = 34;
  const s = max / Math.max(width, height);
  return (
    <span className="flex size-10 items-center justify-center" aria-hidden>
      <span
        className={cn('rounded-[4px] border-2 transition-colors', active ? 'border-accent bg-accent/25' : 'border-fg-subtle')}
        style={{ width: width * s, height: height * s }}
      />
    </span>
  );
}

function parseDimension(value: string): number | null {
  if (!/^\d{2,4}$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= CUSTOM_SIZE_LIMITS.min && n <= CUSTOM_SIZE_LIMITS.max ? n : null;
}

export function NewProjectDialog() {
  const request = useUi((s) => s.newProject);
  const close = useUi((s) => s.closeNewProject);
  const carouselDefault = useSettings((s) => s.editor.carouselSlides);
  const createProject = useCreateProject();
  const createFromTemplate = useCreateFromTemplate();

  const [format, setFormat] = useState<FormatId>('carousel');
  const [sizeId, setSizeId] = useState<SizePresetId>('ig-portrait');
  const [customW, setCustomW] = useState('1080');
  const [customH, setCustomH] = useState('1350');
  const [slides, setSlides] = useState(5);
  const [name, setName] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0]!.id);
  const [busy, setBusy] = useState(false);

  const def = FORMATS[format];

  // Reset the form whenever the dialog opens for a (possibly different) format.
  const [lastRequest, setLastRequest] = useState(request);
  if (request !== lastRequest) {
    setLastRequest(request);
    if (request) {
      const f = FORMATS[request.format];
      setFormat(request.format);
      setSizeId(f.sizeId);
      setSlides(request.format === 'carousel' ? carouselDefault : f.slideCount);
      setName('');
      setBusy(false);
    }
  }

  const selectFormat = (id: FormatId) => {
    setFormat(id);
    setSizeId(FORMATS[id].sizeId);
    setSlides(id === 'carousel' ? carouselDefault : FORMATS[id].slideCount);
  };

  const customW_ = parseDimension(customW);
  const customH_ = parseDimension(customH);
  const customInvalid = sizeId === 'custom' && (!customW_ || !customH_);
  const templates = useMemo(() => templatesForFormat(format), [format]);

  const submit = async () => {
    if (customInvalid || busy) return;
    setBusy(true);
    const meta = await createProject({
      name,
      format,
      sizeId,
      customSize: sizeId === 'custom' ? { width: customW_!, height: customH_! } : undefined,
      slideCount: def.multiSlide ? slides : 1,
      background: BACKGROUNDS.find((b) => b.id === background)!.fill,
    });
    if (meta) close();
    else setBusy(false);
  };

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && close()}
      title="Start something new"
      description="Pick a format — you can change size, slides and background later."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            magnetic
            loading={busy}
            disabled={customInvalid}
            onClick={submit}
            data-testid="create-project"
          >
            Create {def.label.toLowerCase()}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset>
          <legend className="mb-2.5 text-[13px] font-semibold">Format</legend>
          <div className="-mx-6 hide-scrollbar flex gap-2 overflow-x-auto px-6 pb-1" role="radiogroup" aria-label="Format">
            {FORMAT_ORDER.map((id) => {
              const active = id === format;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectFormat(id)}
                  className={cn(
                    'relative flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
                    active
                      ? 'border-transparent text-accent-fg'
                      : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="format-pill"
                      className="absolute inset-0 -z-0 rounded-full bg-accent"
                      transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                    />
                  )}
                  <FormatIcon format={id} className="relative size-4" />
                  <span className="relative">{FORMATS[id].label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2.5 text-[13px] font-semibold">Size</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Canvas size">
            {[...def.sizes, 'custom' as const].map((id) => {
              const active = id === sizeId;
              const preset = id === 'custom' ? null : SIZE_PRESETS[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSizeId(id)}
                  className={cn(
                    'flex items-center gap-2 rounded-[16px] border p-2 pr-3 text-left transition-colors',
                    active ? 'border-accent bg-accent/8' : 'border-line hover:border-line-strong hover:bg-surface-hover',
                  )}
                >
                  {preset ? (
                    <SizeGlyph width={preset.width} height={preset.height} active={active} />
                  ) : (
                    <span className="flex size-10 items-center justify-center text-fg-muted">
                      <Ruler className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{preset ? preset.label : 'Custom'}</span>
                    <span className="block truncate text-[11.5px] text-fg-subtle">
                      {preset ? `${preset.ratio} · ${preset.width}×${preset.height}` : 'Any size up to 8000px'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {sizeId === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <TextField
                label="Width (px)"
                inputMode="numeric"
                value={customW}
                onChange={(e) => setCustomW(e.target.value.replace(/\D/g, '').slice(0, 4))}
                error={customW_ ? undefined : `${CUSTOM_SIZE_LIMITS.min}–${CUSTOM_SIZE_LIMITS.max}px`}
              />
              <TextField
                label="Height (px)"
                inputMode="numeric"
                value={customH}
                onChange={(e) => setCustomH(e.target.value.replace(/\D/g, '').slice(0, 4))}
                error={customH_ ? undefined : `${CUSTOM_SIZE_LIMITS.min}–${CUSTOM_SIZE_LIMITS.max}px`}
                hint={customW_ && customH_ ? `Ratio ${ratioLabel(customW_, customH_)}` : undefined}
              />
            </div>
          )}
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          {def.multiSlide && (
            <div>
              <p id="slides-label" className="mb-2.5 text-[13px] font-semibold">
                Slides
              </p>
              <div className="flex items-center gap-3">
                <IconButton
                  label="Fewer slides"
                  icon={<Minus />}
                  variant="solid"
                  disabled={slides <= 1}
                  onClick={() => setSlides((n) => clamp(n - 1, 1, MAX_SLIDES))}
                />
                <output
                  aria-labelledby="slides-label"
                  aria-live="polite"
                  className="w-10 text-center font-display text-2xl font-bold tabular-nums"
                >
                  {slides}
                </output>
                <IconButton
                  label="More slides"
                  icon={<Plus />}
                  variant="solid"
                  disabled={slides >= MAX_SLIDES}
                  onClick={() => setSlides((n) => clamp(n + 1, 1, MAX_SLIDES))}
                />
                <div className="ml-1 flex flex-wrap gap-1" aria-hidden>
                  {Array.from({ length: Math.min(slides, 12) }, (_, i) => (
                    <motion.span
                      key={i}
                      layout
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-5 w-4 rounded-[4px] bg-gradient-to-b from-accent to-mint"
                    />
                  ))}
                  {slides > 12 && <span className="text-xs text-fg-subtle">+{slides - 12}</span>}
                </div>
              </div>
            </div>
          )}
          <div className={cn(!def.multiSlide && 'sm:col-span-2')}>
            <p className="mb-2.5 text-[13px] font-semibold">Background</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Background">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={background === b.id}
                  aria-label={b.label}
                  title={b.label}
                  onClick={() => setBackground(b.id)}
                  className={cn(
                    'size-9 rounded-full border border-line-strong transition-transform hover:scale-110',
                    background === b.id && 'ring-2 ring-ring ring-offset-2 ring-offset-bg-elevated',
                  )}
                  style={{ background: fillToCss(b.fill) }}
                />
              ))}
            </div>
          </div>
        </div>

        <TextField
          label="Name"
          placeholder={`${def.label} · untitled`}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          hint="Optional — rename any time."
        />

        {templates.length > 0 && (
          <div>
            <p className="mb-2.5 text-[13px] font-semibold">Or start from a template</p>
            <div className="-mx-6 hide-scrollbar flex gap-3 overflow-x-auto px-6 pb-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const meta = await createFromTemplate(t);
                    if (meta) close();
                    else setBusy(false);
                  }}
                  className="group w-32 shrink-0 text-left"
                >
                  <span className="block overflow-hidden rounded-[14px] border border-line transition-transform duration-300 group-hover:-translate-y-1">
                    <ScenePreview doc={t.doc} slide={0} maxDpr={1.5} />
                  </span>
                  <span className="mt-1.5 block truncate text-xs font-semibold">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
