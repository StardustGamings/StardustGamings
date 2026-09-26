'use client';

import { ImagePlus } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { resolveLook } from '@/filters/looks';
import { openPhotoPicker } from '../file-picker';
import { applyLook, lookTargets, setLookIntensity, type LookScope } from '../filter-actions';
import { selectDoc, useEditor } from '../store';
import { PercentSlider } from './FilterSections';
import { LookPicker, usePickerExtras } from './LookPicker';

/**
 * The Filters tool: one-tap looks for the selected photos — or, with no photo
 * selected, for every photo in the design at once (a consistent carousel).
 */
export function FiltersPanel() {
  const doc = useEditor(selectDoc);
  const selection = useEditor((s) => s.selection);
  const { scope, targets } = useMemo(() => {
    const selected = lookTargets('selection', doc);
    const scope: LookScope = selected.length ? 'selection' : 'all';
    return { scope, targets: scope === 'selection' ? selected : lookTargets('all', doc) };
    // `selection` is read inside lookTargets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, selection]);
  const extras = usePickerExtras(resolveLook(targets.find((t) => resolveLook(t.filter))?.filter));

  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" data-testid="filters-panel">
        <p className="text-sm font-semibold">No photos yet</p>
        <p className="text-[12.5px] leading-relaxed text-fg-muted">Filters work on photos. Add one, then pick a look.</p>
        <Button variant="primary" size="sm" icon={<ImagePlus className="size-4" />} onClick={() => openPhotoPicker()}>
          Add photos
        </Button>
      </div>
    );
  }

  const first = targets[0]!;
  const ids = new Set(targets.map((t) => (resolveLook(t.filter) ? t.filter!.id : null)));
  const value = ids.size === 1 ? [...ids][0]! : 'mixed';
  const withLook = targets.find((t) => resolveLook(t.filter));

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="filters-panel">
      <p className="text-[12.5px] text-fg-muted" aria-live="polite">
        {scope === 'selection'
          ? targets.length === 1
            ? 'Applies to the selected photo.'
            : `Applies to the ${targets.length} selected photos.`
          : targets.length === 1
            ? 'Applies to the photo in this design.'
            : `Applies to all ${targets.length} photos in this design.`}
      </p>
      <LookPicker
        assetId={first.assetId}
        value={value}
        onPick={(l) => applyLook(l, scope)}
        extra={extras.looks}
        extraLabel={extras.label}
      />
      {withLook && (
        <PercentSlider label="Intensity" value={withLook.filter?.intensity ?? 0} onChange={(v) => setLookIntensity(v, scope)} />
      )}
      <p className="text-[11.5px] leading-relaxed text-fg-subtle">
        Select a photo to fine-tune it: Filters, Adjust and Effects are in its Design tab. Hold “compare” there to see the
        original.
      </p>
    </div>
  );
}
