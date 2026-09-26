'use client';

import { Wand2 } from 'lucide-react';
import { useMemo } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { FORMATS } from '@/projects/formats';
import type { Template } from '@/templates/registry';
import { useTemplates } from '@/templates/store';
import { remixDocument } from '@/templates/remix';
import { useTrends } from '@/trends/store';
import type { TrendPalette } from '@/trends/schema';
import { useCreateFromTemplate } from '@/components/projects/useCreateProject';

interface Idea {
  key: string;
  template: Template;
  palette: TrendPalette | null;
  remixed: Template;
}

/** Remixes of bundled templates with trending palettes — all generated locally. */
export function useInspiration(limit?: number): Idea[] {
  const palettes = useTrends((s) => s.pack.palettes);
  const { bundled } = useTemplates();
  return useMemo(() => {
    const ideas: Idea[] = [];
    bundled.forEach((template, i) => {
      const palette = palettes.length ? palettes[(i * 3 + 1) % palettes.length]! : null;
      const remixed: Template = palette
        ? { ...template, doc: remixDocument(template.doc, template.palette, palette.colors) }
        : template;
      ideas.push({ key: `${template.id}-${palette?.id ?? 'orig'}`, template, palette, remixed });
    });
    // Round-robin across formats so the feed feels varied rather than grouped.
    const byFormat = new Map<string, Idea[]>();
    ideas.forEach((idea) => byFormat.set(idea.template.format, [...(byFormat.get(idea.template.format) ?? []), idea]));
    const queues = [...byFormat.values()];
    const mixed: Idea[] = [];
    while (queues.some((q) => q.length)) queues.forEach((q) => q.length && mixed.push(q.shift()!));
    return limit ? mixed.slice(0, limit) : mixed;
  }, [bundled, palettes, limit]);
}

export function InspirationFeed({ limit }: { limit?: number }) {
  const ideas = useInspiration(limit);
  const createFromTemplate = useCreateFromTemplate();

  return (
    <div className="columns-2 gap-4 md:columns-3 xl:columns-4 [&>*]:mb-4">
      {ideas.map((idea) => (
        <figure key={idea.key} className="group relative break-inside-avoid">
          <div className="overflow-hidden rounded-[20px] border border-line shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-lift)]">
            <ScenePreview
              doc={idea.remixed.doc}
              slide={0}
              maxDpr={1.5}
              label={`${idea.template.name} remixed with ${idea.palette?.name ?? 'its original colours'}`}
            />
          </div>
          <figcaption className="flex items-center gap-2 px-1 pt-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{idea.template.name}</span>
              <span className="block truncate text-[11.5px] text-fg-subtle">
                {FORMATS[idea.template.format].label}
                {idea.palette && ` × ${idea.palette.name}`}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void createFromTemplate(idea.remixed, { name: `${idea.template.name} remix` })}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold transition-colors hover:border-transparent hover:bg-accent hover:text-accent-fg"
              aria-label={`Remix ${idea.template.name}${idea.palette ? ` in ${idea.palette.name}` : ''}`}
            >
              <Wand2 className="size-3.5" /> Remix
            </button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
