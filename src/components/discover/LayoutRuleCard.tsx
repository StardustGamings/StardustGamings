'use client';

import { Images } from 'lucide-react';
import { FAMILY_LABELS } from '@/layouts/collage';
import { ruleStyleId } from '@/trends/pack';
import type { TrendLayoutRule } from '@/trends/schema';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';

/** A layout rule from the drop: a photo-dump recipe to run on your own photos (on this device). */
export function LayoutRuleCard({ rule }: { rule: TrendLayoutRule }) {
  const openPhotoFlow = useUi((s) => s.openPhotoFlow);
  const r = rule.rule;
  return (
    <article className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4" data-testid="layout-rule-card">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-bg-sunken text-2xl" aria-hidden>
          {rule.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-extrabold">{rule.name}</h3>
          <p className="line-clamp-2 text-xs text-fg-subtle">{rule.blurb}</p>
        </div>
        <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[10.5px] font-bold text-lime">🔥 {rule.heat}</span>
      </div>
      <ul className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-fg-muted">
        <li className="rounded-full border border-line px-2 py-0.5">{FAMILY_LABELS[r.collage.family]} collages</li>
        <li className="rounded-full border border-line px-2 py-0.5">{r.perSlide.join(' · ')} photos per slide</li>
        <li className="rounded-full border border-line px-2 py-0.5">“{r.title.text}”</li>
      </ul>
      <Button
        size="sm"
        icon={<Images className="size-4" />}
        onClick={() => openPhotoFlow('dump', 'new', undefined, ruleStyleId(rule.id))}
      >
        Try with my photos
      </Button>
    </article>
  );
}
