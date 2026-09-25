'use client';

import { Popover } from 'radix-ui';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BUNDLED_FONTS, fontStack, loadFont, type FontCategory } from '@/typography/fonts';
import { SoonBadge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

const CATEGORIES: { id: FontCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sans', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'script', label: 'Script' },
  { id: 'mono', label: 'Mono' },
];

/** Picks from the bundled (offline) font library, previewing each family in itself. */
export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | 'all'>('all');

  useEffect(() => {
    if (!open) return;
    for (const f of BUNDLED_FONTS) void loadFont(f.family, f.variable ? 600 : f.weights[0], 'normal');
  }, [open]);

  const fonts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUNDLED_FONTS.filter(
      (f) =>
        (category === 'all' || f.category === category) &&
        (!q || f.family.toLowerCase().includes(q) || f.vibes.some((v) => v.includes(q))),
    );
  }, [query, category]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Font: ${value}`}
          className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-line bg-bg-sunken/70 px-3 text-left transition-colors hover:border-line-strong"
        >
          <span className="min-w-0 flex-1 truncate text-[15px]" style={{ fontFamily: fontStack(value) }}>
            {value}
          </span>
          <ChevronDown className="size-4 text-fg-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          className="z-[70] flex max-h-[min(560px,80dvh)] w-[300px] animate-[pop-in_140ms_var(--ease-out-expo)] flex-col rounded-[18px] shadow-[var(--shadow-float)] glass-strong"
        >
          <div className="border-b border-line p-3">
            <div className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-bg-sunken/70 px-2.5 focus-within:border-ring">
              <Search className="size-4 text-fg-subtle" />
              <input
                autoFocus
                aria-label="Search fonts"
                placeholder="Search fonts or vibes (y2k, luxury…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-subtle"
              />
            </div>
            <div className="mt-2 hide-scrollbar flex gap-1 overflow-x-auto">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'h-7 shrink-0 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors',
                    category === c.id ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Fonts">
            {fonts.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={f.family === value}
                  onClick={() => {
                    onChange(f.family);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] leading-tight" style={{ fontFamily: fontStack(f.family) }}>
                      {f.family}
                    </span>
                    <span className="block truncate text-[10.5px] text-fg-subtle capitalize">{f.vibes.join(' · ')}</span>
                  </span>
                  {f.family === value && <Check className="size-4 text-accent-text" />}
                </button>
              </li>
            ))}
            {fonts.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">No fonts match.</li>}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5 text-[11px] text-fg-subtle">
            <span>{BUNDLED_FONTS.length} fonts · all work offline</span>
            <span className="flex items-center gap-1.5">
              Upload & Google Fonts <SoonBadge />
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
