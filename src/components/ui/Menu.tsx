'use client';

import { DropdownMenu as M } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Kbd } from './Kbd';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'z-[70] min-w-[200px] animate-[pop-in_120ms_var(--ease-standard)] rounded-md border border-line-strong bg-bg-elevated p-1 shadow-[var(--shadow-float)]',
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  shortcut,
  destructive,
  onSelect,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
  onSelect?: (event: Event) => void;
  disabled?: boolean;
}) {
  return (
    <M.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-[13px] transition-colors outline-none select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-4',
        destructive
          ? 'text-danger data-[highlighted]:bg-danger/12'
          : 'text-fg data-[highlighted]:bg-surface-hover [&_svg]:text-fg-muted',
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </M.Item>
  );
}

export const MenuSeparator = () => <M.Separator className="mx-1 my-1 h-px bg-line" />;

export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <M.Label className="px-2 pt-1.5 pb-1 text-meta">{children}</M.Label>
);
