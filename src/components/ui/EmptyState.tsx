import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Default empty-state mark: an outlined slide stack, quiet enough to sit beside any copy. */
export function DeckIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-12 text-fg-subtle', className)} aria-hidden fill="none">
      <rect
        x="7"
        y="11"
        width="22"
        height="28"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
        transform="rotate(-8 18 25)"
      />
      <rect x="17" y="8" width="24" height="31" rx="4" fill="var(--bg-elevated)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M29 17.5c.3 2.6 1.4 3.7 4 4-2.6.3-3.7 1.4-4 4-.3-2.6-1.4-3.7-4-4 2.6-.3 3.7-1.4 4-4Z" fill="var(--accent-text)" />
    </svg>
  );
}

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  illustration?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, action, illustration, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong text-center',
        compact ? 'gap-3 px-6 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      {illustration ?? <DeckIllustration />}
      <div className="max-w-sm">
        <h3 className="font-display text-subheading text-[16px]">{title}</h3>
        {description && <p className="mt-1 text-caption">{description}</p>}
      </div>
      {action}
    </div>
  );
}
