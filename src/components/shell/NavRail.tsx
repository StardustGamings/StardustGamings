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

/** Desktop / tablet navigation: a floating glass rail. */
export function NavRail() {
  const pathname = usePathname();
  const openNewProject = useUi((s) => s.openNewProject);
  const defaultFormat = useSettings((s) => s.editor.defaultFormat);

  return (
    <nav
      aria-label="Main"
      className="fixed top-4 bottom-4 left-4 z-40 hidden w-[84px] flex-col items-center rounded-[28px] py-5 shadow-[var(--shadow-lift)] glass md:flex"
    >
      <Link href="/" aria-label="Stardeck home" className="rounded-2xl p-1 transition-transform hover:scale-105">
        <LogoMark className="size-10" />
      </Link>

      <Tooltip content="New design" side="right">
        <motion.button
          type="button"
          onClick={() => openNewProject(defaultFormat)}
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          aria-label="New design"
          className="mt-6 flex size-12 items-center justify-center rounded-[18px] bg-accent text-accent-fg shadow-[var(--shadow-glow)]"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </motion.button>
      </Tooltip>

      <ul className="mt-6 flex flex-1 flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex w-[68px] flex-col items-center gap-1 rounded-[18px] py-2.5 text-[11px] font-semibold transition-colors',
                  active ? 'text-fg' : 'text-fg-subtle hover:text-fg',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="rail-active"
                    className="absolute inset-0 -z-10 rounded-[18px] bg-surface-active"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <item.icon
                  className={cn('size-[22px] transition-transform group-hover:scale-110', active && 'text-accent-text')}
                />
                {item.label}
                {item.trendDot && <NewDropDot />}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="px-2 text-center text-[9.5px] leading-tight font-semibold tracking-[0.12em] text-fg-subtle uppercase">
        Free
        <br />
        forever
      </p>
    </nav>
  );
}
