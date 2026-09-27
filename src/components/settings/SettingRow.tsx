import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function SettingsSection({
  id,
  title,
  description,
  icon,
  badge,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  icon: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 border-t border-line pt-6 first:border-t-0 first:pt-0"
    >
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-fg-subtle [&_svg]:size-4" aria-hidden>
            {icon}
          </span>
          <h2 id={`${id}-title`} className="text-heading">
            {title}
          </h2>
          {badge}
        </div>
        {description && <p className="mt-1 text-caption">{description}</p>}
      </div>
      <div className="divide-y divide-line rounded-lg border border-line bg-surface px-4">{children}</div>
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
        'flex py-3.5',
        stacked ? 'flex-col gap-3' : 'flex-wrap items-center justify-between gap-x-4 gap-y-2.5',
        className,
      )}
    >
      <div className={cn('min-w-0', !stacked && 'flex-[1_1_220px]')}>
        <p id={labelId} className="text-sm font-medium">
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
