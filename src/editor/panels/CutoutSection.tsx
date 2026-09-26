'use client';

import { Check, CloudUpload, Cpu, Pipette, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CutoutBackdrop, ImageElement } from '@/types/document';
import { useAssets } from '@/assets/store';
import { useAssetUrl } from '@/assets/useAssetUrl';
import { AI_DOWNLOAD_BYTES, cutoutProviders, serverHost, useCutoutJob } from '@/images/cutout';
import type { CutoutMethod } from '@/images/cutout/types';
import { useClientValue } from '@/hooks/useClientValue';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { removeBackground, restoreBackground, setBackdrop, updateCutout } from '../photo-actions';
import { FillField, Row, Section } from './fields';

const NO_PROVIDERS: ReturnType<typeof cutoutProviders> = [];
const METHOD_LABEL: Record<CutoutMethod, string> = { ai: 'On-device AI', 'colour-key': 'Colour key', server: 'Cloud' };
const ICONS: Record<CutoutMethod, typeof Cpu> = { ai: Cpu, 'colour-key': Pipette, server: CloudUpload };

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

function stageText(stage: string, progress: number | null): string {
  switch (stage) {
    case 'download':
      return progress !== null ? `Downloading on-device AI… ${Math.round(progress * 100)}%` : 'Downloading on-device AI…';
    case 'analyse':
      return 'Finding the subject…';
    case 'refine':
      return 'Refining the edges…';
    case 'upload':
      return `Sending to ${serverHost() ?? 'the cloud service'}…`;
    default:
      return 'Getting ready…';
  }
}

function BackdropPhoto({ id, selected, onPick }: { id: string; selected: boolean; onPick: () => void }) {
  const url = useAssetUrl(id, 'thumb');
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label="Use this photo as the background"
      className={cn(
        'aspect-square overflow-hidden rounded-[10px] border-2 transition-colors',
        selected ? 'border-accent' : 'border-transparent hover:border-line-strong',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      {url && <img src={url} alt="" className="size-full object-cover" />}
    </button>
  );
}

function BackdropControls({ el }: { el: ImageElement }) {
  const cutout = el.cutout!;
  const backdrop = cutout.backdrop;
  const photos = useAssets((s) => s.assets);
  const choices = useMemo(
    () => photos.filter((a) => a.kind === 'photo' && a.id !== el.assetId).slice(0, 12),
    [photos, el.assetId],
  );
  const kind = backdrop.type;
  const pick = (type: CutoutBackdrop['type']) => {
    if (type === kind) return;
    if (type === 'none') setBackdrop({ type: 'none' });
    if (type === 'fill') setBackdrop({ type: 'fill', fill: { type: 'solid', color: '#FFFFFF' } });
    if (type === 'blur') setBackdrop({ type: 'blur', amount: 45 });
    if (type === 'image' && choices[0]) setBackdrop({ type: 'image', assetId: choices[0].id });
  };
  return (
    <>
      <Segmented
        aria-label="Background behind the subject"
        size="sm"
        block
        value={kind}
        onChange={pick}
        options={[
          { value: 'none', label: 'None' },
          { value: 'fill', label: 'Colour' },
          { value: 'blur', label: 'Blur' },
          { value: 'image', label: 'Photo', disabled: choices.length === 0 },
        ]}
      />
      {backdrop.type === 'fill' && (
        <Row label="Colour">
          <FillField
            label="Background colour"
            value={backdrop.fill}
            onChange={(fill) => fill && setBackdrop({ type: 'fill', fill }, 'backdrop-fill')}
          />
        </Row>
      )}
      {backdrop.type === 'blur' && (
        <div>
          <p className="mb-1 text-[12.5px] text-fg-muted">Blur amount</p>
          <Slider
            aria-label="Background blur"
            min={5}
            max={100}
            value={backdrop.amount}
            onChange={(amount) => setBackdrop({ type: 'blur', amount }, 'backdrop-blur')}
          />
        </div>
      )}
      {backdrop.type === 'image' && (
        <div className="grid grid-cols-4 gap-1.5">
          {choices.map((a) => (
            <BackdropPhoto
              key={a.id}
              id={a.id}
              selected={a.id === backdrop.assetId}
              onPick={() => setBackdrop({ type: 'image', assetId: a.id })}
            />
          ))}
        </div>
      )}
      {choices.length === 0 && kind !== 'image' && (
        <p className="text-[11.5px] text-fg-subtle">Add more photos to use one as the background.</p>
      )}
    </>
  );
}

export function CutoutSection({ el }: { el: ImageElement }) {
  const providers = useClientValue(cutoutProviders, NO_PROVIDERS);
  const job = useCutoutJob((s) => s.job);
  const [method, setMethod] = useState<CutoutMethod>('ai');
  const [confirmUpload, setConfirmUpload] = useState(false);
  const busy = job !== null;
  const mine = job?.elementId === el.id;
  const current = providers.find((p) => p.id === method && p.available) ?? providers.find((p) => p.available);
  const run = () => {
    if (!current) return;
    if (current.uploads) setConfirmUpload(true);
    else void removeBackground(current.id);
  };

  return (
    <Section title="Remove background">
      {mine && job && (
        <div role="status" className="flex flex-col gap-2 rounded-[12px] border border-line p-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Spinner className="size-4 text-accent-text" label="" /> {stageText(job.stage, job.progress)}
          </p>
          {job.progress !== null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-active">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${job.progress * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {el.cutout && !mine && (
        <>
          <p className="flex items-center gap-2 text-[13px]">
            <Check className="size-4 text-success" /> Background removed
            <span className="text-fg-subtle">· {METHOD_LABEL[(el.cutout.method as CutoutMethod) ?? 'ai'] ?? 'Mask'}</span>
          </p>
          <div>
            <div className="mb-1 flex justify-between text-[12.5px] text-fg-muted">
              <span>Edge softness</span>
              <span className="font-mono text-[11.5px]">{Math.round(el.cutout.feather)}</span>
            </div>
            <Slider
              aria-label="Edge softness"
              min={0}
              max={100}
              value={el.cutout.feather}
              onChange={(feather) => updateCutout({ feather }, 'cutout-feather')}
            />
          </div>
          <p className="text-[12px] font-semibold text-fg-subtle">Behind the subject</p>
          <BackdropControls el={el} />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={restoreBackground}
              className="h-9 flex-1 rounded-[10px] border border-line text-[12.5px] font-semibold text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              Restore original
            </button>
          </div>
        </>
      )}

      {!mine && (
        <>
          {el.cutout && <p className="pt-1 text-[12px] font-semibold text-fg-subtle">Try another method</p>}
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Background removal method">
            {providers.map((p) => {
              const Icon = ICONS[p.id];
              const checked = current?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={!p.available || busy}
                  onClick={() => setMethod(p.id)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-[12px] border p-2.5 text-left transition-colors disabled:opacity-45',
                    checked ? 'border-accent bg-accent/8' : 'border-line hover:border-line-strong',
                  )}
                >
                  <Icon className={cn('mt-0.5 size-4 shrink-0', checked ? 'text-accent-text' : 'text-fg-muted')} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{p.label}</span>
                    <span className="block text-[11.5px] leading-snug text-fg-subtle">
                      {p.available ? p.description : p.unavailableReason}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {current?.id === 'ai' && (
            <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" />
              Your photo never leaves this device. The first run downloads the model from Stardeck ({mb(AI_DOWNLOAD_BYTES)},
              once), then it works offline.
            </p>
          )}
          <button
            type="button"
            disabled={!current || busy}
            onClick={run}
            className="h-10 rounded-[12px] bg-fg text-[13.5px] font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {el.cutout ? 'Remove again' : 'Remove background'}
          </button>
        </>
      )}

      <ConfirmDialog
        open={confirmUpload}
        onOpenChange={setConfirmUpload}
        title={`Upload this photo to ${serverHost()}?`}
        description="This method sends the photo to that service to be processed. The on-device methods never upload anything."
        confirmLabel="Upload & remove"
        onConfirm={() => void removeBackground('server')}
      />
    </Section>
  );
}
