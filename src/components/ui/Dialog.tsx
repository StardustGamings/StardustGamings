'use client';

import { motion } from 'motion/react';
import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import { IconButton } from './IconButton';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Max width on desktop. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Visually hide the title (still read by screen readers). */
  hideTitle?: boolean;
  className?: string;
  bodyClassName?: string;
}

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * Accessible modal (focus trap, Esc, scroll lock via Radix). Renders as a centred
 * card on larger screens and a swipe-down-to-close bottom sheet on phones.
 * Enter/exit animations are CSS keyframes keyed off Radix's data-state.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideTitle,
  className,
  bodyClassName,
}: DialogProps) {
  const phone = !useMediaQuery('(min-width: 640px)', true);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-[60] bg-[rgb(5_5_10/0.55)] backdrop-blur-[6px]" />
        {/* Centred with inset + auto margins (not transforms) so the CSS enter/exit
            animations are free to use transform. */}
        <D.Content
          className={cn(
            'anim-dialog fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[92dvh] w-full flex-col outline-none',
            'sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[88dvh] sm:w-[calc(100%-48px)]',
            WIDTHS[size],
          )}
        >
          <motion.div
            className={cn(
              'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-[28px] shadow-[var(--shadow-float)] glass-strong sm:rounded-[28px]',
              className,
            )}
            drag={phone ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
            }}
          >
            {phone && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" />}
            <div className={cn('flex items-start gap-4 px-6 pt-5', hideTitle && 'sr-only')}>
              <div className="min-w-0 flex-1">
                <D.Title className="font-display text-xl font-bold tracking-tight">{title}</D.Title>
                {description && <D.Description className="mt-1 text-sm text-fg-muted">{description}</D.Description>}
              </div>
              <D.Close asChild>
                <IconButton label="Close" icon={<X />} size="sm" tooltip={false} className="-mt-1 -mr-2" />
              </D.Close>
            </div>
            {!description && <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>}
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6', bodyClassName)}>{children}</div>
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 safe-bottom sm:flex-row sm:justify-end">
                {footer}
              </div>
            )}
          </motion.div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
