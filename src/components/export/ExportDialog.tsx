'use client';

import { AlertTriangle, Check, Clapperboard, Download, Film, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DesignDocument } from '@/types/document';
import type { ProjectMeta } from '@/types/project';
import { ScenePreview } from '@/canvas/ScenePreview';
import { useEditor } from '@/editor/store';
import { canEncode } from '@/export/encode';
import { canShareFiles, exportDesign, type ExportProgress, type ExportResult } from '@/export/export';
import {
  FORMAT_LABELS,
  planExport,
  QUALITY,
  supportsTransparency,
  type ExportFormat,
  type ExportOptions,
  type ExportQuality,
} from '@/export/plan';
import { canExportMp4, MAX_GIF_MS, motionFps, motionSize, type MotionFormat } from '@/export/motion-plan';
import type { MotionResult } from '@/export/motion';
import { isAnimated, planSequence } from '@/animations/sequence';
import { getProject } from '@/projects/repository';
import { useSettings } from '@/settings/store';
import { useUi, type ExportRequest } from '@/settings/ui-store';
import { photoSlots } from '@/templates/describe';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download';

type Scope = 'all' | 'one' | 'strip';
type AnyFormat = ExportFormat | MotionFormat;
const isMotion = (f: AnyFormat): f is MotionFormat => f === 'mp4' || f === 'gif';
const ALL_LABELS: Record<AnyFormat, string> = { ...FORMAT_LABELS, mp4: 'MP4', gif: 'GIF' };
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">{children}</p>;
}

const formatBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/** A burst of sparkles for a finished export (skipped when motion is off). */
function Celebration() {
  const bits = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return {
      x: Math.cos(angle) * 70,
      y: Math.sin(angle) * 70,
      rotate: i * 30,
      color: ['#C6FF3D', '#FF5CAA', '#A06BFF', '#3CF0FF'][i % 4]!,
    };
  });
  return (
    <div className="relative flex size-28 items-center justify-center" aria-hidden>
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="motion-decorative absolute size-2.5 rounded-[3px]"
          style={{ background: b.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: b.x, y: b.y, opacity: 0, scale: 1, rotate: b.rotate }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />
      ))}
      <motion.span
        className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[var(--shadow-glow)]"
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 16 }}
      >
        <Check className="size-8" strokeWidth={3} />
      </motion.span>
    </div>
  );
}

function saveFiles(result: ExportResult) {
  if (result.bundle) {
    downloadBlob(result.bundle, result.bundle.name);
    return;
  }
  // Separate files: a short gap between downloads keeps browsers happy.
  result.files.forEach((f, i) => setTimeout(() => downloadBlob(f, f.name), i * 250));
}

function Body({
  doc,
  meta,
  initialSlide,
  onClose,
}: {
  doc: DesignDocument;
  meta: ProjectMeta;
  initialSlide: number;
  onClose: () => void;
}) {
  const defaults = useSettings((s) => s.export);
  const updateExport = useSettings((s) => s.updateExport);
  const multi = doc.slides.length > 1;
  const [format, setFormat] = useState<AnyFormat>(defaults.format);
  const [quality, setQuality] = useState<ExportQuality>(defaults.quality);
  const [scope, setScope] = useState<Scope>('all');
  const [slide, setSlide] = useState(Math.min(initialSlide, doc.slides.length - 1));
  const [transparent, setTransparent] = useState(false);
  const [separate, setSeparate] = useState(false);
  const [webp, setWebp] = useState(true);
  const [mp4, setMp4] = useState<boolean | null>(null);
  const [motionInfo, setMotionInfo] = useState<MotionResult | null>(null);
  const [phase, setPhase] = useState<'options' | 'working' | 'done'>('options');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void canEncode('webp').then(setWebp);
    void canExportMp4().then(setMp4);
  }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const chosen: AnyFormat = format === 'webp' && !webp ? 'png' : format === 'mp4' && mp4 === false ? 'gif' : format;
  const motion = isMotion(chosen);
  // Stills keep planning with a still format while a motion format is picked (unused then).
  const effectiveFormat: ExportFormat = motion ? 'png' : chosen;
  const effectiveScope: Scope = scope === 'strip' && (chosen === 'pdf' || motion || !multi) ? 'all' : scope;
  const motionSlides = effectiveScope === 'one' ? [slide] : undefined;
  const sequence = useMemo(() => planSequence(doc, motionSlides), [doc, motionSlides?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const motionPx = motion ? motionSize(doc, chosen, quality) : null;
  const tooLongForGif = chosen === 'gif' && sequence.total > MAX_GIF_MS;
  const options = useMemo<ExportOptions>(
    () => ({
      format: effectiveFormat,
      quality,
      scope:
        effectiveScope === 'strip'
          ? { kind: 'strip' }
          : effectiveScope === 'one'
            ? { kind: 'slides', indices: [slide] }
            : { kind: 'all' },
      transparent: transparent && supportsTransparency(effectiveFormat),
      packaging: separate ? 'files' : 'zip',
    }),
    [effectiveFormat, quality, effectiveScope, slide, transparent, separate],
  );
  const items = useMemo(() => planExport(doc, meta.name, options), [doc, meta.name, options]);
  const emptyFrames = useMemo(() => photoSlots(doc).length, [doc]);
  const first = items[0];
  const summary = motion
    ? `${chosen === 'gif' ? '1 GIF' : '1 video'} · ${ALL_LABELS[chosen]} · ${secs(sequence.total)}`
    : effectiveFormat === 'pdf'
      ? `${items.length} page${items.length === 1 ? '' : 's'} · PDF`
      : `${items.length} ${effectiveScope === 'strip' ? 'wide image' : `image${items.length === 1 ? '' : 's'}`} · ${FORMAT_LABELS[effectiveFormat]}${
          items.length > 1 ? (separate ? ' · separate files' : ' · ZIP') : ''
        }`;

  const start = async () => {
    setError(null);
    setPhase('working');
    updateExport({ format: chosen, quality });
    const controller = new AbortController();
    abort.current = controller;
    try {
      let out: ExportResult;
      if (motion) {
        // The encoders load only when a video is actually made.
        const { exportMotion } = await import('@/export/motion');
        const made = await exportMotion(
          { doc, name: meta.name },
          { format: chosen, quality, slides: motionSlides },
          {
            signal: controller.signal,
            onProgress: setProgress,
          },
        );
        setMotionInfo(made);
        out = { files: [made.file], bundle: made.file, missing: 0, width: made.width, height: made.height };
      } else {
        setMotionInfo(null);
        out = await exportDesign({ doc, name: meta.name, sizeId: meta.sizeId }, options, {
          signal: controller.signal,
          onProgress: setProgress,
        });
      }
      setResult(out);
      setPhase('done');
      // Where the system share sheet exists (phones), let people pick Save or Share; elsewhere just save.
      if (!canShareFiles(out.files)) saveFiles(out);
    } catch (e) {
      if (controller.signal.aborted) {
        setPhase('options');
        return;
      }
      setError(e instanceof Error ? e.message : 'Something went wrong while exporting.');
      setPhase('options');
    } finally {
      abort.current = null;
    }
  };

  const share = async () => {
    if (!result) return;
    try {
      await navigator.share({ files: result.files, title: meta.name });
    } catch (e) {
      // Closing the share sheet is not an error; anything else falls back to saving.
      if ((e as Error).name === 'AbortError') return;
      toast({ title: 'Couldn’t open the share sheet', description: 'Saved the files instead.' });
      saveFiles(result);
    }
  };

  if (phase === 'done' && result) {
    const size = result.bundle?.size ?? result.files.reduce((n, f) => n + f.size, 0);
    const shareable = canShareFiles(result.files);
    return (
      <Dialog
        open
        onOpenChange={(open) => !open && onClose()}
        size="sm"
        title="Export ready"
        hideTitle
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
            {shareable && (
              <Button icon={<Share2 className="size-4" />} onClick={() => void share()}>
                Share
              </Button>
            )}
            <Button
              variant={shareable ? 'primary' : 'secondary'}
              icon={<Download className="size-4" />}
              onClick={() => saveFiles(result)}
            >
              {shareable ? 'Save' : 'Download again'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center" data-testid="export-done">
          <Celebration />
          <p className="text-xl font-extrabold">
            {motionInfo
              ? chosen === 'gif'
                ? 'Your GIF is ready'
                : 'Your video is ready'
              : effectiveScope === 'strip'
                ? 'Your carousel is ready'
                : items.length > 1
                  ? 'Your slides are ready'
                  : 'Your design is ready'}
          </p>
          <p className="text-[13px] text-fg-muted">
            {result.bundle ? result.bundle.name : `${result.files.length} files`} · {formatBytes(size)} · {result.width} ×{' '}
            {result.height} px{motionInfo && ` · ${secs(motionInfo.duration)}`}
          </p>
          {motionInfo?.codec && (
            <p className="text-[12px] text-fg-muted" data-testid="export-codec">
              {motionInfo.codec}
              {motionInfo.audio === 'included' ? ' · with sound' : motionInfo.audio === 'unsupported' ? ' · silent' : ''}
              {motionInfo.codec !== 'H.264' &&
                ' — plays in browsers and most apps. For Instagram or TikTok, export from Chrome, Edge or Safari to get H.264.'}
              {motionInfo.audio === 'unsupported' && ' This browser can’t encode the sound, so the video is silent.'}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
            <ShieldCheck className="size-3.5 text-success" /> Made on this device. No watermark, ever.
          </p>
          {result.missing > 0 && (
            <p className="text-[12px] text-warning">
              {result.missing} photo{result.missing === 1 ? ' is' : 's are'} no longer on this device and exported as empty
              frames.
            </p>
          )}
        </div>
      </Dialog>
    );
  }

  const working = phase === 'working';
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !working && onClose()}
      size="lg"
      title="Export"
      description="Everything is made on this device — nothing is uploaded, and there’s never a watermark."
      footer={
        working ? (
          <Button variant="ghost" onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              icon={<Download className="size-4" />}
              onClick={() => void start()}
              disabled={tooLongForGif}
              data-testid="export-start"
            >
              Export {summary.split(' · ')[0]}
            </Button>
          </>
        )
      }
    >
      {working ? (
        <div className="flex flex-col items-center gap-4 py-8" role="status" aria-live="polite">
          <Spinner label="Exporting" />
          <p className="text-sm font-semibold">{progress?.label ?? 'Starting…'}</p>
          <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface-active">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5" data-testid="export-options">
          {error && (
            <p
              className="flex items-start gap-2 rounded-[12px] border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          <div>
            <Label>File type</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="File type">
              {(['png', 'jpg', 'webp', 'pdf', 'mp4', 'gif'] as const).map((f) => {
                const disabled = (f === 'webp' && !webp) || (f === 'mp4' && mp4 === false);
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={chosen === f}
                    disabled={disabled}
                    title={
                      f === 'webp' && disabled
                        ? 'This browser can’t save WebP files'
                        : f === 'mp4' && disabled
                          ? 'This browser can’t make MP4 videos — try Chrome, Edge or Safari'
                          : undefined
                    }
                    onClick={() => setFormat(f)}
                    className={cn(
                      'flex h-9 min-w-16 items-center justify-center gap-1.5 rounded-[12px] border px-3 text-[13px] font-bold transition-colors disabled:opacity-40',
                      chosen === f ? 'border-transparent bg-fg text-bg' : 'border-line hover:border-line-strong',
                    )}
                  >
                    {f === 'mp4' && <Film className="size-4" />}
                    {f === 'gif' && <Clapperboard className="size-4" />}
                    {ALL_LABELS[f]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11.5px] text-fg-subtle">
              {chosen === 'png'
                ? 'Lossless — sharpest text and graphics.'
                : chosen === 'jpg'
                  ? 'Smallest files for photo-heavy designs.'
                  : chosen === 'webp'
                    ? 'Small files, great quality, transparency supported.'
                    : chosen === 'pdf'
                      ? 'One page per slide — easy to send or print.'
                      : chosen === 'mp4'
                        ? 'A video of your design: slides in order with their animations, clips and transitions — ready for Reels, TikTok and Stories.'
                        : 'A looping GIF of your design (no sound, up to 30 s) — for chats, sites and stickers.'}
            </p>
            {motion && !isAnimated(doc) && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-fg-muted">
                <Sparkles className="mt-px size-3.5 shrink-0 text-accent-text" />
                Nothing moves yet — add animations in the Animate panel (or it plays as a still).
              </p>
            )}
          </div>

          {multi && (
            <div>
              <Label>What to export</Label>
              <Segmented
                aria-label="What to export"
                block
                value={effectiveScope}
                onChange={setScope}
                options={[
                  {
                    value: 'all',
                    label: motion ? `All ${doc.slides.length} slides, in order` : `All ${doc.slides.length} slides`,
                  },
                  { value: 'one', label: 'One slide' },
                  ...(chosen === 'pdf' || motion ? [] : [{ value: 'strip' as const, label: 'Full carousel' }]),
                ]}
              />
              {effectiveScope === 'one' && (
                <div className="mt-2 hide-scrollbar flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Slide">
                  {doc.slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={slide === i}
                      aria-label={`Slide ${i + 1}`}
                      onClick={() => setSlide(i)}
                      className={cn(
                        'relative w-16 shrink-0 overflow-hidden rounded-[10px] border-2 transition-colors',
                        slide === i ? 'border-accent' : 'border-transparent hover:border-line-strong',
                      )}
                    >
                      <ScenePreview doc={doc} slide={i} maxDpr={1} />
                      <span className="absolute right-1 bottom-1 rounded-full bg-ink/70 px-1.5 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {effectiveScope === 'strip' && (
                <p className="mt-1.5 text-[11.5px] text-fg-subtle">
                  One wide image of every slide side by side — handy for previews and seamless designs.
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Quality</Label>
            <Segmented
              aria-label="Quality"
              block
              value={quality}
              onChange={setQuality}
              options={(Object.keys(QUALITY) as ExportQuality[]).map((q) => ({ value: q, label: QUALITY[q].label }))}
            />
            <p className="mt-1.5 text-[11.5px] text-fg-subtle" data-testid="quality-hint">
              {motionPx
                ? `${motionPx.width} × ${motionPx.height} px · ${motionFps(chosen as MotionFormat, quality)} fps · ${secs(sequence.total)}`
                : `${QUALITY[quality].hint}${first ? ` — ${first.width} × ${first.height} px` : ''}`}
              .
            </p>
            {tooLongForGif && (
              <p className="mt-1.5 text-[11.5px] text-warning" role="alert">
                GIFs are limited to 30 seconds — pick one slide, shorten slides, or export an MP4.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!motion && supportsTransparency(effectiveFormat) && (
              <label className="flex items-center justify-between gap-3 text-[13.5px]">
                <span>
                  <span className="font-semibold">Transparent background</span>
                  <span className="block text-[12px] text-fg-subtle">
                    Leaves the background out — for stickers, logos and overlays.
                  </span>
                </span>
                <Switch checked={transparent} onCheckedChange={setTransparent} aria-label="Transparent background" />
              </label>
            )}
            {!motion && effectiveFormat !== 'pdf' && items.length > 1 && (
              <label className="flex items-center justify-between gap-3 text-[13.5px]">
                <span>
                  <span className="font-semibold">Separate files</span>
                  <span className="block text-[12px] text-fg-subtle">Off: one ZIP. On: each image downloads on its own.</span>
                </span>
                <Switch checked={separate} onCheckedChange={setSeparate} aria-label="Separate files" />
              </label>
            )}
          </div>

          {emptyFrames > 0 && (
            <p className="flex items-start gap-2 text-[12.5px] text-fg-muted">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-warning" />
              {emptyFrames} photo frame{emptyFrames === 1 ? ' is' : 's are'} still empty — {emptyFrames === 1 ? 'it' : 'they'}{' '}
              export as a plain colour.
            </p>
          )}
          <p className="text-[12px] font-semibold text-fg-muted" aria-live="polite">
            {summary}
          </p>
        </div>
      )}
    </Dialog>
  );
}

function EditorSource({ onClose }: { onClose: () => void }) {
  const meta = useEditor((s) => s.meta);
  const [snapshot] = useState(() => {
    const s = useEditor.getState();
    return { doc: s.history?.present ?? null, slide: s.activeSlide };
  });
  if (!meta || !snapshot.doc) return null;
  return <Body doc={snapshot.doc} meta={meta} initialSlide={snapshot.slide} onClose={onClose} />;
}

function ProjectSource({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [project, setProject] = useState<{ meta: ProjectMeta; doc: DesignDocument } | null | 'missing'>(null);
  useEffect(() => {
    let alive = true;
    void getProject(projectId).then((p) => alive && setProject(p ?? 'missing'));
    return () => {
      alive = false;
    };
  }, [projectId]);
  if (project && project !== 'missing') return <Body doc={project.doc} meta={project.meta} initialSlide={0} onClose={onClose} />;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Export" size="sm">
      {project === 'missing' ? (
        <p className="text-sm text-fg-muted">That project couldn’t be found.</p>
      ) : (
        <div className="flex justify-center py-8">
          <Spinner label="Loading project" />
        </div>
      )}
    </Dialog>
  );
}

/** Export PNG / JPG / WebP / PDF — slides, a ZIP or the whole carousel. */
export function ExportDialog() {
  const request: ExportRequest | null = useUi((s) => s.exportRequest);
  const close = useUi((s) => s.closeExport);
  if (!request) return null;
  return request.source === 'editor' ? (
    <EditorSource onClose={close} />
  ) : (
    <ProjectSource key={request.projectId} projectId={request.projectId} onClose={close} />
  );
}
