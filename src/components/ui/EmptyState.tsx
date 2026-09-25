import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Floating card stack used as a friendly default illustration. */
export function DeckIllustration({ className }: { className?: string }) {
  return (
    <div className={cn('relative h-28 w-36', className)} aria-hidden>
      <div className="motion-decorative absolute top-4 left-3 h-20 w-16 -rotate-12 animate-float rounded-2xl bg-gradient-to-br from-violet to-pink opacity-90 shadow-[var(--shadow-lift)] [animation-delay:-2s]" />
      <div className="motion-decorative absolute top-1 left-12 h-24 w-[72px] rotate-6 animate-float rounded-2xl bg-gradient-to-br from-lime to-mint shadow-[var(--shadow-lift)]" />
      <div className="motion-decorative absolute top-10 right-2 h-16 w-14 rotate-[18deg] animate-float rounded-2xl border border-line-strong bg-bg-elevated shadow-[var(--shadow-lift)] [animation-delay:-4s]" />
      <svg viewBox="0 0 24 24" className="motion-decorative absolute top-8 left-[68px] size-7 animate-spin-slow text-ink">
        <path d="M12 1c.8 6.4 3.6 9.2 10 10-6.4.8-9.2 3.6-10 10-.8-6.4-3.6-9.2-10-10 6.4-.8 9.2-3.6 10-10Z" fill="currentColor" />
      </svg>
    </div>
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
        'flex flex-col items-center justify-center rounded-[28px] border border-dashed border-line-strong text-center',
        compact ? 'gap-3 px-6 py-8' : 'gap-4 px-6 py-14',
        className,
      )}
    >
      {illustration ?? <DeckIllustration />}
      <div className="max-w-sm">
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
