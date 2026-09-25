'use client';

import { Grid3x3, ScanLine, Sparkles } from 'lucide-react';
import type { Fill } from '@/types/document';
import { FORMATS, ratioLabel } from '@/projects/formats';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { FillPicker } from './FillPicker';
import { selectDoc, useEditor } from './store';

function PanelSection({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0">
      <h3 className="font-sans text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">{title}</h3>
      {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function DocumentPanel() {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const showGrid = useEditor((s) => s.showGrid);
  const showSafeArea = useEditor((s) => s.showSafeArea);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const toggleSafeArea = useEditor((s) => s.toggleSafeArea);
  if (!doc || !meta) return null;
  const rows: [string, string][] = [
    ['Format', FORMATS[meta.format].label],
    ['Slide size', `${doc.slideWidth} × ${doc.slideHeight}`],
    ['Ratio', ratioLabel(doc.slideWidth, doc.slideHeight)],
    ['Slides', String(doc.slides.length)],
    ['Elements', String(doc.elements.length)],
  ];
  return (
    <>
      <PanelSection title="Canvas">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="text-right font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </PanelSection>
      <PanelSection title="Guides">
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <Grid3x3 className="size-4 text-fg-muted" /> Grid
            </span>
            <Switch checked={showGrid} onCheckedChange={toggleGrid} aria-label="Show grid" />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <ScanLine className="size-4 text-fg-muted" /> Safe areas
            </span>
            <Switch checked={showSafeArea} onCheckedChange={toggleSafeArea} aria-label="Show safe areas" />
          </label>
        </div>
      </PanelSection>
      <PanelSection title="Coming next">
        <div className="rounded-[16px] border border-dashed border-line-strong p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-accent-text" /> Canvas tools
            <Badge tone="soon">Soon</Badge>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
            Text, photos, shapes, stickers, snapping and multi-select land in the next update. Slides and backgrounds already work
            — and everything autosaves on this device.
          </p>
        </div>
      </PanelSection>
    </>
  );
}

export function BackgroundPanel() {
  const doc = useEditor(selectDoc);
  const activeSlide = useEditor((s) => s.activeSlide);
  const apply = useEditor((s) => s.apply);
  if (!doc) return null;
  const slide = doc.slides[activeSlide];
  const multi = doc.slides.length > 1;

  const setBackground = (fill: Fill) => apply((d) => ({ ...d, background: fill }));
  const setSlideFill = (fill: Fill | null) =>
    apply((d) => ({ ...d, slides: d.slides.map((s, i) => (i === activeSlide ? { ...s, fill } : s)) }));

  return (
    <>
      <PanelSection
        title={multi ? 'Whole carousel' : 'Background'}
        hint={multi ? 'Gradients flow seamlessly across every slide.' : undefined}
      >
        <FillPicker label="Canvas background" value={doc.background} onChange={setBackground} />
      </PanelSection>
      {multi && slide && (
        <PanelSection title={`Slide ${activeSlide + 1}`}>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Own background</span>
            <Switch
              checked={slide.fill !== null}
              onCheckedChange={(on) => setSlideFill(on ? { type: 'solid', color: '#0B0A12' } : null)}
              aria-label={`Custom background for slide ${activeSlide + 1}`}
            />
          </label>
          {slide.fill && (
            <div className="mt-4">
              <FillPicker label={`Slide ${activeSlide + 1} background`} value={slide.fill} onChange={setSlideFill} />
            </div>
          )}
        </PanelSection>
      )}
    </>
  );
}
