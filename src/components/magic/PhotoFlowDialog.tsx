'use client';

import { ArrowLeft, Dices, Sparkles } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import type { CollageFamily, DesignDocument } from '@/types/document';
import type { AssetMeta } from '@/assets/types';
import type { SizePresetId } from '@/types/project';
import { useAssets } from '@/assets/store';
import { createDocument } from '@/projects/document';
import { FORMATS, SIZE_PRESETS } from '@/projects/formats';
import { createCollage, createPanorama } from '@/layouts/apply';
import { defaultCollageParams, FAMILY_LABELS, moodParams, type CollageMood } from '@/layouts/collage';
import { generatePhotoDump, paletteTint } from '@/layouts/dump';
import { DUMP_MAX_PHOTOS, DUMP_MIN_PHOTOS, DUMP_STYLES, getDumpStyle } from '@/layouts/dump-styles';
import { suggestedSlides, type PanoramaParams } from '@/layouts/panorama';
import { useUi, type PhotoFlowRequest } from '@/settings/ui-store';
import { useTrends } from '@/trends/store';
import { loadAsset } from '@/assets/cache';
import { measureImage, toFacts } from '@/ai/layout';
import { planLayout, type AiSource } from '@/ai/service';
import { toast } from '@/components/ui/toast-store';
import { ruleToDumpStyle } from '@/trends/pack';
import { useEditor } from '@/editor/store';
import { addCollage, addPanorama, addPhotoDump, newSeed, toPhotoRef } from '@/editor/layout-actions';
import { useCreateProject } from '@/components/projects/useCreateProject';
import { CarouselPreview } from '@/components/carousel/CarouselPreview';
import { ScenePreview } from '@/canvas/ScenePreview';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { TextField } from '@/components/ui/TextField';
import { cn } from '@/utils/cn';
import { PhotoChooser } from './PhotoChooser';

const LIMITS = {
  dump: { min: DUMP_MIN_PHOTOS, max: DUMP_MAX_PHOTOS },
  seamless: { min: 1, max: 10 },
  collage: { min: 2, max: 20 },
} as const;

const COPY = {
  dump: {
    title: 'Smart photo dump',
    pick: `Pick ${DUMP_MIN_PHOTOS}–${DUMP_MAX_PHOTOS} photos (5+ looks best) — in the order you want them.`,
    create: 'Create carousel',
    add: 'Add slides',
  },
  seamless: {
    title: 'Seamless swipe',
    pick: 'Pick 1 wide photo, or up to 10 photos to flow across your slides.',
    create: 'Create carousel',
    add: 'Add to carousel',
  },
  collage: { title: 'Collage maker', pick: 'Pick 2–20 photos.', create: 'Create collage', add: 'Add collage' },
} as const;

const MOODS: { id: CollageMood; label: string }[] = [
  { id: 'chaotic', label: 'More chaotic' },
  { id: 'minimal', label: 'More minimal' },
  { id: 'aesthetic', label: 'More aesthetic' },
  { id: 'editorial', label: 'More editorial' },
  { id: 'genz', label: 'More Gen-Z' },
];

/** "Clean" → "Clean dump"; a style already called a dump keeps its name. */
const dumpName = (style: string) => (/\bdump$/i.test(style) ? style : `${style} dump`);

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-label">{children}</p>;
}

function FlowBody({ flow, onClose }: { flow: PhotoFlowRequest; onClose: () => void }) {
  const all = useAssets((s) => s.assets);
  const editorDoc = useEditor((s) => s.history?.present ?? null);
  const createProject = useCreateProject();
  const [step, setStep] = useState<'photos' | 'style'>('photos');
  const [selected, setSelected] = useState<string[]>([]);
  const [seed, setSeed] = useState(newSeed);
  const [styleId, setStyleId] = useState(flow.styleId ?? DUMP_STYLES[0]!.id);
  const trendRules = useTrends((s) => s.pack.layoutRules);
  const dropTitle = useTrends((s) => s.pack.title);
  const trendStyles = useMemo(() => trendRules.map(ruleToDumpStyle), [trendRules]);
  const [auto, setAuto] = useState<{ reason: string; source: AiSource } | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [family, setFamily] = useState<CollageFamily>(flow.family ?? 'bento');
  const [collage, setCollage] = useState(() => defaultCollageParams(flow.family ?? 'bento', 0));
  const [pano, setPano] = useState<Omit<PanoramaParams, 'slides'>>({ spacing: 0.04, margin: 0.08, align: 'center' });
  const [slides, setSlides] = useState<number | null>(null);
  const [sizeId, setSizeId] = useState<SizePresetId>(flow.mode === 'collage' ? 'ig-square' : 'ig-portrait');
  const [busy, setBusy] = useState(false);

  const { mode, target } = flow;
  const limits = LIMITS[mode];
  const copy = COPY[mode];
  const assets = useMemo(
    () => selected.map((id) => all.find((a) => a.id === id)).filter((a): a is AssetMeta => Boolean(a)),
    [selected, all],
  );
  const preset = SIZE_PRESETS[sizeId as keyof typeof SIZE_PRESETS];
  const useDoc = target === 'current' && editorDoc;
  const sizeW = useDoc ? editorDoc.slideWidth : (preset?.width ?? 1080);
  const sizeH = useDoc ? editorDoc.slideHeight : (preset?.height ?? 1350);
  const size = useMemo(() => ({ width: sizeW, height: sizeH }), [sizeW, sizeH]);
  const refs = useMemo(() => assets.map(toPhotoRef), [assets]);
  const autoSlides = useMemo(() => suggestedSlides(refs, size, pano), [refs, size, pano]);
  const slideCount = slides ?? autoSlides;

  const preview: DesignDocument | null = useMemo(() => {
    if (step !== 'style' || refs.length < limits.min) return null;
    if (mode === 'dump') {
      return generatePhotoDump({ photos: refs, style: getDumpStyle(styleId), ...size, seed, title });
    }
    if (mode === 'seamless') {
      const base = createDocument({
        ...size,
        slideCount: slideCount,
        background: { type: 'solid', color: paletteTint(refs, 'light') },
      });
      return createPanorama(base, { startSlide: 0, photos: refs, params: { ...pano, slides: slideCount }, seed }).doc;
    }
    const base = createDocument({ ...size, slideCount: 1, background: { type: 'solid', color: paletteTint(refs, 'light') } });
    return createCollage(base, { slide: 0, family, seed, photos: refs, dims: () => null, overrides: collage }).doc;
  }, [step, refs, limits.min, mode, styleId, size.width, size.height, seed, title, slideCount, pano, family, collage]); // eslint-disable-line react-hooks/exhaustive-deps

  /** AI layout: measure the photos on this device, then let the plan pick order, cover, style and title. */
  const runAuto = async () => {
    setAutoBusy(true);
    try {
      const measured = [];
      for (const a of assets) {
        const loaded = await loadAsset(a.id, 'thumb');
        const facts = loaded ? measureImage(loaded.image) : null;
        measured.push({
          ...(facts ?? {
            brightness: 0.5,
            saturation: 0.3,
            warmth: 0,
            sharpness: 0.5,
            hash: BigInt(assets.indexOf(a) + 1) * 0x9e3779b97f4an,
            mean: [128, 128, 128] as [number, number, number],
          }),
          width: a.width,
          height: a.height,
          palette: a.palette,
        });
      }
      const styles = [...DUMP_STYLES, ...trendStyles].map((s) => ({ id: s.id, name: s.name, blurb: s.blurb }));
      const answer = await planLayout({ photos: toFacts(measured), styles });
      const plan = answer.result;
      const ordered = plan.order.map((i) => assets[i]!.id);
      // Keep enough photos for a dump even if near-duplicates were left out.
      const rest = assets.map((a) => a.id).filter((id) => !ordered.includes(id));
      setSelected(ordered.length >= limits.min ? ordered : [...ordered, ...rest].slice(0, Math.max(limits.min, ordered.length)));
      setStyleId(plan.styleId);
      setTitle(plan.title);
      setAuto({ reason: plan.reason, source: answer.source });
      if (answer.notice) toast({ title: answer.notice, tone: 'info', duration: 3000 });
    } finally {
      setAutoBusy(false);
    }
  };

  const create = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      if (target === 'current') {
        if (mode === 'dump') addPhotoDump(assets, styleId, seed, title);
        else if (mode === 'seamless') addPanorama(assets, { ...pano, slides: slideCount });
        else addCollage(assets, family, seed, collage);
        onClose();
        return;
      }
      const format = mode === 'collage' ? 'collage' : 'carousel';
      const name =
        mode === 'dump'
          ? dumpName(getDumpStyle(styleId).name)
          : mode === 'seamless'
            ? 'Seamless swipe'
            : `${FAMILY_LABELS[family]} collage`;
      const meta = await createProject({ name, format, sizeId, doc: preview });
      if (meta) onClose();
    } finally {
      setBusy(false);
    }
  };

  const sizes = mode === 'collage' ? FORMATS.collage.sizes : (['ig-portrait', 'ig-square', 'story'] as const);
  const ready = selected.length >= limits.min;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={copy.title}
      description={step === 'photos' ? copy.pick : 'Tweak it until it feels right — everything stays editable.'}
      footer={
        <>
          {step === 'style' ? (
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setStep('photos')}>
              Photos
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          {step === 'photos' ? (
            <Button variant="primary" disabled={!ready} onClick={() => setStep('style')} data-testid="flow-next">
              {ready ? `Next · ${selected.length} photo${selected.length === 1 ? '' : 's'}` : `Pick at least ${limits.min}`}
            </Button>
          ) : (
            <Button variant="primary" loading={busy} onClick={() => void create()} data-testid="flow-create">
              {target === 'current' ? copy.add : copy.create}
            </Button>
          )}
        </>
      }
    >
      {step === 'photos' ? (
        <PhotoChooser selected={selected} onChange={setSelected} max={limits.max} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[340px]">
            {preview &&
              (mode === 'collage' ? (
                <div
                  className="overflow-hidden rounded-lg border border-line shadow-[var(--shadow-lift)]"
                  data-testid="collage-preview"
                >
                  <ScenePreview doc={preview} slide={0} eager label="Collage preview" />
                </div>
              ) : (
                <CarouselPreview doc={preview} />
              ))}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {mode === 'dump' && (
              <>
                <div className="rounded-lg border border-line bg-surface p-3" data-testid="dump-auto">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Sparkles className="size-4" />}
                      loading={autoBusy}
                      onClick={() => void runAuto()}
                    >
                      Auto
                    </Button>
                    <p className="min-w-0 flex-1 text-[12px] text-fg-muted">
                      Let your photos pick the cover, order, vibe and title — measured on this device.
                    </p>
                  </div>
                  {auto && (
                    <p className="mt-2 text-[12px] text-fg" data-testid="dump-auto-reason">
                      <span className="mr-1.5 text-[10.5px] font-semibold text-fg-subtle">
                        {auto.source === 'server' ? 'AI server' : 'On this device'} ·
                      </span>
                      {auto.reason}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Vibe</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Photo dump style">
                    {[...DUMP_STYLES, ...trendStyles].map((s, i) => (
                      <Fragment key={s.id}>
                        {i === DUMP_STYLES.length && <p className="col-span-full mt-1 text-label">✦ From {dropTitle}</p>}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={styleId === s.id}
                          onClick={() => setStyleId(s.id)}
                          className={cn(
                            'flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors',
                            styleId === s.id ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong',
                          )}
                        >
                          <span className="text-lg leading-none" aria-hidden>
                            {s.emoji}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-bold">{s.name}</span>
                            <span className="block text-[11px] leading-snug text-fg-subtle">{s.blurb}</span>
                          </span>
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Title</Label>
                  <TextField
                    aria-label="Cover title"
                    placeholder={getDumpStyle(styleId).title.text}
                    value={title}
                    maxLength={60}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </>
            )}

            {mode === 'seamless' && (
              <>
                <div>
                  <Label>Slides</Label>
                  <div className="flex items-center gap-3">
                    <Slider aria-label="Number of slides" min={1} max={10} value={slideCount} onChange={(v) => setSlides(v)} />
                    <span className="w-8 text-right font-mono text-sm tabular-nums">{slideCount}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-fg-subtle">
                    {slides === null ? 'Picked to keep your photos close to their shape.' : `Suggested: ${autoSlides}.`}
                  </p>
                </div>
                <div>
                  <Label>Spacing</Label>
                  <Slider
                    aria-label="Spacing between photos"
                    min={0}
                    max={30}
                    value={Math.round(pano.spacing * 100)}
                    onChange={(v) => setPano({ ...pano, spacing: v / 100 })}
                  />
                </div>
                <div>
                  <Label>Top & bottom margin</Label>
                  <Slider
                    aria-label="Top and bottom margin"
                    min={0}
                    max={35}
                    value={Math.round(pano.margin * 100)}
                    onChange={(v) => setPano({ ...pano, margin: v / 100 })}
                  />
                </div>
                <div>
                  <Label>Alignment</Label>
                  <Segmented
                    aria-label="Alignment"
                    size="sm"
                    block
                    value={pano.align}
                    onChange={(align) => setPano({ ...pano, align })}
                    options={[
                      { value: 'center', label: 'Centre' },
                      { value: 'top', label: 'Top' },
                      { value: 'bottom', label: 'Bottom' },
                      { value: 'stagger', label: 'Stagger' },
                    ]}
                  />
                </div>
                <p className="text-[12px] text-fg-subtle">
                  After creating, double-click any photo to fine-tune its crop — the panorama stays seamless.
                </p>
              </>
            )}

            {mode === 'collage' && (
              <>
                <div>
                  <Label>Style</Label>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Collage style">
                    {(Object.keys(FAMILY_LABELS) as CollageFamily[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={family === f}
                        onClick={() => {
                          setFamily(f);
                          setCollage(defaultCollageParams(f, 0));
                        }}
                        className={cn(
                          'h-8 rounded-md border px-3 text-[12px] font-semibold transition-colors',
                          family === f
                            ? 'border-line-strong bg-surface-active text-fg'
                            : 'border-line text-fg-muted hover:border-accent hover:text-fg',
                        )}
                      >
                        {FAMILY_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Remix</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {MOODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          const next = moodParams(m.id, { ...collage, family });
                          setFamily(next.family);
                          setCollage({ ...collage, ...next });
                          setSeed(newSeed());
                        }}
                        className="h-8 rounded-md border border-line px-3 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent hover:text-fg"
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {target === 'new' && (
              <div>
                <Label>Size</Label>
                <Segmented
                  aria-label="Size"
                  size="sm"
                  value={sizeId}
                  onChange={(v) => setSizeId(v)}
                  options={sizes.map((id) => ({ value: id as SizePresetId, label: `${SIZE_PRESETS[id].ratio}` }))}
                />
              </div>
            )}
            <div>
              <Button variant="secondary" size="sm" icon={<Dices className="size-4" />} onClick={() => setSeed(newSeed())}>
                Shuffle
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Mounted once (in AppProviders); opened through the UI store. */
export function PhotoFlowDialog() {
  const flow = useUi((s) => s.photoFlow);
  const close = useUi((s) => s.closePhotoFlow);
  if (!flow) return null;
  return <FlowBody key={`${flow.mode}:${flow.target}:${flow.family ?? ''}`} flow={flow} onClose={close} />;
}
