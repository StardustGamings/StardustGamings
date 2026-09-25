import { cn } from '@/utils/cn';

/** Kept free of 'use client' so server components (e.g. links) can reuse button styling. */
export type ButtonVariant = 'primary' | 'nova' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg font-semibold hover:bg-accent-hover shadow-[0_1px_0_rgb(255_255_255/0.4)_inset,0_10px_30px_-10px_rgb(198_255_61/0.55)]',
  nova: 'bg-nova text-ink font-semibold shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_12px_34px_-12px_rgb(160_107_255/0.7)] hover:brightness-105',
  secondary: 'glass text-fg hover:bg-surface-hover',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-hover',
  outline: 'border border-line-strong text-fg hover:bg-surface-hover',
  danger: 'bg-danger/12 text-danger hover:bg-danger/20 font-semibold',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-[13px]',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-[16px]',
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
    'relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,color,box-shadow,filter] duration-200',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
}
