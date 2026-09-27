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

/*
 * Whether the page has scrolled, read only in scroll events and animation frames: reading
 * scrollY from React's snapshot (checked after every render) would force a layout each time.
 */
let scrolledNow = false;
function subscribeScrolled(onChange: () => void) {
  const update = () => {
    const next = window.scrollY > 8;
    if (next === scrolledNow) return;
    scrolledNow = next;
    onChange();
  };
  const frame = requestAnimationFrame(update);
  window.addEventListener('scroll', update, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', update);
  };
}

export function TopBar() {
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const displayName = useSettings((s) => s.displayName);
  const mod = useClientValue(modKey, 'Ctrl');
  const scrolled = useSyncExternalStore(
    subscribeScrolled,
    () => scrolledNow,
    () => false,
  );

  const initial = (displayName.trim()[0] ?? 'S').toUpperCase();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b bg-bg transition-colors duration-200',
        scrolled ? 'border-line' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="md:hidden" aria-label="Stardeck home">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="group hidden h-9 w-full max-w-sm items-center gap-2.5 rounded-md border border-line bg-bg-sunken px-3 text-[13px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted md:flex"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search templates, actions, projects…</span>
          <Kbd>{mod} K</Kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
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
            className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface-active text-[13px] font-semibold text-fg transition-colors hover:border-fg-subtle"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
