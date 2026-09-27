import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Section title with optional supporting line and a trailing action. */
export function SectionHeader({
  title,
  eyebrow,
  description,
  action,
  id,
  className,
}: {
  title: ReactNode;
  /** A short label above the title, for context that isn't obvious from it (e.g. which trend drop). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end gap-4', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-1 text-meta">{eyebrow}</p>}
        <h2 id={id} className="text-heading">
          {title}
        </h2>
        {description && <p className="mt-1 text-caption">{description}</p>}
      </div>
      {action}
    </div>
  );
}
