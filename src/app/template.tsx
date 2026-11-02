'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { NAV_ITEMS } from '@/components/shell/nav';

/** Where a path sits in the tab order (-1 for pages outside the tabs, like the editor). */
const tabIndex = (path: string) => NAV_ITEMS.findIndex((item) => item.match(path));

// The page we came from, so the next page knows which way to move.
let previousPath: string | null = null;

/** How a page enters, from where we came from to where we are. */
function entranceFor(from: string | null, path: string) {
  if (path.startsWith('/editor')) return { opacity: 0, scale: 0.985 };
  if (from !== null && from !== path) {
    const a = tabIndex(from);
    const b = tabIndex(path);
    if (a >= 0 && b >= 0 && a !== b) return { opacity: 0, x: b > a ? 20 : -20 };
  }
  return { opacity: 0, y: 6 };
}

/**
 * Re-mounted on every navigation. Moving between tabs slides a short way in the direction of
 * travel; opening the editor rises and settles; anything else fades. Fast (≈240ms), and with
 * reduced motion only the fade remains (MotionConfig drops transforms).
 */
export default function Template({ children }: { children: ReactNode }) {
  const path = usePathname();
  // Decided once per mount; the module variable is updated after this page has taken its value.
  const [initial] = useState(() => {
    const value = entranceFor(previousPath, path);
    previousPath = path;
    return value;
  });

  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
