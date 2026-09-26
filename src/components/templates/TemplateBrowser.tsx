'use client';

import { FileUp, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FormatId } from '@/types/project';
import { FORMAT_ORDER, FORMATS } from '@/projects/formats';
import { useClientValue } from '@/hooks/useClientValue';
import { filterTemplates } from '@/templates/search';
import { STYLE_LABELS, TEMPLATE_STYLES, type TemplateStyle } from '@/templates/schema';
import { useTemplates } from '@/templates/store';
import { TemplateCard, TemplateCardSkeleton } from '@/components/discover/TemplateCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { TextField } from '@/components/ui/TextField';
import { cn } from '@/utils/cn';
import { importTemplateFiles } from './template-files';

type Tab = 'all' | 'yours';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
        active ? 'border-transparent bg-fg text-bg' : 'border-line text-fg-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

/** The full template library: search, filter by format and style, and your own templates. */
export function TemplateBrowser() {
  const { bundled, user, ready, status } = useTemplates();
  // `/templates/?tab=yours` opens your templates (e.g. from the "saved" toast).
  const urlTab = useClientValue<Tab>(
    () => (new URLSearchParams(window.location.search).get('tab') === 'yours' ? 'yours' : 'all'),
    'all',
  );
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const tab = chosenTab ?? urlTab;
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<FormatId | 'all'>('all');
  const [style, setStyle] = useState<TemplateStyle | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const source = tab === 'yours' ? user : bundled;
  const formats = FORMAT_ORDER.filter((f) => source.some((t) => t.format === f));
  const styles = TEMPLATE_STYLES.filter((s) => source.some((t) => t.style === s));
  const results = useMemo(() => filterTemplates(source, { query, format, style }), [source, query, format, style]);
  const filtered = query !== '' || format !== 'all' || style !== 'all';
  const clear = () => {
    setQuery('');
    setFormat('all');
    setStyle('all');
  };

  return (
    <div data-testid="template-browser">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          value={tab}
          onChange={(t) => {
            setTab(t);
            clear();
          }}
          aria-label="Which templates"
          options={[
            { value: 'all', label: `Stardeck · ${bundled.length || '…'}` },
            { value: 'yours', label: `Yours · ${user.length}` },
          ]}
        />
        <TextField
          aria-label="Search templates"
          placeholder="Search: polaroid, y2k, tips, story…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leading={<Search />}
          className="sm:max-w-sm sm:flex-1"
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
        <Button icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()} className="sm:ml-auto">
          Import template
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          data-testid="template-import-input"
          onChange={async (e) => {
            const files = [...(e.currentTarget.files ?? [])];
            e.currentTarget.value = '';
            const added = await importTemplateFiles(files);
            if (added.length) {
              setTab('yours');
              clear();
            }
          }}
        />
      </div>

      {source.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          <div
            className="-mx-4 hide-scrollbar flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            role="group"
            aria-label="Filter by format"
          >
            <Chip active={format === 'all'} onClick={() => setFormat('all')}>
              All formats
            </Chip>
            {formats.map((f) => (
              <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
                {FORMATS[f].label}
              </Chip>
            ))}
          </div>
          <div
            className="-mx-4 hide-scrollbar flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            role="group"
            aria-label="Filter by style"
          >
            <Chip active={style === 'all'} onClick={() => setStyle('all')}>
              All styles
            </Chip>
            {styles.map((s) => (
              <Chip key={s} active={style === s} onClick={() => setStyle(s)}>
                {STYLE_LABELS[s]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {ready ? `${results.length} template${results.length === 1 ? '' : 's'}` : 'Loading templates'}
      </p>

      {tab === 'all' && !ready ? (
        status === 'error' ? (
          <EmptyState
            title="Templates didn’t load"
            description="Check your connection and try again — once loaded, they work offline."
            action={
              <Button variant="primary" onClick={() => window.location.reload()}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <TemplateCardSkeleton key={i} />
            ))}
          </div>
        )
      ) : tab === 'yours' && user.length === 0 ? (
        <EmptyState
          title="No templates of your own yet"
          description="Open any design and choose Save as template (in the editor’s menu or a project’s ⋯ menu). You can also import a .stardeck-template.json file someone shared with you."
          action={
            <Button variant="primary" icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>
              Import a template file
            </Button>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          compact
          title="Nothing matches that"
          description="Try a different word, or clear the filters."
          action={
            filtered && (
              <Button variant="primary" onClick={clear}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
