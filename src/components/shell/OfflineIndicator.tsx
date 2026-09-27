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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <Tooltip content="No connection — creating, editing and saving all keep working.">
            <span
              role="status"
              tabIndex={0}
              className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-warning/35 bg-warning/10 px-2 text-xs font-semibold text-warning"
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
