'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode, Ref } from 'react';
import { cn } from '@/utils/cn';
import { Tooltip } from './Tooltip';

type Size = 'sm' | 'md' | 'lg';
const SIZES: Record<Size, string> = {
  sm: 'size-8 rounded-sm [&_svg]:size-4',
  md: 'size-10 rounded-md [&_svg]:size-5',
  lg: 'size-11 rounded-md [&_svg]:size-[22px]',
};

export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** Required: used for aria-label and the tooltip. */
  label: string;
  shortcut?: string;
  icon: ReactNode;
  size?: Size;
  variant?: 'ghost' | 'glass' | 'solid' | 'accent';
  active?: boolean;
  tooltip?: boolean;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS = {
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-hover',
  glass: 'bg-surface-strong border border-line text-fg hover:border-line-strong',
  solid: 'bg-surface-strong border border-line text-fg hover:border-line-strong',
  accent: 'bg-accent text-accent-fg hover:bg-accent-hover',
};

export function IconButton({
  label,
  shortcut,
  icon,
  size = 'md',
  variant = 'ghost',
  active = false,
  tooltip = true,
  tooltipSide,
  className,
  type = 'button',
  ref,
  ...rest
}: IconButtonProps) {
  const button = (
    <motion.button
      ref={ref}
      type={type}
      aria-label={label}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 700, damping: 32 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
        SIZES[size],
        VARIANTS[variant],
        active && 'bg-surface-active text-fg',
        className,
      )}
      {...rest}
    >
      {icon}
    </motion.button>
  );
  return tooltip ? (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
