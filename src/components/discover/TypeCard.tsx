'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { TrendTypography } from '@/trends/schema';
import { fontStack, loadFont } from '@/typography/fonts';
import { createTypeSpecimen } from '@/templates/specimen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useCreateProject } from '@/components/projects/useCreateProject';

type Spec = TrendTypography['heading'];

export const specStyle = (spec: Spec): CSSProperties => ({
  fontFamily: fontStack(spec.family),
  fontWeight: spec.weight,
  fontStyle: spec.style ?? 'normal',
  textTransform: spec.transform ?? 'none',
});

function useFontsReady(typo: TrendTypography) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      loadFont(typo.heading.family, typo.heading.weight, typo.heading.style),
      loadFont(typo.body.family, typo.body.weight, typo.body.style),
    ]).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [typo]);
  return ready;
}

export function TypePreviewDialog({
  typo,
  open,
  onOpenChange,
}: {
  typo: TrendTypography;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [heading, setHeading] = useState(typo.sample);
  const [body, setBody] = useState('Pair it with a quiet body line that still has personality.');
  const createProject = useCreateProject();
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={typo.name}
      description={`${typo.heading.family} + ${typo.body.family} · ${typo.vibe}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const meta = await createProject({
                name: `${typo.name} post`,
                format: 'post',
                sizeId: 'ig-portrait',
                doc: createTypeSpecimen(typo, heading || typo.sample, body),
              });
              setBusy(false);
              if (meta) onOpenChange(false);
            }}
          >
            Use in a new post
          </Button>
        </>
      }
    >
      <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-[20px] bg-[#F4F1EA] px-6 py-10 text-center text-ink">
        <p className="text-5xl leading-none break-words sm:text-6xl" style={specStyle(typo.heading)}>
          {heading || typo.sample}
        </p>
        <p className="max-w-md text-base text-[#3B3848]" style={specStyle(typo.body)}>
          {body}
        </p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField label="Headline" value={heading} maxLength={60} onChange={(e) => setHeading(e.target.value)} />
        <TextField label="Body" value={body} maxLength={140} onChange={(e) => setBody(e.target.value)} />
      </div>
    </Dialog>
  );
}

export function TypeCard({ typo }: { typo: TrendTypography }) {
  const ready = useFontsReady(typo);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-full w-full flex-col rounded-[20px] border border-line bg-surface p-4 text-left transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-center justify-between gap-2">
          <Badge tone="violet">{typo.vibe}</Badge>
          <span className="text-[11px] font-semibold text-fg-subtle">🔥 {typo.heat}</span>
        </div>
        <p
          className="mt-5 min-h-[76px] text-[34px] leading-[1.05] break-words transition-opacity duration-300"
          style={{ ...specStyle(typo.heading), opacity: ready ? 1 : 0.2 }}
        >
          {typo.sample}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-fg-muted" style={specStyle(typo.body)}>
          The quick brown fox swipes over the lazy feed.
        </p>
        <p className="mt-auto pt-4 text-xs font-semibold text-fg-subtle">
          {typo.heading.family} <span className="text-fg-muted">+</span> {typo.body.family}
        </p>
      </button>
      {open && <TypePreviewDialog typo={typo} open={open} onOpenChange={setOpen} />}
    </>
  );
}
