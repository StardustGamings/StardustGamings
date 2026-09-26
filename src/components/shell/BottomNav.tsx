'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { cn } from '@/utils/cn';
import { NAV_ITEMS } from './nav';

/** Phone navigation: floating tab bar with a centre create button. */
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
            'relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors',
            active ? 'text-fg' : 'text-fg-subtle',
          )}
        >
          {active && (
            <motion.span
              layoutId="bottom-active"
              className="absolute top-1.5 h-1 w-5 rounded-full bg-accent"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <item.icon className="size-[22px]" />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 md:hidden">
      <ul className="flex items-center rounded-[26px] px-2 shadow-[var(--shadow-float)] glass-strong">
        {left.map(renderItem)}
        <li className="flex w-16 justify-center">
          <motion.button
            type="button"
            aria-label="New design"
            onClick={() => openNewProject(defaultFormat)}
            whileTap={{ scale: 0.88, rotate: 90 }}
            className="-mt-6 flex size-14 items-center justify-center rounded-[20px] bg-accent text-accent-fg shadow-[var(--shadow-glow)]"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </motion.button>
        </li>
        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
