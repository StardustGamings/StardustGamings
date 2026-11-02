import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * A settings group in the native mobile pattern: a small-caps label, the rows in one inset
 * group, and the explanation as a footnote underneath.
 */
export function SettingsSection({
  id,
  title,
  description,
  badge,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  /** Kept for the section nav; groups themselves don't show icons. */
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="mb-2 flex items-center gap-2 px-1">
        <h2 id={`${id}-title`} className="text-label">
          {title}
        </h2>
        {badge}
      </div>
      <div className="divide-y divide-line rounded-lg border border-line bg-surface px-4">{children}</div>
      {description && <p className="mt-2 px-1 text-[12.5px] leading-snug text-fg-subtle">{description}</p>}
    </section>
  );
}

/** One labelled setting. `control` receives the ids needed to label it accessibly. */
export function SettingRow({
  title,
  description,
  control,
  stacked = false,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  control: (ids: { labelId: string; descriptionId?: string }) => ReactNode;
  stacked?: boolean;
  className?: string;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div
      className={cn(
        'flex min-h-[56px] py-3',
        stacked ? 'flex-col gap-3' : 'flex-wrap items-center justify-between gap-x-4 gap-y-2.5',
        className,
      )}
    >
      <div className={cn('min-w-0', !stacked && 'flex-[1_1_220px]')}>
        <p id={labelId} className="text-[15px] font-medium tracking-[-0.01em]">
          {title}
        </p>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-[13px] leading-snug text-fg-muted">
            {description}
          </p>
        )}
      </div>
      <div className={cn(stacked ? 'w-full' : '-m-1 hide-scrollbar max-w-[calc(100%+8px)] shrink-0 overflow-x-auto p-1')}>
        {control({ labelId, descriptionId: description ? descriptionId : undefined })}
      </div>
    </div>
  );
}
