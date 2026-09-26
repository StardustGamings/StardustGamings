'use client';

import { BookmarkPlus, Layers, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { useUi } from '@/settings/ui-store';
import type { Template } from '@/templates/registry';
import { filterTemplates } from '@/templates/search';
import { useTemplates } from '@/templates/store';
import { selectDoc, useEditor } from '../store';

function Tile({ template }: { template: Template }) {
  const openTemplate = useUi((s) => s.openTemplate);
  const slides = template.doc.slides.length;
  return (
    <button
      type="button"
      onClick={() => openTemplate(template.id, 'editor')}
      aria-label={`Template ${template.name}`}
      className="group flex min-w-0 flex-col text-left"
    >
      <span className="relative block overflow-hidden rounded-[12px] border border-line transition-[border-color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:border-accent">
        <ScenePreview doc={template.doc} slide={0} maxDpr={1.5} />
        {slides > 1 && (
          <span className="absolute top-1.5 left-1.5 inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-bold glass-strong">
            <Layers className="size-2.5" /> {slides}
          </span>
        )}
      </span>
      <span className="mt-1 truncate text-[11.5px] font-semibold">{template.name}</span>
    </button>
  );
}

/** Aspect ratios within 2% count as the same size (templates scale to fit anyway). */
const sameShape = (a: { slideWidth: number; slideHeight: number }, b: { slideWidth: number; slideHeight: number }) =>
  Math.abs(a.slideWidth / a.slideHeight / (b.slideWidth / b.slideHeight) - 1) < 0.02;

export function TemplatesPanel() {
  const doc = useEditor(selectDoc);
  const openSaveTemplate = useUi((s) => s.openSaveTemplate);
  const { bundled, user, ready } = useTemplates();
  const [scope, setScope] = useState<'fit' | 'all'>('fit');
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const all = [...user, ...bundled];
    const shaped = scope === 'fit' && doc ? all.filter((t) => sameShape(t.doc, doc)) : all;
    return filterTemplates(shaped, { query });
  }, [user, bundled, scope, doc, query]);
  const yours = list.filter((t) => t.source === 'user');
  const ours = list.filter((t) => t.source !== 'user');

  return (
    <div data-testid="templates-panel">
      <div className="flex flex-col gap-2.5 p-4">
        <Button block icon={<BookmarkPlus className="size-4" />} onClick={() => openSaveTemplate({ source: 'editor' })}>
          Save design as template
        </Button>
        <TextField
          aria-label="Search templates"
          placeholder="Search templates"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leading={<Search />}
          trailing={
            query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="text-fg-subtle hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )
          }
        />
        <Segmented
          size="sm"
          block
          aria-label="Which templates"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'fit', label: 'This size' },
            { value: 'all', label: 'All sizes' },
          ]}
        />
      </div>

      {!ready ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading templates" />
        </div>
      ) : list.length === 0 ? (
        <div className="px-4 pb-6 text-center text-[12.5px] leading-relaxed text-fg-muted">
          <p>No templates match.</p>
          {scope === 'fit' && (
            <button type="button" onClick={() => setScope('all')} className="mt-1 font-semibold text-accent-text hover:underline">
              Show every size — they scale to fit
            </button>
          )}
        </div>
      ) : (
        <>
          {yours.length > 0 && (
            <>
              <h3 className="px-4 pt-1 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">Yours</h3>
              <div className="grid grid-cols-2 gap-3 p-4">
                {yours.map((t) => (
                  <Tile key={t.id} template={t} />
                ))}
              </div>
            </>
          )}
          {ours.length > 0 && (
            <>
              <h3 className="px-4 pt-1 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">Stardeck</h3>
              <div className="grid grid-cols-2 gap-3 p-4">
                {ours.map((t) => (
                  <Tile key={t.id} template={t} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      <p className="px-4 pb-4 text-[11.5px] text-fg-subtle">
        Templates add their slides after the one you’re on — or fill an empty design.{' '}
        <Link href="/templates/" className="font-semibold text-accent-text hover:underline">
          Browse all
        </Link>
      </p>
    </div>
  );
}
