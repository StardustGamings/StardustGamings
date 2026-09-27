'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { LogoMark } from '@/components/ui/Logo';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { NAV_ITEMS } from './nav';
import { NewDropDot } from './NewDropDot';

/** Desktop / tablet navigation: a slim rail flush with the left edge. */
export function NavRail() {
  const pathname = usePathname();
  const openNewProject = useUi((s) => s.openNewProject);
  const defaultFormat = useSettings((s) => s.editor.defaultFormat);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-line bg-bg md:flex"
    >
      <Link href="/" aria-label="Stardeck home" className="mt-3 flex size-10 items-center justify-center rounded-md">
        <LogoMark className="size-8" />
      </Link>

      <Tooltip content="New design" side="right">
        <motion.button
          type="button"
          onClick={() => openNewProject(defaultFormat)}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.1 }}
          aria-label="New design"
          className="mt-5 flex size-10 items-center justify-center rounded-md bg-accent text-accent-fg transition-colors hover:bg-accent-hover"
        >
          <Plus className="size-5" strokeWidth={2.25} />
        </motion.button>
      </Tooltip>

      <ul className="mt-5 flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex w-[60px] flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-fg' : 'text-fg-subtle hover:bg-surface-hover hover:text-fg',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="rail-active"
                    className="absolute inset-0 -z-10 rounded-md bg-surface-active"
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                  />
                )}
                <item.icon className="size-5" strokeWidth={active ? 2.1 : 1.8} />
                {item.label}
                {item.trendDot && <NewDropDot className="top-1.5 right-3.5" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
