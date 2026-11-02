import { cn } from '@/utils/cn';

/**
 * Stardeck mark: two cards from a deck, the front one in the accent with a four-point spark cut
 * out of it. Flat colours from the theme, so it sits right on paper and on ink.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('size-8', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <rect x="6.5" y="7.5" width="18" height="24" rx="3.5" fill="var(--fg)" transform="rotate(-11 15.5 19.5)" />
      <rect x="14" y="8" width="19.5" height="25.5" rx="3.5" fill="var(--accent)" transform="rotate(7 23.75 20.75)" />
      <path
        d="M23.9 14.2c.45 3.3 1.55 4.4 4.85 4.85-3.3.45-4.4 1.55-4.85 4.85-.45-3.3-1.55-4.4-4.85-4.85 3.3-.45 4.4-1.55 4.85-4.85Z"
        fill="var(--bg)"
        transform="rotate(7 23.75 20.75)"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-7" />
      {!compact && <span className="font-display text-[25px] leading-none tracking-[-0.01em] text-fg">Stardeck</span>}
    </span>
  );
}
