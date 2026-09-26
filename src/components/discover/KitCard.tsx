'use client';

import { Palette, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { loadFont } from '@/typography/fonts';
import type { Template } from '@/templates/registry';
import { useTemplateLookup } from '@/templates/store';
import { resolveStyle } from '@/trends/pack';
import { restyleDocument, styleKit } from '@/trends/restyle';
import type { TrendPack, TrendStyle } from '@/trends/schema';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCreateFromTemplate } from '@/components/projects/useCreateProject';

/** Templates a kit is shown on (the first one in this build wins). */
const SAMPLES = ['new-drop', 'quote-card', 'grwm-cover'];

/** Loads a type pairing's faces, so restyled text is measured with the real fonts. */
export function useTypographyReady(pack: TrendPack, style: TrendStyle): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const { typography } = resolveStyle(pack, style);
    void Promise.all([
      loadFont(typography.heading.family, typography.heading.weight, typography.heading.style),
      loadFont(typography.body.family, typography.body.weight, typography.body.style),
    ]).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [pack, style]);
  return ready;
}

/**
 * A trend kit — palette, type pairing, filter, stickers and motion — shown on a
 * sample template restyled with it. Start a post from it, or restyle your own
 * design from the editor's Trends tool.
 */
export function KitCard({ pack, style }: { pack: TrendPack; style: TrendStyle }) {
  const templates = useTemplateLookup();
  const sample: Template | undefined = SAMPLES.map((id) => templates.get(id)).find(Boolean);
  const ready = useTypographyReady(pack, style);
  const createFromTemplate = useCreateFromTemplate();
  const [busy, setBusy] = useState(false);
  const { palette, typography, look } = resolveStyle(pack, style);
  const restyled = useMemo(
    () => (sample && ready ? { ...sample, doc: restyleDocument(sample.doc, styleKit(pack, style)) } : null),
    [sample, ready, pack, style],
  );

  return (
    <article className="flex flex-col rounded-[22px] border border-line bg-surface p-2" data-testid="kit-card">
      <div className="relative overflow-hidden rounded-[16px] bg-bg-sunken" style={{ aspectRatio: '4 / 5' }}>
        {restyled && (
          <ScenePreview doc={restyled.doc} slide={0} maxDpr={1.5} label={`${sample!.name} restyled as ${style.name}`} />
        )}
        <span className="absolute top-2 right-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10.5px] font-bold text-lime">
          🔥 {style.heat}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-1.5 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 truncate text-base font-extrabold">{style.name}</h3>
          <Badge tone="violet">{style.vibe}</Badge>
        </div>
        <p className="line-clamp-2 text-xs text-fg-subtle">{style.description}</p>
        <div className="flex h-5 overflow-hidden rounded-full" aria-label={`Palette: ${palette.name}`} role="img">
          {palette.colors.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-fg-muted">
          <li className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
            <Palette className="size-3" /> {palette.name}
          </li>
          <li className="rounded-full border border-line px-2 py-0.5">
            {typography.heading.family} + {typography.body.family}
          </li>
          {look && <li className="rounded-full border border-line px-2 py-0.5">Filter: {look.name}</li>}
          {style.animate && (
            <li className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
              <Sparkles className="size-3" /> {style.animate[0]!.toUpperCase() + style.animate.slice(1)} motion
            </li>
          )}
        </ul>
        <Button
          className="mt-auto"
          size="sm"
          variant="primary"
          icon={<Wand2 className="size-4" />}
          loading={busy}
          disabled={!restyled}
          onClick={async () => {
            if (!restyled) return;
            setBusy(true);
            await createFromTemplate(restyled, { name: `${style.name} post`, templateId: sample!.id });
            setBusy(false);
          }}
        >
          Start a post in this style
        </Button>
      </div>
    </article>
  );
}
