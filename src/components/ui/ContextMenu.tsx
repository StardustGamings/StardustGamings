'use client';

import { ContextMenu as C } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Kbd } from './Kbd';

export const ContextMenu = C.Root;
export const ContextMenuTrigger = C.Trigger;

export function ContextMenuContent({ children }: { children: ReactNode }) {
  return (
    <C.Portal>
      <C.Content
        collisionPadding={12}
        className="z-[70] min-w-[220px] animate-[pop-in_120ms_var(--ease-standard)] rounded-md border border-line-strong bg-bg-elevated p-1 shadow-[var(--shadow-float)]"
      >
        {children}
      </C.Content>
    </C.Portal>
  );
}

export function ContextMenuItem({
  children,
  icon,
  shortcut,
  destructive,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <C.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-[13px] outline-none select-none [&_svg]:size-4',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        destructive
          ? 'text-danger data-[highlighted]:bg-danger/12'
          : 'text-fg data-[highlighted]:bg-surface-hover [&_svg]:text-fg-muted',
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </C.Item>
  );
}

export const ContextMenuSeparator = () => <C.Separator className="mx-1 my-1 h-px bg-line" />;
