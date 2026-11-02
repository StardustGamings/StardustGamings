'use client';

import { Images, Layers, Sparkles } from 'lucide-react';
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
  className?: string;
  /** Where "use" puts the template: a new project, or the design open in the editor. */
  target?: TemplatePreviewRequest['target'];
}

/**
 * Opens the template preview. Carousels preview as a strip that slides on
 * hover, showing off seamless designs.
 */
export function TemplateCard({ template, title, subtitle, className, target = 'new' }: TemplateCardProps) {
  const openTemplate = useUi((s) => s.openTemplate);
  const slides = template.doc.slides.length;
  const multi = slides > 1;
  const frames = photoSlots(template.doc).length;
  const animated = template.doc.elements.some((el) => el.animation);

  return (
    <button
      type="button"
      onClick={() => openTemplate(template.id, target)}
      className={cn('group flex w-full flex-col text-left', className)}
      aria-label={`Template ${template.name}`}
      data-testid="template-card"
    >
      <div className="relative overflow-hidden rounded-lg border border-line bg-bg-sunken transition-[border-color] duration-150 group-hover:border-line-strong">
        {multi ? (
          <div className="overflow-hidden" style={{ aspectRatio: `${template.doc.slideWidth / template.doc.slideHeight}` }}>
            <div
              className="h-full transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover:[transform:translateX(var(--slide-shift))] group-focus-visible:[transform:translateX(var(--slide-shift))]"
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
        {(animated || template.source === 'user') && (
          <div className="pointer-events-none absolute top-2 left-2 flex gap-1">
            {animated && (
              <span className="inline-flex h-5 items-center gap-1 rounded-xs bg-ink/75 px-1.5 text-[10.5px] font-semibold text-white">
                <Sparkles className="size-3" /> Animated
              </span>
            )}
            {template.source === 'user' && (
              <span className="inline-flex h-5 items-center rounded-xs bg-accent px-1.5 text-[10.5px] font-semibold text-accent-fg">
                Yours
              </span>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-subheading">{title ?? template.name}</p>
      <p className="mt-0.5 flex items-center gap-2 truncate text-meta">
        <span className="truncate">{subtitle ?? `${FORMATS[template.format].label} · ${STYLE_LABELS[template.style]}`}</span>
        {multi && (
          <span className="inline-flex shrink-0 items-center gap-0.5" title={`${slides} slides`}>
            <Layers className="size-3" aria-hidden /> {slides}
          </span>
        )}
        {frames > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5" title={`${frames} photo frames`}>
            <Images className="size-3" aria-hidden /> {frames}
          </span>
        )}
      </p>
    </button>
  );
}

/** Placeholder while the template library loads. */
export function TemplateCardSkeleton({ aspect = 4 / 5 }: { aspect?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="skeleton rounded-lg border border-line" style={{ aspectRatio: aspect }} />
      <div className="mt-2 h-3.5 w-2/3 skeleton rounded-xs" />
      <div className="mt-1.5 h-3 w-1/3 skeleton rounded-xs" />
    </div>
  );
}
