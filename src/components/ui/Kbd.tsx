import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-line bg-surface px-1.5 font-mono text-[10.5px] font-medium text-fg-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
