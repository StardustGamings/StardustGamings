'use client';

import { Grid3x3, Magnet, Ruler, ScanLine } from 'lucide-react';
import type { Fill } from '@/types/document';
import { FORMATS, ratioLabel } from '@/projects/formats';
import { Switch } from '@/components/ui/Switch';
import { FillPicker } from '../FillPicker';
import { selectDoc, useEditor } from '../store';
import { Section } from './fields';
import { useDocColors } from './useSelection';

export function DocumentPanel() {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const showGrid = useEditor((s) => s.showGrid);
  const showSafeArea = useEditor((s) => s.showSafeArea);
  const showRulers = useEditor((s) => s.showRulers);
  const snapping = useEditor((s) => s.snapping);
  const editor = useEditor.getState();
  if (!doc || !meta) return null;
  const rows: [string, string][] = [
    ['Format', FORMATS[meta.format].label],
    ['Slide size', `${doc.slideWidth} × ${doc.slideHeight}`],
    ['Ratio', ratioLabel(doc.slideWidth, doc.slideHeight)],
    ['Slides', String(doc.slides.length)],
    ['Layers', String(doc.elements.length)],
  ];
  const toggles = [
    { label: 'Snapping', icon: Magnet, on: snapping, toggle: editor.toggleSnapping },
    { label: 'Grid', icon: Grid3x3, on: showGrid, toggle: editor.toggleGrid },
    { label: 'Rulers & guides', icon: Ruler, on: showRulers, toggle: editor.toggleRulers },
    { label: 'Safe areas', icon: ScanLine, on: showSafeArea, toggle: editor.toggleSafeArea },
  ];
  return (
    <>
      <Section title="Canvas">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="text-right font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="View">
        {toggles.map((t) => (
          <label key={t.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <t.icon className="size-4 text-fg-muted" /> {t.label}
            </span>
            <Switch checked={t.on} onCheckedChange={t.toggle} aria-label={t.label} />
          </label>
        ))}
      </Section>
      <Section title="Tips">
        <ul className="list-inside list-disc space-y-1 text-[12.5px] text-fg-muted">
          <li>Double-click text to edit it in place.</li>
          <li>Hold Space (or use two fingers) to pan; ⌘/Ctrl + scroll or pinch to zoom.</li>
          <li>Alt-drag duplicates; Shift constrains; hold ⌘/Ctrl to skip snapping.</li>
          <li>Drag from the rulers to place guides.</li>
        </ul>
      </Section>
    </>
  );
}

export function BackgroundPanel() {
  const doc = useEditor(selectDoc);
  const activeSlide = useEditor((s) => s.activeSlide);
  const apply = useEditor((s) => s.apply);
  const docColors = useDocColors();
  if (!doc) return null;
  const slide = doc.slides[activeSlide];
  const multi = doc.slides.length > 1;

  const setBackground = (fill: Fill) => apply((d) => ({ ...d, background: fill }), { coalesce: 'bg' });
  const setSlideFill = (fill: Fill | null) =>
    apply((d) => ({ ...d, slides: d.slides.map((s, i) => (i === activeSlide ? { ...s, fill } : s)) }), {
      coalesce: `slide-bg:${activeSlide}`,
    });

  return (
    <div data-testid="background-panel">
      <Section title={multi ? 'Whole carousel' : 'Background'}>
        {multi && <p className="-mt-1 text-xs text-fg-muted">Gradients flow seamlessly across every slide.</p>}
        <FillPicker label="Canvas background" value={doc.background} onChange={setBackground} docColors={docColors} />
      </Section>
      {multi && slide && (
        <Section title={`Slide ${activeSlide + 1}`}>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Own background</span>
            <Switch
              checked={slide.fill !== null}
              onCheckedChange={(on) => setSlideFill(on ? { type: 'solid', color: '#0B0A12' } : null)}
              aria-label={`Custom background for slide ${activeSlide + 1}`}
            />
          </label>
          {slide.fill && (
            <FillPicker
              label={`Slide ${activeSlide + 1} background`}
              value={slide.fill}
              onChange={setSlideFill}
              docColors={docColors}
            />
          )}
        </Section>
      )}
    </div>
  );
}
