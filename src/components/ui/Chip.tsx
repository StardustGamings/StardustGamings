import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Chip styling, shared by filter chips that need their own element (e.g. drop targets). */
export function chipClasses(active: boolean, className?: string) {
  return cn(
    'pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap',
    active ? 'bg-fg text-bg' : 'bg-surface-active text-fg-muted hover:text-fg',
    className,
  );
}

/** A toggle chip for filters: filled when on, quiet when off. */
export function Chip({
  active,
  children,
  className,
  ...rest
}: { active: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={active} className={chipClasses(active, className)} {...rest}>
      {children}
    </button>
  );
}
