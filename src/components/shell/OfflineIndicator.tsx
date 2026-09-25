'use client';

import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';
import { Tooltip } from '@/components/ui/Tooltip';

export function OfflineIndicator() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Tooltip content="No connection — creating, editing and saving all keep working.">
            <span
              role="status"
              tabIndex={0}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/12 px-3 text-xs font-semibold text-warning"
            >
              <WifiOff className="size-3.5" aria-hidden />
              Offline Mode
            </span>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
