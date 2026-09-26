'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Spinner } from '@/components/ui/Spinner';
import { useTransfer } from './project-files';

/** A small progress pill for backups and imports (they can take a while with many photos). */
export function TransferStatus() {
  const label = useTransfer((s) => s.label);
  const progress = useTransfer((s) => s.progress);
  return (
    <AnimatePresence>
      {label && (
        <motion.div
          role="status"
          aria-live="polite"
          data-testid="transfer-status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-[var(--shadow-float)] glass-strong md:bottom-6"
        >
          <Spinner className="size-4 text-accent-text" label="" />
          <span>{label}</span>
          {progress !== null && (
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-active" aria-hidden>
              <span
                className="block h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
