'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode, Ref } from 'react';
import { useMagnetic } from '@/hooks/useMagnetic';
import { mergeRefs } from '@/utils/refs';
import { Spinner } from './Spinner';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

export { buttonClasses };
export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Button subtly follows the pointer (desktop, full motion only). */
  magnetic?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  magnetic = false,
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  type = 'button',
  ref,
  style,
  onPointerMove,
  onPointerLeave,
  ...rest
}: ButtonProps) {
  const mag = useMagnetic<HTMLButtonElement>(0.22);
  return (
    <motion.button
      ref={mergeRefs(ref, mag.ref)}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12 }}
      style={magnetic ? { x: mag.x, y: mag.y, ...style } : style}
      onPointerMove={(e) => {
        if (magnetic) mag.onPointerMove(e);
        onPointerMove?.(e);
      }}
      onPointerLeave={(e) => {
        if (magnetic) mag.onPointerLeave();
        onPointerLeave?.(e);
      }}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {iconRight}
    </motion.button>
  );
}
