'use client';

import { motion, useDragControls } from 'motion/react';
import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUi } from '@/settings/ui-store';
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
 * card on larger screens and a bottom sheet on phones: drag the handle or the title
 * down to close it (the body still scrolls normally).
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
  const drag = useDragControls();
  // Closing because the editor is opening: skip the exit animation (the page is changing anyway).
  const instant = useUi((s) => s.openingEditor);
  const startDrag = (e: React.PointerEvent) => {
    if (phone && !(e.target as HTMLElement).closest('button')) drag.start(e);
  };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={cn('anim-overlay fixed inset-0 z-[60] scrim', instant && 'data-[state=closed]:animate-none!')} />
        {/* Centred with inset + auto margins (not transforms) so the CSS enter/exit
            animations are free to use transform. */}
        <D.Content
          className={cn(
            'anim-dialog fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[92dvh] w-full flex-col outline-none',
            instant && 'data-[state=closed]:animate-none!',
            'sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[88dvh] sm:w-[calc(100%-48px)]',
            WIDTHS[size],
          )}
        >
          <motion.div
            className={cn(
              'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-xl border border-b-0 border-line bg-bg-elevated shadow-[var(--shadow-sheet)] sm:rounded-xl sm:border-b sm:shadow-[var(--shadow-float)]',
              className,
            )}
            drag={phone ? 'y' : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 550) onOpenChange(false);
            }}
          >
            <div className="shrink-0 touch-none" onPointerDown={startDrag}>
              {phone && <div aria-hidden className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-line-strong" />}
              <div className={cn('flex items-start gap-4 px-5 pt-4 sm:px-6 sm:pt-6', hideTitle && 'sr-only')}>
                <div className="min-w-0 flex-1">
                  <D.Title className="text-heading">{title}</D.Title>
                  {description && <D.Description className="mt-1.5 text-caption">{description}</D.Description>}
                </div>
                <D.Close asChild>
                  <IconButton label="Close" icon={<X />} size="sm" tooltip={false} className="-mt-0.5 -mr-2 text-fg-muted" />
                </D.Close>
              </div>
            </div>
            {!description && <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>}
            <div
              className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5 sm:px-6 sm:pb-6', bodyClassName)}
            >
              {children}
            </div>
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-line bg-bg-elevated px-5 py-3.5 safe-bottom sm:flex-row sm:justify-end sm:px-6 [&>button]:max-sm:h-12">
                {footer}
              </div>
            )}
          </motion.div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
