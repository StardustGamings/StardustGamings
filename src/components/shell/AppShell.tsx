'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';

/** Chrome for dashboard pages; the editor renders full-bleed without it. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname.startsWith('/editor');

  return (
    <>
      <a
        href="#main"
        className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      {bare ? (
        <main id="main">{children}</main>
      ) : (
        <>
          <NavRail />
          <div className="md:pl-[76px]">
            <TopBar />
            <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pt-4 pb-28 sm:px-6 md:pb-16 lg:px-10">
              {children}
            </main>
          </div>
          <BottomNav />
        </>
      )}
    </>
  );
}
