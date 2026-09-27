import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'accent' | 'violet' | 'pink' | 'success' | 'warning' | 'danger' | 'soon';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-hover text-fg-muted border-line',
  accent: 'bg-accent/15 text-accent-text border-accent/25',
  violet: 'bg-violet/15 text-[#b794ff] border-violet/25 [[data-theme=light]_&]:text-[#5a32d6]',
  pink: 'bg-pink/15 text-pink border-pink/25 [[data-theme=light]_&]:text-[#c71f6f]',
  success: 'bg-success/15 text-success border-success/25',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/12 text-danger border-danger/25',
  soon: 'bg-transparent text-fg-subtle border-dashed border-line-strong',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[10.5px] font-semibold tracking-[0.06em] uppercase',
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
