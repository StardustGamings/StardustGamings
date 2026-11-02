'use client';

import { motion } from 'motion/react';
import { ToggleGroup } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
  block?: boolean;
  /** `pill`: a compact control with a sliding highlight. `underline`: text tabs with a sliding rule, for switching views. */
  variant?: 'pill' | 'underline';
}

/** Single-choice control with a sliding indicator. Arrow keys move between options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  block,
  variant = 'pill',
  ...aria
}: SegmentedProps<T>) {
  const layoutId = useId();
  const underline = variant === 'underline';
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      {...aria}
      className={cn(
        'relative inline-flex',
        underline ? 'gap-5 border-b border-line' : 'rounded-md bg-surface-active p-[3px]',
        block && 'flex w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <ToggleGroup.Item
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            className={cn(
              'relative z-0 inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-40',
              underline
                ? 'h-10 shrink-0 text-[14px]'
                : cn('flex-1 rounded-sm', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-[34px] px-3 text-[13px]'),
              active ? 'text-fg' : underline ? 'text-fg-subtle hover:text-fg-muted' : 'text-fg-muted hover:text-fg',
            )}
          >
            {active &&
              (underline ? (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-fg"
                  transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                />
              ) : (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 -z-10 rounded-[7px] bg-surface-strong shadow-[var(--shadow-soft)]"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              ))}
            {opt.icon}
            {opt.label}
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
