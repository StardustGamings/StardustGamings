import { cn } from '@/utils/cn';

/**
 * A contextual loading state: says what's happening ("Preparing your canvas…") with a small
 * deck of cards that shuffles while it waits. It never pretends to know how far along it is.
 */
export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-4 text-center', className)}>
      <span aria-hidden className="relative block h-9 w-8">
        <span className="loading-card absolute inset-0 rounded-[3px] border-[1.5px] border-fg-subtle" />
        <span className="loading-card loading-card-front absolute inset-0 rounded-[3px] bg-accent" />
      </span>
      <p className="text-caption">{label}</p>
    </div>
  );
}
