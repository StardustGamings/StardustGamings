'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { useClientValue } from '@/hooks/useClientValue';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';

function greetingFor(hour: number) {
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Page header for Home: who it's for, the tagline, and the two ways in. */
export function HomeHero() {
  const displayName = useSettings((s) => s.displayName);
  const openNewProject = useUi((s) => s.openNewProject);
  const greeting = useClientValue<string | null>(() => greetingFor(new Date().getHours()), null);

  return (
    <section
      aria-labelledby="hero-title"
      className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        <p className="h-4 text-meta" suppressHydrationWarning>
          {greeting ? `${greeting}${displayName ? `, ${displayName}` : ''}` : ''}
        </p>
        <h1 id="hero-title" className="mt-1.5 text-display">
          Create. Swipe. <span className="text-accent-text">Flex.</span>
        </h1>
        <p className="mt-2 max-w-md text-caption">
          Carousels, stories and covers, made on this device. Free, no watermarks, works offline.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="primary" onClick={() => openNewProject('carousel')} iconRight={<ArrowRight className="size-4" />}>
          New carousel
        </Button>
        <Link href="/templates/" className={buttonClasses({ variant: 'secondary' })}>
          Browse templates
        </Link>
      </div>
    </section>
  );
}
