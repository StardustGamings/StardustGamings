'use client';

import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Group,
  Italic,
  Lock,
  Plus,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import type { DesignElement, ShapeElement, TextElement } from '@/types/document';
import { slideIndexOf } from '@/projects/document';
import { findBundledFont, supportedWeight } from '@/typography/fonts';
import { useTrends } from '@/trends/store';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/utils/cn';
import * as actions from '../actions';
import { TEXT_PRESETS } from '../core/factory';
import { elementLabel, fitTextHeight, scaleElementContent } from '../core/ops';
import { selectDoc, useEditor } from '../store';
import { ActionButton, FillField, IconToggle, NumberField, Row, Section } from './fields';
import { FontPicker } from './FontPicker';
import { ElementIcon } from './ElementIcon';
import { ImageSections } from './ImagePanels';
import { CutoutSection } from './CutoutSection';
import { LayoutSection } from './LayoutSection';
import { getLayout } from '@/layouts/apply';
import { updateSelection, useSelectedElements } from './useSelection';

const refit = (el: DesignElement): DesignElement => (el.type === 'text' ? fitTextHeight(el) : el);

function Header({ els }: { els: DesignElement[] }) {
  const single = els.length === 1 ? els[0]! : null;
  const allLocked = els.every((e) => e.locked);
  const allHidden = els.every((e) => e.hidden);
  const grouped = els.some((e) => e.groupId);
  return (
    <Section title={single ? 'Selected' : `${els.length} selected`}>
      {single && (
        <p className="-mt-1 flex items-center gap-2 truncate text-sm font-semibold">
          <ElementIcon el={single} className="size-4 shrink-0 text-fg-muted" />
          <span className="truncate">{elementLabel(single)}</span>
        </p>
      )}
      <div className="flex gap-1.5">
        <ActionButton label="Duplicate" onClick={actions.duplicateSelection}>
          <Copy />
        </ActionButton>
        <ActionButton label="Bring forward" onClick={() => actions.reorder('forward')}>
          <ArrowUp />
        </ActionButton>
        <ActionButton label="Send backward" onClick={() => actions.reorder('backward')}>
          <ArrowDown />
        </ActionButton>
        {els.length > 1 && !grouped && (
          <ActionButton label="Group" onClick={actions.groupSelection}>
            <Group />
          </ActionButton>
        )}
        {grouped && (
          <ActionButton label="Ungroup" onClick={actions.ungroupSelection}>
            <Ungroup />
          </ActionButton>
        )}
        <ActionButton label={allLocked ? 'Unlock' : 'Lock'} onClick={actions.toggleLock}>
          {allLocked ? <Unlock /> : <Lock />}
        </ActionButton>
        <ActionButton label={allHidden ? 'Show' : 'Hide'} onClick={actions.toggleHidden}>
          {allHidden ? <Eye /> : <EyeOff />}
        </ActionButton>
        <ActionButton label="Delete" onClick={actions.deleteSelection}>
          <Trash2 />
        </ActionButton>
      </div>
    </Section>
  );
}

function Arrange({ count }: { count: number }) {
  const units = count;
  return (
    <Section title={units > 1 ? 'Align to selection' : 'Align to slide'}>
      <div className="flex gap-1.5">
        <ActionButton label="Align left" onClick={() => actions.alignSelection('left')}>
          <AlignStartVertical />
        </ActionButton>
        <ActionButton label="Align centre" onClick={() => actions.alignSelection('center')}>
          <AlignCenterVertical />
        </ActionButton>
        <ActionButton label="Align right" onClick={() => actions.alignSelection('right')}>
          <AlignEndVertical />
        </ActionButton>
        <ActionButton label="Align top" onClick={() => actions.alignSelection('top')}>
          <AlignStartHorizontal />
        </ActionButton>
        <ActionButton label="Align middle" onClick={() => actions.alignSelection('middle')}>
          <AlignCenterHorizontal />
        </ActionButton>
        <ActionButton label="Align bottom" onClick={() => actions.alignSelection('bottom')}>
          <AlignEndHorizontal />
        </ActionButton>
      </div>
      {count >= 3 && (
        <div className="flex gap-1.5">
          <ActionButton label="Distribute horizontally" onClick={() => actions.distributeSelection('x')}>
            <AlignHorizontalSpaceAround />
          </ActionButton>
          <ActionButton label="Distribute vertically" onClick={() => actions.distributeSelection('y')}>
            <AlignVerticalSpaceAround />
          </ActionButton>
        </div>
      )}
    </Section>
  );
}

function Transform({ el }: { el: DesignElement }) {
  const doc = useEditor(selectDoc)!;
  const slide = slideIndexOf(el, doc);
  const offset = slide * doc.slideWidth;
  const isText = el.type === 'text';
  return (
    <Section title="Position & size">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={el.x - offset} onChange={(v) => updateSelection('x', (e) => ({ ...e, x: v + offset }))} />
        <NumberField label="Y" value={el.y} onChange={(v) => updateSelection('y', (e) => ({ ...e, y: v }))} />
        <NumberField
          label="Width"
          glyph="W"
          value={el.width}
          min={4}
          onChange={(v) =>
            updateSelection('w', (e) => refit(e.type === 'sticker' ? { ...e, width: v, height: v } : { ...e, width: v }))
          }
        />
        <NumberField
          label="Height"
          glyph="H"
          value={el.height}
          min={4}
          onChange={(v) =>
            !isText && updateSelection('h', (e) => (e.type === 'sticker' ? { ...e, width: v, height: v } : { ...e, height: v }))
          }
          className={cn(isText && 'pointer-events-none opacity-50')}
        />
        <NumberField
          label="Rotation"
          glyph="°"
          value={el.rotation}
          min={-180}
          max={180}
          onChange={(v) => updateSelection('rot', (e) => ({ ...e, rotation: v }))}
        />
        <NumberField
          label="Opacity"
          glyph="α"
          value={Math.round(el.opacity * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => updateSelection('opacity', (e) => ({ ...e, opacity: v / 100 }))}
        />
      </div>
    </Section>
  );
}

function weightOptions(family: string): number[] {
  const font = findBundledFont(family);
  if (!font) return [400, 700];
  if (!font.variable) return font.weights;
  const [min, max] = [font.weights[0]!, font.weights[font.weights.length - 1]!];
  const out: number[] = [];
  for (let w = Math.ceil(min / 100) * 100; w <= max; w += 100) out.push(w);
  return out;
}

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'Extra light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Extra bold',
  900: 'Black',
};

function TextSection({ el }: { el: TextElement }) {
  const pairings = useTrends((s) => s.pack.typography);
  const font = findBundledFont(el.fontFamily);
  const hasItalic = !font || font.styles.includes('italic');
  const set = (key: string, patch: Partial<TextElement>) =>
    updateSelection(key, (e) => (e.type === 'text' ? fitTextHeight({ ...e, ...patch }) : e));
  const pairs = pairings
    .filter((p) => p.heading.family === el.fontFamily || p.body.family === el.fontFamily)
    .map((p) => (p.heading.family === el.fontFamily ? p.body : p.heading))
    .filter((spec, i, arr) => arr.findIndex((s) => s.family === spec.family) === i)
    .slice(0, 3);

  return (
    <>
      <Section title="Text">
        <select
          aria-label="Apply a text style"
          value=""
          onChange={(e) => {
            const preset = TEXT_PRESETS.find((p) => p.id === e.target.value);
            if (!preset) return;
            updateSelection('preset', (x) => {
              if (x.type !== 'text') return x;
              const { fill, shadow, stroke, highlight, ...style } = preset.style;
              const scale = x.fontSize / 100;
              return fitTextHeight({
                ...x,
                ...style,
                fontWeight: supportedWeight(style.fontFamily, style.fontWeight ?? x.fontWeight),
                fill: preset.fixedColors && fill ? fill : x.fill,
                shadow: shadow ? { ...shadow, x: shadow.x * scale, y: shadow.y * scale, blur: shadow.blur * scale } : undefined,
                stroke: stroke ? { ...stroke, width: Math.max(2, x.fontSize * 0.06) } : undefined,
                highlight: highlight ? { ...highlight, padding: x.fontSize * 0.45, radius: x.fontSize * 0.55 } : undefined,
              });
            });
          }}
          className="h-10 w-full rounded-[10px] border border-line bg-bg-sunken/70 px-2.5 text-[13px] outline-none focus:border-ring"
        >
          <option value="">Apply a style…</option>
          {TEXT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <FontPicker
          value={el.fontFamily}
          onChange={(family) =>
            updateSelection('font', (e) =>
              e.type === 'text'
                ? fitTextHeight({
                    ...e,
                    fontFamily: family,
                    fontWeight: supportedWeight(family, e.fontWeight),
                    fontStyle: findBundledFont(family)?.styles.includes('italic') ? e.fontStyle : 'normal',
                  })
                : e,
            )
          }
        />
        <div className="flex gap-2">
          <select
            aria-label="Font weight"
            value={el.fontWeight}
            onChange={(e) => set('weight', { fontWeight: Number(e.target.value) })}
            className="h-9 min-w-0 flex-1 rounded-[10px] border border-line bg-bg-sunken/70 px-2 text-[13px] outline-none focus:border-ring"
          >
            {weightOptions(el.fontFamily).map((w) => (
              <option key={w} value={w}>
                {WEIGHT_NAMES[w] ?? w}
              </option>
            ))}
          </select>
          <IconToggle
            label="Italic"
            pressed={el.fontStyle === 'italic'}
            onClick={() => hasItalic && set('italic', { fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}
          >
            <Italic />
          </IconToggle>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Font size"
            glyph="Aa"
            value={el.fontSize}
            min={4}
            max={2000}
            onChange={(v) =>
              updateSelection('size', (e) =>
                e.type === 'text' ? fitTextHeight({ ...scaleElementContent(e, v / e.fontSize), fontSize: v }) : e,
              )
            }
          />
          <NumberField
            label="Line height"
            glyph="↕"
            value={el.lineHeight}
            min={0.5}
            max={4}
            step={0.05}
            precision={2}
            onChange={(v) => set('lh', { lineHeight: v })}
          />
          <NumberField
            label="Letter spacing"
            glyph="↔"
            value={Math.round(el.letterSpacing * 100)}
            min={-20}
            max={100}
            suffix="%"
            onChange={(v) => set('ls', { letterSpacing: v / 100 })}
          />
        </div>
        <div className="flex gap-1.5">
          <IconToggle label="Align left" pressed={el.align === 'left'} onClick={() => set('align', { align: 'left' })}>
            <AlignLeft />
          </IconToggle>
          <IconToggle label="Align centre" pressed={el.align === 'center'} onClick={() => set('align', { align: 'center' })}>
            <AlignCenter />
          </IconToggle>
          <IconToggle label="Align right" pressed={el.align === 'right'} onClick={() => set('align', { align: 'right' })}>
            <AlignRight />
          </IconToggle>
          <span className="w-1" />
          <IconToggle
            label="Normal case"
            pressed={!el.textTransform || el.textTransform === 'none'}
            onClick={() => set('tt', { textTransform: 'none' })}
          >
            Aa
          </IconToggle>
          <IconToggle
            label="Uppercase"
            pressed={el.textTransform === 'uppercase'}
            onClick={() => set('tt', { textTransform: 'uppercase' })}
          >
            AA
          </IconToggle>
          <IconToggle
            label="Lowercase"
            pressed={el.textTransform === 'lowercase'}
            onClick={() => set('tt', { textTransform: 'lowercase' })}
          >
            aa
          </IconToggle>
        </div>
        <Row label="Colour">
          <FillField
            label="Text colour"
            value={el.fill}
            onChange={(fill) => fill && updateSelection('fill', (e) => (e.type === 'text' ? { ...e, fill } : e))}
          />
        </Row>
        {pairs.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] text-fg-muted">Pairs well with</p>
            <div className="flex flex-wrap gap-1.5">
              {pairs.map((p) => (
                <button
                  key={p.family}
                  type="button"
                  onClick={() => {
                    const d = selectDoc(useEditor.getState());
                    if (!d) return;
                    const body = TEXT_PRESETS.find((x) => x.id === 'body')!;
                    const added = actions.addText(
                      {
                        ...body,
                        style: {
                          ...body.style,
                          fontFamily: p.family,
                          fontWeight: p.weight,
                          fontStyle: p.style ?? 'normal',
                          textTransform: p.transform,
                        },
                      },
                      { x: el.x + el.width / 2, y: el.y + el.height + d.slideWidth * 0.06 },
                      { text: 'Pair it with a supporting line' },
                    );
                    return added;
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] transition-colors hover:border-accent"
                  title={`Add a text box in ${p.family}`}
                >
                  <Plus className="size-3" />
                  {p.family}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>
      <Section
        title="Outline"
        action={
          <Switch
            checked={Boolean(el.stroke)}
            aria-label="Text outline"
            onCheckedChange={(on) =>
              set('stroke-on', { stroke: on ? { color: '#0B0A12', width: Math.max(2, el.fontSize * 0.05) } : undefined })
            }
          />
        }
      >
        {el.stroke && (
          <div className="flex gap-2">
            <FillField
              label="Outline colour"
              solidOnly
              value={{ type: 'solid', color: el.stroke.color }}
              onChange={(f) => f?.type === 'solid' && set('stroke-color', { stroke: { ...el.stroke!, color: f.color } })}
            />
            <NumberField
              label="Outline width"
              glyph="W"
              className="w-24"
              value={el.stroke.width}
              min={0}
              max={200}
              onChange={(v) => set('stroke-w', { stroke: { ...el.stroke!, width: v } })}
            />
          </div>
        )}
      </Section>
      <Section
        title="Highlight"
        action={
          <Switch
            checked={Boolean(el.highlight)}
            aria-label="Text highlight"
            onCheckedChange={(on) =>
              set('hl-on', {
                highlight: on
                  ? { fill: { type: 'solid', color: '#C6FF3D' }, padding: el.fontSize * 0.35, radius: el.fontSize * 0.3 }
                  : undefined,
              })
            }
          />
        }
      >
        {el.highlight && (
          <>
            <Row label="Colour">
              <FillField
                label="Highlight colour"
                value={el.highlight.fill}
                onChange={(fill) => fill && set('hl-fill', { highlight: { ...el.highlight!, fill } })}
              />
            </Row>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Padding"
                glyph="P"
                value={el.highlight.padding}
                min={0}
                max={500}
                onChange={(v) => set('hl-pad', { highlight: { ...el.highlight!, padding: v } })}
              />
              <NumberField
                label="Radius"
                glyph="R"
                value={el.highlight.radius}
                min={0}
                max={1000}
                onChange={(v) => set('hl-rad', { highlight: { ...el.highlight!, radius: v } })}
              />
            </div>
          </>
        )}
      </Section>
    </>
  );
}

function ShapeSection({ el }: { el: ShapeElement }) {
  const set = (key: string, patch: Partial<ShapeElement>) =>
    updateSelection(key, (e) => (e.type === 'shape' ? { ...e, ...patch } : e));
  const open = el.shape === 'line' || el.shape === 'arrow';
  return (
    <Section title="Shape">
      {!open && (
        <Row label="Fill">
          <FillField label="Shape fill" value={el.fill} allowNone onChange={(fill) => set('fill', { fill })} />
        </Row>
      )}
      <Row label="Stroke">
        <Switch
          checked={Boolean(el.stroke)}
          aria-label="Shape stroke"
          onCheckedChange={(on) => set('stroke-on', { stroke: on ? { color: '#0B0A12', width: 6 } : undefined })}
        />
      </Row>
      {el.stroke && (
        <div className="flex gap-2">
          <FillField
            label="Stroke colour"
            solidOnly
            value={{ type: 'solid', color: el.stroke.color }}
            onChange={(f) => f?.type === 'solid' && set('stroke-c', { stroke: { ...el.stroke!, color: f.color } })}
          />
          <NumberField
            label="Stroke width"
            glyph="W"
            className="w-24"
            value={el.stroke.width}
            min={0}
            max={200}
            onChange={(v) => set('stroke-w', { stroke: { ...el.stroke!, width: v } })}
          />
          <IconToggle
            label="Dashed"
            pressed={Boolean(el.dash?.length)}
            onClick={() => set('dash', { dash: el.dash?.length ? undefined : [el.stroke!.width * 3, el.stroke!.width * 2] })}
          >
            ┅
          </IconToggle>
        </div>
      )}
      {el.shape === 'rect' && (
        <Row label="Corner radius">
          <NumberField
            label="Corner radius"
            glyph="R"
            className="w-28"
            value={Math.min(el.cornerRadius ?? 0, Math.min(el.width, el.height) / 2)}
            min={0}
            max={Math.min(el.width, el.height) / 2}
            onChange={(v) => set('radius', { cornerRadius: v })}
          />
        </Row>
      )}
      {(el.shape === 'star' || el.shape === 'polygon') && (
        <Row label={el.shape === 'star' ? 'Points' : 'Sides'}>
          <NumberField
            label="Points"
            glyph="#"
            className="w-28"
            value={el.points ?? (el.shape === 'star' ? 5 : 6)}
            min={3}
            max={64}
            onChange={(v) => set('points', { points: Math.round(v) })}
          />
        </Row>
      )}
      {el.shape === 'star' && (
        <div>
          <p className="mb-2 text-[13px] text-fg-muted">Inner radius · {Math.round((el.innerRadius ?? 0.45) * 100)}%</p>
          <Slider
            aria-label="Star inner radius"
            min={10}
            max={95}
            value={Math.round((el.innerRadius ?? 0.45) * 100)}
            onChange={(v) => set('inner', { innerRadius: v / 100 })}
          />
        </div>
      )}
    </Section>
  );
}

function StickerSection({ el }: { el: Extract<DesignElement, { type: 'sticker' }> }) {
  if (el.stickerId.startsWith('emoji:')) {
    return (
      <Section title="Sticker">
        <p className="text-[13px] text-fg-muted">Emoji keep their own colours and follow your device’s emoji style.</p>
      </Section>
    );
  }
  return (
    <Section title="Sticker">
      <Row label="Colour">
        <FillField
          label="Sticker colour"
          solidOnly
          value={{ type: 'solid', color: el.tint ?? '#000000' }}
          onChange={(f) =>
            f?.type === 'solid' && updateSelection('tint', (e) => (e.type === 'sticker' ? { ...e, tint: f.color } : e))
          }
        />
      </Row>
    </Section>
  );
}

function ShadowSection({ el }: { el: DesignElement }) {
  const shadow = el.shadow;
  const set = (key: string, next: DesignElement['shadow']) => updateSelection(key, (e) => ({ ...e, shadow: next }));
  return (
    <Section
      title="Shadow"
      action={
        <Switch
          checked={Boolean(shadow)}
          aria-label="Shadow"
          onCheckedChange={(on) => set('shadow-on', on ? { color: 'rgba(11,10,18,0.35)', blur: 30, x: 0, y: 12 } : undefined)}
        />
      }
    >
      {shadow && (
        <>
          <Row label="Colour">
            <FillField
              label="Shadow colour"
              solidOnly
              value={{ type: 'solid', color: shadow.color }}
              onChange={(f) => f?.type === 'solid' && set('shadow-c', { ...shadow, color: f.color })}
            />
          </Row>
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Shadow blur"
              glyph="B"
              value={shadow.blur}
              min={0}
              max={500}
              onChange={(v) => set('shadow-b', { ...shadow, blur: v })}
            />
            <NumberField
              label="Shadow X"
              glyph="X"
              value={shadow.x}
              min={-1000}
              max={1000}
              onChange={(v) => set('shadow-x', { ...shadow, x: v })}
            />
            <NumberField
              label="Shadow Y"
              glyph="Y"
              value={shadow.y}
              min={-1000}
              max={1000}
              onChange={(v) => set('shadow-y', { ...shadow, y: v })}
            />
          </div>
        </>
      )}
    </Section>
  );
}

/** Contextual editing controls for the current selection. */
export function PropertiesPanel() {
  const els = useSelectedElements();
  const doc = useEditor(selectDoc);
  if (els.length === 0) return null;
  const layoutId = els.find((e) => e.layout)?.layout?.id;
  const layout = doc && layoutId ? getLayout(doc, layoutId) : undefined;
  const single = els.length === 1 ? els[0]! : null;
  const allText = els.every((e) => e.type === 'text');
  const units = new Set(els.map((e) => e.groupId ?? e.id)).size;
  const locked = els.some((e) => e.locked);

  return (
    <div data-testid="properties-panel">
      <Header els={els} />
      {layout && <LayoutSection spec={layout} els={els} />}
      {!locked && (
        <>
          <Arrange count={units} />
          {single && <Transform el={single} />}
          {!single && (
            <Section title="Opacity">
              <Slider
                aria-label="Opacity"
                min={0}
                max={100}
                value={Math.round((els[0]?.opacity ?? 1) * 100)}
                onChange={(v) => updateSelection('opacity', (e) => ({ ...e, opacity: v / 100 }))}
              />
            </Section>
          )}
          {single?.type === 'text' && <TextSection el={single} />}
          {!single && allText && <TextSection el={els[0] as TextElement} />}
          {single?.type === 'shape' && <ShapeSection el={single} />}
          {single?.type === 'sticker' && <StickerSection el={single} />}
          {single?.type === 'image' && <ImageSections el={single} cutout={<CutoutSection el={single} />} />}
          {single && <ShadowSection el={single} />}
        </>
      )}
      {locked && (
        <p className="px-4 py-4 text-[13px] text-fg-muted">Locked items can’t be moved or edited. Unlock to make changes.</p>
      )}
    </div>
  );
}
