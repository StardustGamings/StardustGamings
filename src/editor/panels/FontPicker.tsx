'use client';

import { Popover } from 'radix-ui';
import { Check, ChevronDown, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BUNDLED_FONTS, fontStack, loadFont, type FontCategory } from '@/typography/fonts';
import { FONT_ACCEPT, FontImportError, useUserFonts } from '@/typography/user-fonts';
import type { UserFont } from '@/typography/user-font-types';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';

type Category = FontCategory | 'all' | 'yours';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'yours', label: 'Yours' },
  { id: 'sans', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'script', label: 'Script' },
  { id: 'mono', label: 'Mono' },
];

/** A font the person added: pick it, or remove it from this device (after a second tap). */
function UserFontRow({ font, selected, onPick }: { font: UserFont; selected: boolean; onPick: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useUserFonts((s) => s.remove);
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] leading-tight" style={{ fontFamily: fontStack(font.family) }}>
            {font.family}
          </span>
          <span className="block truncate text-[10.5px] text-fg-subtle">Yours · {font.fileName}</span>
        </span>
        {selected && <Check className="size-4 text-accent-text" />}
      </button>
      {confirming ? (
        <button
          type="button"
          onClick={() => {
            void remove(font.id).then(() =>
              toast({
                title: `${font.family} removed`,
                description: 'Designs using it now show a standard font.',
                duration: 3000,
              }),
            );
          }}
          onBlur={() => setConfirming(false)}
          className="h-8 shrink-0 rounded-md bg-danger px-2.5 text-[11px] font-semibold text-white"
        >
          Remove
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Remove ${font.family} from this device`}
          onClick={() => setConfirming(true)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-hover hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

/**
 * Picks from the bundled (offline) font library and the fonts the person added,
 * previewing each family in itself. Adding a font keeps its file on this device.
 */
export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [adding, setAdding] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const userFonts = useUserFonts((s) => s.fonts);
  const addFont = useUserFonts((s) => s.add);

  useEffect(() => {
    if (!open) return;
    for (const f of BUNDLED_FONTS) void loadFont(f.family, f.variable ? 600 : f.weights[0], 'normal');
    void useUserFonts
      .getState()
      .load()
      .then(() => {
        for (const f of useUserFonts.getState().fonts) void loadFont(f.family, 400, 'normal');
      });
  }, [open]);

  const q = query.trim().toLowerCase();
  const fonts = useMemo(
    () =>
      category === 'yours'
        ? []
        : BUNDLED_FONTS.filter(
            (f) =>
              (category === 'all' || f.category === category) &&
              (!q || f.family.toLowerCase().includes(q) || f.vibes.some((v) => v.includes(q))),
          ),
    [q, category],
  );
  const mine =
    category === 'all' || category === 'yours' ? userFonts.filter((f) => !q || f.family.toLowerCase().includes(q)) : [];

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setAdding(true);
    try {
      const { font, reused } = await addFont(file);
      onChange(font.family);
      setOpen(false);
      toast({
        title: reused ? `${font.family} is already on this device` : `Added ${font.family}`,
        description: reused ? undefined : 'The font stays on this device and travels with project files.',
        tone: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Couldn’t add that font',
        description: error instanceof FontImportError ? error.message : 'Try a TTF, OTF, WOFF or WOFF2 file.',
        tone: 'error',
      });
    } finally {
      setAdding(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Font: ${value}`}
          className="flex h-10 w-full items-center gap-2 rounded-md border border-line bg-bg-sunken px-3 text-left transition-colors hover:border-line-strong"
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
          aria-label="Choose a font"
          className="z-[70] flex max-h-[min(560px,80dvh)] w-[300px] animate-[pop-in_120ms_var(--ease-standard)] flex-col rounded-lg border border-line-strong bg-bg-elevated shadow-[var(--shadow-float)]"
        >
          <div className="border-b border-line p-3">
            <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-bg-sunken px-2.5 focus-within:border-ring">
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
                    'h-7 shrink-0 rounded-sm px-2.5 text-[11.5px] font-semibold transition-colors',
                    category === c.id ? 'bg-surface-active text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Fonts">
            {mine.map((f) => (
              <UserFontRow
                key={f.id}
                font={f}
                selected={f.family === value}
                onPick={() => {
                  onChange(f.family);
                  setOpen(false);
                }}
              />
            ))}
            {fonts.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  aria-pressed={f.family === value}
                  onClick={() => {
                    onChange(f.family);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
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
            {fonts.length === 0 && mine.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-fg-muted">
                {category === 'yours' && !q ? 'Fonts you add show up here.' : 'No fonts match.'}
              </li>
            )}
          </ul>
          <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5">
            <label
              className={cn(
                'flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line text-[12.5px] font-semibold transition-colors focus-within:border-ring hover:border-line-strong',
                adding && 'pointer-events-none opacity-60',
              )}
            >
              <Plus className="size-4" /> {adding ? 'Adding…' : 'Add a font from this device'}
              <input
                ref={input}
                type="file"
                accept={FONT_ACCEPT}
                className="sr-only"
                data-testid="font-upload"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
            </label>
            <p className="text-[11px] leading-snug text-fg-subtle">
              TTF, OTF, WOFF or WOFF2 · kept on this device. For Google Fonts,{' '}
              <a
                href="https://fonts.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-fg-muted underline-offset-2 hover:underline"
              >
                download a family <ExternalLink className="size-3" aria-hidden />
              </a>{' '}
              and add it here. {BUNDLED_FONTS.length} fonts are built in and work offline.
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
