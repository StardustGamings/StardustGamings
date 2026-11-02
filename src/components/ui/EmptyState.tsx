import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Default empty-state mark: an outlined slide stack with the accent spark. */
export function DeckIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-12 text-fg-subtle', className)} aria-hidden fill="none">
      <rect
        x="8"
        y="11"
        width="21"
        height="28"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
        transform="rotate(-9 18.5 25)"
      />
      <rect
        x="18"
        y="8"
        width="23"
        height="31"
        rx="3"
        fill="var(--bg)"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(5 29.5 23.5)"
      />
      <path d="M29.5 17.5c.3 2.6 1.4 3.7 4 4-2.6.3-3.7 1.4-4 4-.3-2.6-1.4-3.7-4-4 2.6-.3 3.7-1.4 4-4Z" fill="var(--accent)" />
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

/** Quiet, human empty state: a small mark, one line of title, one of help, one action. No box. */
export function EmptyState({ title, description, action, illustration, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-6 py-8' : 'gap-4 px-6 py-14',
        className,
      )}
    >
      {illustration ?? <DeckIllustration />}
      <div className="max-w-xs">
        <h3 className="text-heading">{title}</h3>
        {description && <p className="mt-1.5 text-caption">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
