import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'accent' | 'violet' | 'pink' | 'success' | 'warning' | 'danger' | 'soon';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-hover text-fg-muted border-line',
  accent: 'bg-accent/12 text-accent-text border-accent/25',
  // Former colour tones read as neutral labels: one accent in the chrome.
  violet: 'bg-surface-hover text-fg-muted border-line',
  pink: 'bg-surface-hover text-fg-muted border-line',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/25',
  soon: 'bg-transparent text-fg-subtle border-dashed border-line-strong',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-xs border px-1.5 text-[11px] leading-none font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Honest marker for features that aren't built yet. */
export function SoonBadge({ className, children = 'Soon' }: { className?: string; children?: ReactNode }) {
  return (
    <Badge tone="soon" className={className}>
      {children}
    </Badge>
  );
}
