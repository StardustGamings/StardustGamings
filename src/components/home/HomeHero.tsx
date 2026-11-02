'use client';

import { useSettings } from '@/settings/store';
import { useClientValue } from '@/hooks/useClientValue';
import { cn } from '@/utils/cn';

function greetingFor(hour: number) {
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Snapshots must be stable between reads, so each is a plain string.
const greetingNow = () => greetingFor(new Date().getHours());
const dateNow = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** Home header: today's date and a greeting. The work below is the focus, so no pitch. */
export function HomeHero() {
  const displayName = useSettings((s) => s.displayName).trim();
  const greeting = useClientValue<string | null>(greetingNow, null);
  const date = useClientValue<string | null>(dateNow, null);

  return (
    <header className="pt-2 pb-7 sm:pt-4 sm:pb-9">
      <p className="h-3.5 text-label" suppressHydrationWarning>
        {date ?? ''}
      </p>
      <h1 id="hero-title" className={cn('mt-2.5 text-display', !greeting && 'invisible')} suppressHydrationWarning>
        {greeting ?? 'Hello'}
        {displayName ? (
          <>
            , <em className="text-accent-text">{displayName}</em>.
          </>
        ) : (
          '.'
        )}
      </h1>
    </header>
  );
}
