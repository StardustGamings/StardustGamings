'use client';

import { Flame, Layers } from 'lucide-react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { FORMATS } from '@/projects/formats';
import type { Template } from '@/templates/registry';
import { cn } from '@/utils/cn';
import { useCreateFromTemplate } from '@/components/projects/useCreateProject';

interface TemplateCardProps {
  template: Template;
  title?: string;
  subtitle?: string;
  heat?: number;
  className?: string;
}

/** Carousels preview as a strip that slides on hover, showing off seamless designs. */
export function TemplateCard({ template, title, subtitle, heat, className }: TemplateCardProps) {
  const createFromTemplate = useCreateFromTemplate();
  const slides = template.doc.slides.length;
  const multi = slides > 1;

  return (
    <button
      type="button"
      onClick={() => void createFromTemplate(template)}
      className={cn('group flex w-full flex-col text-left', className)}
      aria-label={`Use template ${template.name}`}
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
          {multi ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-fg glass-strong">
              <Layers className="size-3" /> {slides}
            </span>
          ) : (
            <span />
          )}
          {heat !== undefined && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-ink/80 px-2 text-[11px] font-bold text-lime">
              <Flame className="size-3" /> {heat}
            </span>
          )}
        </div>
        <span className="pointer-events-none absolute inset-x-2 bottom-2 flex translate-y-2 justify-center opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <span className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-fg shadow-[var(--shadow-glow)]">
            Use template
          </span>
        </span>
      </div>
      <p className="mt-2.5 truncate text-sm font-bold">{title ?? template.name}</p>
      <p className="truncate text-xs text-fg-subtle">{subtitle ?? FORMATS[template.format].label}</p>
    </button>
  );
}
