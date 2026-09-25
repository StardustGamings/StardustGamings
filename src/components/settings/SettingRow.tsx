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
      className="scroll-mt-24 rounded-[28px] border border-line bg-surface p-5 sm:p-7"
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-accent/12 text-accent-text [&_svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${id}-title`} className="text-xl font-extrabold">
              {title}
            </h2>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
      </div>
      <div className="divide-y divide-line">{children}</div>
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
    <div className={cn('flex gap-4 py-4 first:pt-0 last:pb-0', stacked ? 'flex-col' : 'items-center justify-between', className)}>
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-semibold">
          {title}
        </p>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-[13px] text-fg-muted">
            {description}
          </p>
        )}
      </div>
      <div className={cn(stacked ? 'w-full' : 'shrink-0')}>
        {control({ labelId, descriptionId: description ? descriptionId : undefined })}
      </div>
    </div>
  );
}
