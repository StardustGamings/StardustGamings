'use client';

import { useTrends } from '@/trends/store';

/** A dot on Discover while a new trend drop is waiting to be seen. */
export function NewDropDot({ className = 'top-1.5 right-4' }: { className?: string }) {
  const drop = useTrends((s) => s.newDrop);
  if (!drop) return null;
  return (
    <span className={`absolute ${className} flex size-2 rounded-full bg-accent ring-2 ring-bg`} data-testid="new-drop-dot">
      <span className="sr-only">New: {drop.title}</span>
    </span>
  );
}
