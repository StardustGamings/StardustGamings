'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { cn } from '@/utils/cn';
import { NAV_ITEMS } from './nav';
import { NewDropDot } from './NewDropDot';

/**
 * Phone navigation: a tab bar docked to the bottom edge with Create in the middle. The active
 * tab's icon sits in a soft pill that slides between tabs.
 */
export function BottomNav() {
  const pathname = usePathname();
  const openNewProject = useUi((s) => s.openNewProject);
  const defaultFormat = useSettings((s) => s.editor.defaultFormat);
  const items = NAV_ITEMS.filter((item) => item.phone);
  const [left, right] = [items.slice(0, 2), items.slice(2)];

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = item.match(pathname);
    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-150',
            active ? 'font-semibold text-fg' : 'font-medium text-fg-subtle',
          )}
        >
          <span className="relative flex h-7 w-14 items-center justify-center">
            {active && (
              <motion.span
                layoutId="bottom-active"
                className="absolute inset-0 rounded-full bg-surface-active"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <item.icon className="relative size-[21px]" />
          </span>
          {item.label}
          {item.trendDot && <NewDropDot className="top-2.5 right-[calc(50%-20px)]" />}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated safe-bottom md:hidden">
      <ul className="flex items-center px-1">
        {left.map(renderItem)}
        <li className="flex w-[68px] justify-center">
          <motion.button
            type="button"
            aria-label="New design"
            onClick={() => openNewProject(defaultFormat)}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 700, damping: 30 }}
            className="flex size-12 items-center justify-center rounded-[14px] bg-accent text-accent-fg"
          >
            <Plus className="size-6" style={{ strokeWidth: 2.25 }} />
          </motion.button>
        </li>
        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
