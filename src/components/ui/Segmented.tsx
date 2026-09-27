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
}

/** Single-choice control with a sliding highlight. Arrow keys move between options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  block,
  ...aria
}: SegmentedProps<T>) {
  const layoutId = useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      {...aria}
      className={cn('relative inline-flex rounded-md border border-line bg-bg-sunken p-0.5', block && 'flex w-full', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <ToggleGroup.Item
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            className={cn(
              'relative z-0 inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-sm border border-line bg-bg-elevated shadow-[var(--shadow-soft)]"
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              />
            )}
            {opt.icon}
            {opt.label}
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
