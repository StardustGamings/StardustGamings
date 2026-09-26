'use client';

import { Lock } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getElements } from '../core/ops';
import { ALL_HANDLES, boxBounds, boxCorners, handlePoint, type Box, type Point } from '../core/geometry';
import { photoQuad } from '@/images/content';
import { assetMetaSync } from '../photo-actions';
import { GRID_COLUMNS } from '../core/snapping';
import { safeZones } from '../safe-areas';
import { useCamera } from '../camera';
import { selectDoc, useEditor } from '../store';
import { usePlayback } from '../playback';
import { useInteraction } from './interaction-store';
import { RULER_SIZE, rotateHandlePoint, transformFrame } from './useCanvasInteractions';

/** Selection chrome uses violet so it stays visible on lime (brand-coloured) designs. */
const ACCENT = 'var(--selection)';
const SNAP = '#FF3DDB';
const GUIDE = '#3CF0FF';

function useView() {
  const x = useCamera((s) => s.x);
  const y = useCamera((s) => s.y);
  const zoom = useCamera((s) => s.zoom);
  const vw = useCamera((s) => s.vw);
  const vh = useCamera((s) => s.vh);
  const toScreen = (p: Point): Point => ({ x: (p.x - x) * zoom, y: (p.y - y) * zoom });
  return { x, y, zoom, vw, vh, toScreen };
}

const polygon = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

export function Overlay() {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const selection = useEditor((s) => s.selection);
  const activeSlide = useEditor((s) => s.activeSlide);
  const editingTextId = useEditor((s) => s.editingTextId);
  const croppingId = useEditor((s) => s.croppingId);
  const dropTargetId = useInteraction((s) => s.dropTargetId);
  const showGrid = useEditor((s) => s.showGrid);
  const showSafeArea = useEditor((s) => s.showSafeArea);
  const showRulers = useEditor((s) => s.showRulers);
  const snapLines = useInteraction((s) => s.snapLines);
  const marquee = useInteraction((s) => s.marquee);
  const hoverId = useInteraction((s) => s.hoverId);
  const gesture = useInteraction((s) => s.gesture);
  const coarse = useMediaQuery('(pointer: coarse)');
  // While motion is previewed, handles would sit where elements rest, not where they are.
  const previewing = usePlayback((s) => s.slide !== null);
  const view = useView();
  if (!doc || !meta || !view.vw) return null;

  const { zoom, toScreen } = view;
  const W = doc.slideWidth * zoom;
  const H = doc.slideHeight * zoom;
  const origin = toScreen({ x: 0, y: 0 });
  const multi = doc.slides.length > 1;
  const zones = showSafeArea ? safeZones(meta.sizeId, doc.slideWidth, doc.slideHeight) : [];
  const frame = previewing ? null : transformFrame(doc, selection);
  const transforming = gesture === 'move' || gesture === 'resize' || gesture === 'rotate' || gesture === 'crop';
  const handleSize = coarse ? 14 : 9;
  const selected = getElements(doc, selection);
  const hovered = hoverId && !selection.includes(hoverId) ? getElements(doc, [hoverId])[0] : undefined;

  const cornersOf = (b: Box) => boxCorners(b).map(toScreen);
  const cropEl = croppingId ? getElements(doc, [croppingId])[0] : undefined;
  const cropMeta = cropEl?.type === 'image' ? assetMetaSync(cropEl.assetId) : null;
  const dropTarget = dropTargetId ? getElements(doc, [dropTargetId])[0] : undefined;

  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden data-testid="canvas-overlay">
      <defs>
        <pattern
          id="grid-cell"
          width={W / GRID_COLUMNS}
          height={W / GRID_COLUMNS}
          patternUnits="userSpaceOnUse"
          x={origin.x}
          y={origin.y}
        >
          <path
            d={`M ${W / GRID_COLUMNS} 0 L 0 0 0 ${W / GRID_COLUMNS}`}
            fill="none"
            stroke="rgb(160 107 255 / 0.45)"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      {showGrid && <rect x={origin.x} y={origin.y} width={W * doc.slides.length} height={H} fill="url(#grid-cell)" />}

      {doc.slides.map((slide, i) => {
        const x = origin.x + i * W;
        return (
          <g key={slide.id}>
            {multi && i > 0 && (
              <line
                x1={x}
                y1={origin.y}
                x2={x}
                y2={origin.y + H}
                stroke="white"
                strokeOpacity={0.55}
                strokeDasharray="4 4"
                style={{ mixBlendMode: 'difference' }}
              />
            )}
            {multi && (
              <text
                x={x}
                y={origin.y - 8}
                fontSize="11"
                fontFamily="var(--font-mono)"
                fontWeight="600"
                fill={i === activeSlide ? 'var(--accent-text)' : 'var(--fg-subtle)'}
              >
                {String(i + 1).padStart(2, '0')}
              </text>
            )}
            {zones
              .filter(() => !(meta.sizeId === 'ig-portrait' && i > 0))
              .map((z, zi) => (
                <g key={zi}>
                  <rect
                    x={x + z.x * zoom}
                    y={origin.y + z.y * zoom}
                    width={z.width * zoom}
                    height={z.height * zoom}
                    fill="rgb(255 92 122 / 0.12)"
                    stroke="rgb(255 92 122 / 0.7)"
                    strokeDasharray="4 3"
                  />
                  {z.label && z.width * zoom > 110 && z.height * zoom > 18 && (
                    <text
                      x={x + (z.x + z.width / 2) * zoom}
                      y={origin.y + z.y * zoom + 13}
                      fontSize="9.5"
                      fontWeight="700"
                      textAnchor="middle"
                      fill="#FF5C7A"
                      style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      {z.label}
                    </text>
                  )}
                </g>
              ))}
          </g>
        );
      })}
      {multi && (
        <rect
          x={origin.x + activeSlide * W - 1.5}
          y={origin.y - 1.5}
          width={W + 3}
          height={H + 3}
          fill="none"
          stroke={ACCENT}
          strokeWidth="2"
          rx="2"
          opacity={selection.length ? 0.35 : 0.9}
        />
      )}

      {showRulers &&
        (doc.guides ?? []).map((g) => {
          const pos = g.axis === 'x' ? toScreen({ x: g.position, y: 0 }).x : toScreen({ x: 0, y: g.position }).y;
          return g.axis === 'x' ? (
            <line key={g.id} data-guide={g.axis} x1={pos} y1={RULER_SIZE} x2={pos} y2={view.vh} stroke={GUIDE} strokeWidth="1" />
          ) : (
            <line key={g.id} data-guide={g.axis} x1={RULER_SIZE} y1={pos} x2={view.vw} y2={pos} stroke={GUIDE} strokeWidth="1" />
          );
        })}

      {hovered && !transforming && (
        <polygon points={polygon(cornersOf(hovered))} fill="none" stroke={ACCENT} strokeWidth="1.5" opacity="0.8" />
      )}

      {selected.length > 1 &&
        selected.map((el) => (
          <polygon key={el.id} points={polygon(cornersOf(el))} fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.7" />
        ))}

      {dropTarget && (
        <polygon
          data-testid="drop-target"
          points={polygon(cornersOf(dropTarget))}
          fill="rgb(123 97 255 / 0.18)"
          stroke={ACCENT}
          strokeWidth="3"
        />
      )}

      {cropEl?.type === 'image' && cropMeta && (
        <g data-testid="crop-chrome">
          <polygon
            points={polygon(photoQuad(cropEl, cropMeta.width, cropMeta.height).map(toScreen))}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.25"
            strokeDasharray="5 4"
            style={{ mixBlendMode: 'difference' }}
          />
          {photoQuad(cropEl, cropMeta.width, cropMeta.height).map((q, i) => {
            const pt = toScreen(q);
            return (
              <circle
                key={i}
                data-photo-corner={i}
                cx={pt.x}
                cy={pt.y}
                r={handleSize / 2 + 1}
                fill={ACCENT}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            );
          })}
          <polygon points={polygon(cornersOf(cropEl))} fill="none" stroke={ACCENT} strokeWidth="2" />
          {(() => {
            // Rule-of-thirds grid inside the crop window.
            const c = boxCorners(cropEl).map(toScreen);
            const lerp = (a: Point, b: Point, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            return [1 / 3, 2 / 3].flatMap((t) => {
              const a = lerp(c[0]!, c[1]!, t);
              const b = lerp(c[3]!, c[2]!, t);
              const d = lerp(c[0]!, c[3]!, t);
              const e = lerp(c[1]!, c[2]!, t);
              return [
                <line key={`v${t}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1" />,
                <line key={`h${t}`} x1={d.x} y1={d.y} x2={e.x} y2={e.y} stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1" />,
              ];
            });
          })()}
          {ALL_HANDLES.map((h) => {
            const pt = toScreen(handlePoint(cropEl, h));
            const side = h.length === 1;
            const long = handleSize * 1.9;
            const short = handleSize * 0.6;
            const w = side ? (h === 'e' || h === 'w' ? short : long) : handleSize * 1.2;
            const hh = side ? (h === 'n' || h === 's' ? short : long) : handleSize * 1.2;
            return (
              <rect
                key={h}
                data-crop-handle={h}
                x={pt.x - w / 2}
                y={pt.y - hh / 2}
                width={w}
                height={hh}
                rx={2}
                fill="#FFFFFF"
                stroke={ACCENT}
                strokeWidth="1.75"
                transform={`rotate(${cropEl.rotation} ${pt.x} ${pt.y})`}
              />
            );
          })}
        </g>
      )}

      {frame && editingTextId === null && !cropEl && (
        <g>
          <polygon
            data-testid="selection-frame"
            points={polygon(cornersOf(frame.box))}
            fill="none"
            stroke={ACCENT}
            strokeWidth={frame.locked ? 1 : 1.5}
            strokeDasharray={frame.locked ? '4 3' : undefined}
          />
          {!frame.locked && !transforming && (
            <>
              {(() => {
                const top = toScreen(handlePoint(frame.box, 'n'));
                const rot = toScreen(rotateHandlePoint(frame.box, zoom));
                return (
                  <g data-handle="rotate">
                    <line x1={top.x} y1={top.y} x2={rot.x} y2={rot.y} stroke={ACCENT} strokeWidth="1.5" />
                    <circle cx={rot.x} cy={rot.y} r={handleSize / 2 + 1.5} fill="#FFFFFF" stroke={ACCENT} strokeWidth="2" />
                  </g>
                );
              })()}
              {frame.handles.map((h) => {
                const pt = toScreen(handlePoint(frame.box, h));
                const side = h.length === 1;
                const w = side && (h === 'e' || h === 'w') ? handleSize * 0.55 : handleSize;
                const hh = side && (h === 'n' || h === 's') ? handleSize * 0.55 : handleSize;
                return (
                  <rect
                    key={h}
                    data-handle={h}
                    x={pt.x - w / 2}
                    y={pt.y - hh / 2}
                    width={w}
                    height={hh}
                    rx={side ? w / 2 : 2.5}
                    fill="#FFFFFF"
                    stroke={ACCENT}
                    strokeWidth="1.75"
                    transform={`rotate(${frame.box.rotation} ${pt.x} ${pt.y})`}
                  />
                );
              })}
            </>
          )}
          {!transforming &&
            (() => {
              const b = boxBounds(frame.box);
              const bottom = toScreen({ x: b.x + b.width / 2, y: b.y + b.height });
              return (
                <foreignObject x={bottom.x - 70} y={bottom.y + 10} width="140" height="24">
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-selection px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                      {frame.locked && <Lock className="size-2.5" />}
                      {Math.round(frame.box.width)} × {Math.round(frame.box.height)}
                    </span>
                  </div>
                </foreignObject>
              );
            })()}
        </g>
      )}

      {snapLines.map((l, i) => {
        if (l.axis === 'x') {
          const a = toScreen({ x: l.position, y: l.from });
          const b = toScreen({ x: l.position, y: l.to });
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SNAP} strokeWidth="1" />;
        }
        const a = toScreen({ x: l.from, y: l.position });
        const b = toScreen({ x: l.to, y: l.position });
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SNAP} strokeWidth="1" />;
      })}

      {marquee &&
        (() => {
          const a = toScreen({ x: marquee.x, y: marquee.y });
          return (
            <rect
              x={a.x}
              y={a.y}
              width={marquee.width * zoom}
              height={marquee.height * zoom}
              fill="rgb(123 97 255 / 0.1)"
              stroke={ACCENT}
              strokeWidth="1"
            />
          );
        })()}
    </svg>
  );
}

export function Readout() {
  const readout = useInteraction((s) => s.readout);
  if (!readout) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-full bg-ink/85 px-2 py-0.5 font-mono text-[11px] font-semibold text-white shadow-[var(--shadow-soft)]"
      style={{ left: readout.x + 14, top: readout.y + 14 }}
    >
      {readout.text}
    </div>
  );
}
