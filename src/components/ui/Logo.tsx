import { useId } from 'react';
import { cn } from '@/utils/cn';

/** Stardeck mark: a fanned deck of slides topped with a four-point spark. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  // Unique gradient ids: a duplicate id inside a hidden copy (e.g. the desktop rail on
  // phones) would otherwise make every other instance render without its gradients.
  const uid = useId().replace(/:/g, '');
  const front = `sd-front-${uid}`;
  const back = `sd-back-${uid}`;
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('size-8', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={front} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D8FF6B" />
          <stop offset="1" stopColor="#3CF0C8" />
        </linearGradient>
        <linearGradient id={back} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A06BFF" />
          <stop offset="1" stopColor="#FF5CAA" />
        </linearGradient>
      </defs>
      <rect x="6" y="7" width="19" height="24" rx="6" fill={`url(#${back})`} transform="rotate(-14 15.5 19)" opacity="0.9" />
      <rect x="13" y="8" width="20" height="25" rx="6.5" fill={`url(#${front})`} transform="rotate(8 23 20.5)" />
      <path
        d="M23.6 13.2c.5 3.6 1.7 4.8 5.3 5.3-3.6.5-4.8 1.7-5.3 5.3-.5-3.6-1.7-4.8-5.3-5.3 3.6-.5 4.8-1.7 5.3-5.3Z"
        fill="#0B0A12"
        transform="rotate(8 23 20.5)"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-8" />
      {!compact && (
        <span className="font-display text-[21px] leading-none font-extrabold tracking-[-0.045em] text-fg">stardeck</span>
      )}
    </span>
  );
}
