'use client';

import { Flame, Images, Layers } from 'lucide-react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { FORMATS } from '@/projects/formats';
import type { Template } from '@/templates/registry';
import { cn } from '@/utils/cn';
import { useUi, type TemplatePreviewRequest } from '@/settings/ui-store';
import { photoSlots } from '@/templates/describe';
import { STYLE_LABELS } from '@/templates/schema';

interface TemplateCardProps {
  template: Template;
  title?: string;
  subtitle?: string;
  heat?: number;
  className?: string;
  /** Where "use" puts the template: a new project, or the design open in the editor. */
  target?: TemplatePreviewRequest['target'];
}

/**
 * Opens the template preview. Carousels preview as a strip that slides on
 * hover, showing off seamless designs.
 */
export function TemplateCard({ template, title, subtitle, heat, className, target = 'new' }: TemplateCardProps) {
  const openTemplate = useUi((s) => s.openTemplate);
  const slides = template.doc.slides.length;
  const multi = slides > 1;
  const frames = photoSlots(template.doc).length;

  return (
    <button
      type="button"
      onClick={() => openTemplate(template.id, target)}
      className={cn('group flex w-full flex-col text-left', className)}
      aria-label={`Template ${template.name}`}
      data-testid="template-card"
    >
      <div className="relative overflow-hidden rounded-[20px] border border-line bg-bg-sunken shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-lift)]">
        {multi ? (
          <div className="overflow-hidden" style={{ aspectRatio: `${template.doc.slideWidth / template.doc.slideHeight}` }}>
            <div
              className="h-full transition-transform duration-[1400ms] ease-[var(--ease-out-expo)] group-hover:[transform:translateX(var(--slide-shift))] group-focus-visible:[transform:translateX(var(--slide-shift))]"
              style={{
                width: `${slides * 100}%`,
                ['--slide-shift' as string]: `-${((Math.min(slides, 3) - 1) / slides) * 100}%`,
              }}
            >
              <ScenePreview doc={template.doc} slide="strip" maxDpr={1.5} />
            </div>
          </div>
        ) : (
          <ScenePreview doc={template.doc} slide={0} maxDpr={1.5} />
        )}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-between">
          <span className="flex gap-1">
            {multi && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-fg glass-strong">
                <Layers className="size-3" /> {slides}
              </span>
            )}
            {frames > 0 && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-fg glass-strong">
                <Images className="size-3" /> {frames}
              </span>
            )}
            {template.source === 'user' && (
              <span className="inline-flex h-6 items-center rounded-full bg-accent px-2 text-[11px] font-bold text-accent-fg">
                Yours
              </span>
            )}
          </span>
          {heat !== undefined && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-ink/80 px-2 text-[11px] font-bold text-lime">
              <Flame className="size-3" /> {heat}
            </span>
          )}
        </div>
        <span className="pointer-events-none absolute inset-x-2 bottom-2 flex translate-y-2 justify-center opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <span className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-fg shadow-[var(--shadow-glow)]">
            Preview
          </span>
        </span>
      </div>
      <p className="mt-2.5 truncate text-sm font-bold">{title ?? template.name}</p>
      <p className="truncate text-xs text-fg-subtle">
        {subtitle ?? `${FORMATS[template.format].label} · ${STYLE_LABELS[template.style]}`}
      </p>
    </button>
  );
}

/** Placeholder while the template library loads. */
export function TemplateCardSkeleton({ aspect = 4 / 5 }: { aspect?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="animate-pulse rounded-[20px] border border-line bg-surface-hover" style={{ aspectRatio: aspect }} />
      <div className="mt-2.5 h-3.5 w-2/3 animate-pulse rounded-full bg-surface-hover" />
      <div className="mt-1.5 h-3 w-1/3 animate-pulse rounded-full bg-surface-hover" />
    </div>
  );
}
