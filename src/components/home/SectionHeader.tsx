import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function SectionHeader({
  title,
  eyebrow,
  description,
  action,
  id,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-end gap-4', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-accent-text uppercase">{eyebrow}</p>}
        <h2 id={id} className="text-2xl font-extrabold sm:text-[28px]">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
