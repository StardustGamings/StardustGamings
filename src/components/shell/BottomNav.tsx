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

/** Phone navigation: a tab bar docked to the bottom edge, with Create in the middle. */
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
            'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
            active ? 'text-fg' : 'text-fg-subtle',
          )}
        >
          <item.icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.8} />
          {item.label}
          {active && (
            <motion.span
              layoutId="bottom-active"
              className="absolute top-0 h-0.5 w-6 rounded-full bg-accent"
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            />
          )}
          {item.trendDot && <NewDropDot className="top-2 right-[calc(50%-18px)]" />}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated safe-bottom md:hidden">
      <ul className="flex items-center px-1">
        {left.map(renderItem)}
        <li className="flex w-16 justify-center">
          <motion.button
            type="button"
            aria-label="New design"
            onClick={() => openNewProject(defaultFormat)}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-fg"
          >
            <Plus className="size-6" strokeWidth={2.25} />
          </motion.button>
        </li>
        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
