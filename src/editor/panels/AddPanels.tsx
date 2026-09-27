'use client';

import { Search, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DesignDocument } from '@/types/document';
import { ScenePreview } from '@/canvas/ScenePreview';
import { EMOJI_STICKERS, stickerName, VECTOR_STICKERS, type StickerCategory } from '@/stickers/library';
import { fontStack, loadFont } from '@/typography/fonts';
import { useTrends } from '@/trends/store';
import { cn } from '@/utils/cn';
import { fillToCss } from '@/canvas/render/fill';
import * as actions from '../actions';
import { SHAPE_PRESETS, TEXT_PRESETS, type TextPreset } from '../core/factory';
import { DND_TYPE, type DragItem } from '../dnd';
import { selectDoc, useEditor } from '../store';
import { openPhotoPicker } from '../file-picker';
import { AssetLibrary } from './PhotosPanel';

const dragProps = (item: DragItem) => ({
  draggable: true,
  onDragStart: (e: React.DragEvent) => {
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  },
});

function Hint() {
  return <p className="px-4 pt-3 text-[12px] text-fg-subtle">Tap to add, or drag onto the canvas.</p>;
}

const OUTLINE = [
  [-1.5, 0],
  [1.5, 0],
  [0, -1.5],
  [0, 1.5],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

function presetCss(p: TextPreset): React.CSSProperties {
  const s = p.style;
  return {
    fontFamily: fontStack(s.fontFamily),
    fontWeight: s.fontWeight ?? 400,
    fontStyle: s.fontStyle ?? 'normal',
    textTransform: s.textTransform ?? 'none',
    letterSpacing: `${s.letterSpacing ?? 0}em`,
    ...(p.fixedColors && s.fill?.type === 'solid' ? { color: s.fill.color } : {}),
    ...(p.fixedColors && s.fill && s.fill.type !== 'solid'
      ? { background: fillToCss(s.fill), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
      : {}),
    // Outlines are drawn as a ring of hard shadows: at sample size they look the same as a stroke,
    // and the text keeps its real fill colour (which is what contrast checkers read).
    ...(s.stroke || s.shadow
      ? {
          textShadow: [
            ...(s.stroke ? OUTLINE.map(([x, y]) => `${x}px ${y}px 0 ${s.stroke!.color}`) : []),
            ...(s.shadow
              ? [`${Math.sign(s.shadow.x) * 2}px ${Math.sign(s.shadow.y) * 2}px ${s.shadow.blur ? 8 : 0}px ${s.shadow.color}`]
              : []),
          ].join(', '),
        }
      : {}),
    ...(s.highlight?.fill.type === 'solid' ? { background: s.highlight.fill.color, padding: '2px 8px', borderRadius: 999 } : {}),
  };
}

export function TextPanel() {
  const pairings = useTrends((s) => s.pack.typography);
  useEffect(() => {
    for (const p of TEXT_PRESETS) void loadFont(p.style.fontFamily, p.style.fontWeight ?? 400, p.style.fontStyle ?? 'normal');
  }, []);
  const [basics, styles] = [TEXT_PRESETS.slice(0, 3), TEXT_PRESETS.slice(3)];

  return (
    <div data-testid="text-panel">
      <Hint />
      <div className="flex flex-col gap-2 p-4">
        {basics.map((p, i) => (
          <button
            key={p.id}
            type="button"
            {...dragProps({ kind: 'text', presetId: p.id })}
            onClick={() => actions.addText(p, undefined, { edit: false })}
            className="rounded-[14px] border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover"
          >
            <span className={cn('block truncate', i === 0 ? 'text-2xl' : i === 1 ? 'text-lg' : 'text-sm')} style={presetCss(p)}>
              {p.sample}
            </span>
          </button>
        ))}
      </div>
      <h3 className="px-4 pt-2 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">Styles</h3>
      <div className="grid grid-cols-2 gap-2 p-4">
        {styles.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Add ${p.name} text`}
            {...dragProps({ kind: 'text', presetId: p.id })}
            onClick={() => actions.addText(p)}
            className={cn(
              'flex h-20 flex-col items-center justify-center gap-1 overflow-hidden rounded-[14px] border border-line px-2 transition-colors hover:border-line-strong',
              p.fixedColors ? 'bg-[#15131f]' : 'bg-surface',
            )}
          >
            <span aria-hidden className="max-w-full truncate text-[17px] leading-none" style={presetCss(p)}>
              {p.sample}
            </span>
            <span className={cn('text-[10px] font-semibold', p.fixedColors ? 'text-white/70' : 'text-fg-subtle')}>{p.name}</span>
          </button>
        ))}
      </div>
      <h3 className="px-4 pt-2 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">Trending pairings</h3>
      <div className="flex flex-col gap-2 p-4">
        {pairings.map((pair) => (
          <button
            key={pair.id}
            type="button"
            onClick={() => {
              const d = selectDoc(useEditor.getState());
              if (!d) return;
              const cx = useEditor.getState().activeSlide * d.slideWidth + d.slideWidth / 2;
              const heading: TextPreset = {
                id: `pair-${pair.id}-h`,
                name: pair.name,
                sample: pair.sample,
                scale: 0.09,
                style: {
                  fontFamily: pair.heading.family,
                  fontWeight: pair.heading.weight,
                  fontStyle: pair.heading.style ?? 'normal',
                  textTransform: pair.heading.transform,
                  lineHeight: 1,
                },
              };
              const body: TextPreset = {
                id: `pair-${pair.id}-b`,
                name: pair.name,
                sample: 'A supporting line in the pairing',
                scale: 0.036,
                style: {
                  fontFamily: pair.body.family,
                  fontWeight: pair.body.weight,
                  fontStyle: pair.body.style ?? 'normal',
                  textTransform: pair.body.transform,
                  lineHeight: 1.35,
                },
              };
              const h = actions.addText(heading, { x: cx, y: d.slideHeight * 0.45 });
              const b = actions.addText(body, { x: cx, y: d.slideHeight * 0.45 + (h?.height ?? 0) / 2 + d.slideWidth * 0.06 });
              if (h && b) useEditor.getState().select([h.id, b.id]);
            }}
            className="rounded-[14px] border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
          >
            <span
              className="block truncate text-xl leading-tight"
              style={{
                fontFamily: fontStack(pair.heading.family),
                fontWeight: pair.heading.weight,
                fontStyle: pair.heading.style,
                textTransform: pair.heading.transform,
              }}
            >
              {pair.sample}
            </span>
            <span
              className="mt-1 block truncate text-[12px] text-fg-muted"
              style={{ fontFamily: fontStack(pair.body.family), fontWeight: pair.body.weight }}
            >
              {pair.heading.family} + {pair.body.family}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ShapeGlyph({ id }: { id: string }) {
  const common = { fill: 'currentColor' };
  switch (id) {
    case 'rect':
      return <rect x="6" y="12" width="36" height="24" {...common} />;
    case 'rounded':
      return <rect x="6" y="12" width="36" height="24" rx="7" {...common} />;
    case 'pill':
      return <rect x="4" y="16" width="40" height="16" rx="8" {...common} />;
    case 'ellipse':
      return <circle cx="24" cy="24" r="16" {...common} />;
    case 'triangle':
      return <path d="M24 8 L42 40 H6 Z" {...common} />;
    case 'star':
      return <path d="M24 6l5.3 11.6 12.7 1.3-9.5 8.6 2.7 12.5L24 33.6 12.8 40l2.7-12.5L6 18.9l12.7-1.3z" {...common} />;
    case 'burst':
      return (
        <path
          d={
            Array.from({ length: 28 }, (_, i) => {
              const r = i % 2 ? 13 : 18;
              const a = (i * Math.PI) / 14 - Math.PI / 2;
              return `${i ? 'L' : 'M'}${(24 + r * Math.cos(a)).toFixed(1)} ${(24 + r * Math.sin(a)).toFixed(1)}`;
            }).join(' ') + 'Z'
          }
          {...common}
        />
      );
    case 'hexagon':
      return <path d="M24 6 L40 15 V33 L24 42 L8 33 V15 Z" {...common} />;
    case 'line':
      return <path d="M6 24 H42" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />;
    case 'arrow':
      return (
        <path
          d="M6 24 H40 M31 15 L40 24 L31 33"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    default:
      return null;
  }
}

export function ShapesPanel() {
  return (
    <div data-testid="shapes-panel">
      <Hint />
      <div className="grid grid-cols-3 gap-2 p-4">
        {SHAPE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Add ${p.name}`}
            {...dragProps({ kind: 'shape', presetId: p.id })}
            onClick={() => actions.addShape(p)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[14px] border border-line bg-surface text-fg transition-colors hover:border-line-strong hover:text-accent-text"
          >
            <svg viewBox="0 0 48 48" className="size-10" aria-hidden>
              <ShapeGlyph id={p.id} />
            </svg>
            <span className="text-[10.5px] font-semibold text-fg-subtle">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const STICKER_TABS: { id: StickerCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'emojis', label: 'Emoji' },
  { id: 'stars', label: 'Stars' },
  { id: 'hearts', label: 'Hearts' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'doodles', label: 'Doodles' },
  { id: 'handwritten', label: 'Hand-drawn' },
  { id: 'y2k', label: 'Y2K' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'memes', label: 'Memes' },
  { id: 'cute', label: 'Cute' },
  { id: 'streetwear', label: 'Street' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'social', label: 'Social' },
];

function stickerDoc(stickerId: string): DesignDocument {
  return {
    version: 1,
    slideWidth: 100,
    slideHeight: 100,
    background: { type: 'solid', color: 'rgba(0,0,0,0)' },
    slides: [{ id: 's', fill: null }],
    elements: [{ id: 'st', type: 'sticker', stickerId, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 }],
  };
}

const STICKERS = [
  ...EMOJI_STICKERS.map((s) => ({ id: s.id, name: s.name, category: s.category as StickerCategory })),
  ...VECTOR_STICKERS.map((s) => ({ id: `vector:${s.id}`, name: s.name, category: s.category })),
];

export function StickersPanel() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<StickerCategory | 'all' | 'drop'>('all');
  const drop = useTrends((s) => s.pack);
  // The trend drop's stickers (built-in ones it features, plus its own art).
  const dropStickers = useMemo(
    () => drop.stickers.map((ref) => ({ id: ref, name: stickerName(ref), category: 'drop' as const })),
    [drop],
  );
  const all = useMemo(() => [...STICKERS, ...dropStickers.filter((s) => s.id.startsWith('art:'))], [dropStickers]);
  const docs = useMemo(() => new Map([...all, ...dropStickers].map((s) => [s.id, stickerDoc(s.id)])), [all, dropStickers]);
  const tabs = [STICKER_TABS[0]!, { id: 'drop' as const, label: `✦ ${drop.title}` }, ...STICKER_TABS.slice(1)];
  const list = (tab === 'drop' ? dropStickers : all).filter(
    (s) =>
      (tab === 'all' || tab === 'drop' || s.category === tab) &&
      (!query.trim() ||
        s.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        s.category.includes(query.trim().toLowerCase())),
  );

  return (
    <div data-testid="stickers-panel">
      <div className="p-4 pb-0">
        <div className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-bg-sunken/70 px-2.5 focus-within:border-ring">
          <Search className="size-4 text-fg-subtle" />
          <input
            aria-label="Search stickers"
            placeholder="Search stickers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-subtle"
          />
        </div>
        <div className="-mx-4 mt-2 hide-scrollbar flex gap-1 overflow-x-auto px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'h-7 shrink-0 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors',
                tab === t.id ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Hint />
      <div className="grid grid-cols-4 gap-2 p-4">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Add ${s.name} sticker`}
            title={s.name}
            {...dragProps({ kind: 'sticker', stickerId: s.id })}
            onClick={() => actions.addSticker(s.id)}
            className="flex aspect-square items-center justify-center rounded-[12px] border border-line bg-[#8f8ba3] p-2 transition-transform hover:scale-105 hover:border-line-strong"
          >
            <ScenePreview doc={docs.get(s.id)!} className="w-full" maxDpr={2} />
          </button>
        ))}
        {list.length === 0 && <p className="col-span-4 py-6 text-center text-sm text-fg-muted">No stickers match “{query}”.</p>}
      </div>
      <div className="border-t border-line">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <h3 className="text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">Your stickers</h3>
          <button
            type="button"
            onClick={() => openPhotoPicker({ kind: 'sticker' })}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold transition-colors hover:border-accent"
          >
            <Upload className="size-3.5" /> Upload PNG / SVG
          </button>
        </div>
        <AssetLibrary kind="sticker" emptyText="Upload transparent PNG, WebP or SVG stickers — they stay on this device." />
      </div>
    </div>
  );
}
