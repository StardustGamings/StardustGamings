'use client';

import { ArrowRight, Copy, Maximize2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { formatForSize, RESIZE_TARGETS, type ResizeTarget } from '@/ai/resize';
import { FORMATS, SIZE_PRESETS } from '@/projects/formats';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { useCreateProject } from '@/components/projects/useCreateProject';
import { cn } from '@/utils/cn';
import { resizeInPlace, resizedDocument } from './ai-actions';
import { selectDoc, useEditor } from './store';

const isTarget = (id: string | null | undefined): id is ResizeTarget =>
  !!id && (RESIZE_TARGETS as readonly string[]).includes(id);

function Body({ start, onClose }: { start: string | null; onClose: () => void }) {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const slide = useEditor((s) => s.activeSlide);
  const current = meta?.sizeId;
  const [target, setTarget] = useState<ResizeTarget>(
    isTarget(start) ? start : (RESIZE_TARGETS.find((t) => t !== current) ?? 'story'),
  );
  const [mode, setMode] = useState<'copy' | 'in-place'>('copy');
  const [busy, setBusy] = useState(false);
  const createProject = useCreateProject();
  const resized = useMemo(() => (doc ? resizedDocument(doc, target) : null), [doc, target]);
  if (!doc || !meta || !resized) return null;
  const preset = SIZE_PRESETS[target];
  const same = doc.slideWidth === preset.width && doc.slideHeight === preset.height;
  const format = formatForSize(target, meta.format, doc.slides.length);

  const run = async () => {
    setBusy(true);
    try {
      if (mode === 'in-place') {
        await resizeInPlace(target);
        onClose();
      } else {
        const created = await createProject({
          name: `${meta.name} (${preset.label} ${preset.ratio})`.slice(0, 80),
          format,
          sizeId: target,
          doc: resized,
        });
        if (created) onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <div role="radiogroup" aria-label="New size" className="flex flex-wrap gap-2" data-testid="resize-targets">
          {RESIZE_TARGETS.map((id) => {
            const p = SIZE_PRESETS[id];
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={target === id}
                onClick={() => setTarget(id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] font-semibold transition-colors',
                  target === id ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong',
                )}
              >
                <span
                  aria-hidden
                  className="inline-block rounded-xs border-2 border-current opacity-70"
                  style={{ width: 18 * Math.min(1, p.width / p.height), height: 18 * Math.min(1, p.height / p.width) }}
                />
                <span>
                  {p.ratio}
                  <span className="block text-[11px] font-medium text-fg-subtle">{p.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <figure className="flex flex-col items-center gap-1.5">
            <div className="flex h-56 w-full items-center justify-center">
              <div
                className="overflow-hidden rounded-md border border-line shadow-[var(--shadow-soft)]"
                style={{
                  aspectRatio: `${doc.slideWidth} / ${doc.slideHeight}`,
                  height: doc.slideHeight >= doc.slideWidth ? '100%' : undefined,
                  width: doc.slideWidth > doc.slideHeight ? '100%' : undefined,
                }}
              >
                <ScenePreview doc={doc} slide={slide} maxDpr={1.5} label="Now" />
              </div>
            </div>
            <figcaption className="text-[11.5px] text-fg-subtle">
              Now · {doc.slideWidth} × {doc.slideHeight}
            </figcaption>
          </figure>
          <ArrowRight className="size-5 text-fg-subtle" aria-hidden />
          <figure className="flex flex-col items-center gap-1.5" data-testid="resize-preview">
            <div className="flex h-56 w-full items-center justify-center">
              <div
                className="overflow-hidden rounded-md border border-accent/60 shadow-[var(--shadow-soft)]"
                style={{
                  aspectRatio: `${preset.width} / ${preset.height}`,
                  height: preset.height >= preset.width ? '100%' : undefined,
                  width: preset.width > preset.height ? '100%' : undefined,
                }}
              >
                <ScenePreview doc={resized} slide={slide} maxDpr={1.5} label={`Resized to ${preset.ratio}`} />
              </div>
            </div>
            <figcaption className="text-[11.5px] text-fg-subtle">
              {preset.ratio} · {preset.width} × {preset.height}
            </figcaption>
          </figure>
        </div>

        <div className="flex flex-col gap-2">
          <Segmented
            value={mode}
            onChange={setMode}
            aria-label="Where the resized design goes"
            options={[
              { value: 'copy', label: 'As a new design' },
              { value: 'in-place', label: 'Resize this one' },
            ]}
          />
          <p className="text-[12px] text-fg-muted">
            {mode === 'copy'
              ? `Saves a ${FORMATS[format].label.toLowerCase()} copy and opens it — this design stays as it is.`
              : 'Changes this design’s size. One undo puts it back.'}{' '}
            Runs on your device: backgrounds fill the new shape, things stay near the edges they were on, text re-wraps and
            collages re-arrange. Tweak anything afterwards.
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={mode === 'copy' ? <Copy className="size-4" /> : <Maximize2 className="size-4" />}
          loading={busy}
          disabled={same}
          onClick={() => void run()}
          data-testid="resize-apply"
        >
          {same ? 'Already this size' : mode === 'copy' ? `Make a ${preset.ratio} copy` : `Resize to ${preset.ratio}`}
        </Button>
      </div>
    </>
  );
}

/** Smart resize: preview the design at another size, then make a copy or resize in place. */
export function ResizeDialog() {
  const request = useUi((s) => s.resize);
  const close = useUi((s) => s.closeResize);
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && close()}
      title="Resize design"
      description="Adapt it to another size — 4:5, 1:1, 9:16, 16:9 and more."
      size="lg"
    >
      {request && <Body start={request.target} onClose={close} />}
    </Dialog>
  );
}
