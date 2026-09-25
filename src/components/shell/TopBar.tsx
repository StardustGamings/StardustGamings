'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useUi } from '@/settings/ui-store';
import { useSettings } from '@/settings/store';
import { modKey } from '@/hooks/useHotkeys';
import { useClientValue } from '@/hooks/useClientValue';
import { Kbd } from '@/components/ui/Kbd';
import { Logo } from '@/components/ui/Logo';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';
import { OfflineIndicator } from './OfflineIndicator';

export function TopBar() {
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const displayName = useSettings((s) => s.displayName);
  const mod = useClientValue(modKey, 'Ctrl');
  const scrolled = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('scroll', onChange, { passive: true });
      return () => window.removeEventListener('scroll', onChange);
    },
    () => window.scrollY > 8,
    () => false,
  );

  const initial = (displayName.trim()[0] ?? '✦').toUpperCase();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled ? 'border-x-0 border-t-0 glass-strong' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="md:hidden" aria-label="Stardeck home">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="group hidden h-11 w-full max-w-md items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted md:flex"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search templates, actions, projects…</span>
          <Kbd>{mod} K</Kbd>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <OfflineIndicator />
          <IconButton
            label="Search"
            shortcut={`${mod} K`}
            icon={<Search />}
            className="md:hidden"
            onClick={() => setPaletteOpen(true)}
          />
          <Link
            href="/settings/"
            aria-label="Your local profile and settings"
            className="flex size-10 items-center justify-center rounded-full font-display text-sm font-extrabold text-ink ring-2 ring-transparent transition bg-nova hover:ring-line-strong"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
