'use client';

import { Tooltip as T } from 'radix-ui';
import type { ReactNode } from 'react';
import { Kbd } from './Kbd';

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={350} skipDelayDuration={200}>
    {children}
  </T.Provider>
);

interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  disabled?: boolean;
}

export function Tooltip({ content, shortcut, side = 'top', children, disabled }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className="z-[80] flex animate-[pop-in_120ms_var(--ease-standard)] items-center gap-2 rounded-sm border border-line-strong bg-bg-elevated px-2 py-1 text-xs font-medium text-fg shadow-[var(--shadow-lift)]"
        >
          {content}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
