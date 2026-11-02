import { cn } from '@/utils/cn';

/** Kept free of 'use client' so server components (e.g. links) can reuse button styling. */
export type ButtonVariant = 'primary' | 'nova' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg font-semibold hover:bg-accent-hover',
  // "nova" was the gradient call-to-action; it now shares the primary look.
  nova: 'bg-accent text-accent-fg font-semibold hover:bg-accent-hover',
  secondary: 'bg-surface-strong border border-line text-fg hover:border-line-strong',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-hover',
  outline: 'border border-line-strong text-fg hover:bg-surface-hover',
  danger: 'bg-danger/10 text-danger hover:bg-danger/16 font-semibold',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-sm',
  md: 'h-10 px-4 text-[14px] gap-2 rounded-md',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-md',
};

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}): string {
  return cn(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium tracking-[-0.005em] transition-[background-color,border-color,color] duration-150',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
}
