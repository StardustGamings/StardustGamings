import { describe, expect, it } from 'vitest';
import type { DesignDocument, TextElement } from '@/types/document';
import { createDocument } from '@/projects/document';
import { createFillStyle, fillToCss } from './fill';
import { renderDocument, elementBounds, slideRegion } from './renderer';
import { layoutText, wrapText } from './text';
import type { Ctx2D } from './types';

interface Call {
  name: string;
  args: unknown[];
}

/** Records every canvas call; measures text as 0.5em per character. */
function recordingContext() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { font: '10px sans-serif' };
  const fontSize = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') {
        return (text: string) => ({
          width: text.length * fontSize() * 0.5,
          fontBoundingBoxAscent: fontSize() * 0.8,
          fontBoundingBoxDescent: fontSize() * 0.2,
        });
      }
      if (prop === 'getTransform') return () => ({ a: 2, b: 0 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...args: unknown[]) => {
          calls.push({ name: prop, args });
          return { addColorStop: (...a: unknown[]) => calls.push({ name: 'addColorStop', args: a }) };
        };
      }
      return (...args: unknown[]) => calls.push({ name: prop, args });
    },
    set(target, prop: string, value) {
      target[prop] = value;
      calls.push({ name: `set:${prop}`, args: [value] });
      return true;
    },
  });
  return { ctx: ctx as unknown as Ctx2D, calls };
}

const text = (over: Partial<TextElement>): TextElement => ({
  id: 't',
  type: 'text',
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  rotation: 0,
  opacity: 1,
  text: 'hello world',
  fontFamily: 'Manrope',
  fontSize: 20,
  fontWeight: 400,
  fontStyle: 'normal',
  fill: { type: 'solid', color: '#000' },
  align: 'left',
  verticalAlign: 'top',
  lineHeight: 1.2,
  letterSpacing: 0,
  ...over,
});

describe('fills', () => {
  it('builds CSS-equivalent linear gradients', () => {
    const { ctx, calls } = recordingContext();
    createFillStyle(
      ctx,
      {
        type: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: '#000' },
          { offset: 1, color: '#fff' },
        ],
      },
      0,
      0,
      200,
      100,
    );
    const coords = calls.find((c) => c.name === 'createLinearGradient')!.args as number[];
    expect(coords.map((n) => Math.round(n))).toEqual([0, 50, 200, 50]);
    expect(
      fillToCss({
        type: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: '#000' },
          { offset: 1, color: '#fff' },
        ],
      }),
    ).toBe('linear-gradient(90deg, #000 0%, #fff 100%)');
  });

  it('ignores invalid colour stops instead of throwing', () => {
    const ctx = {
      createLinearGradient: () => ({
        addColorStop: () => {
          throw new SyntaxError('bad colour');
        },
      }),
    } as unknown as Ctx2D;
    expect(() =>
      createFillStyle(ctx, { type: 'linear', angle: 0, stops: [{ offset: 0, color: 'nope' }] }, 0, 0, 1, 1),
    ).not.toThrow();
  });
});

describe('text layout', () => {
  it('wraps words to the box width and honours newlines', () => {
    const { ctx } = recordingContext();
    ctx.font = '20px x';
    expect(wrapText(ctx, 'one two three four', 100, 0).map((l) => l.text)).toEqual(['one two', 'three four']);
    expect(wrapText(ctx, 'a\n\nb', 100, 0).map((l) => l.text)).toEqual(['a', '', 'b']);
  });

  it('breaks words that are wider than the box', () => {
    const { ctx } = recordingContext();
    ctx.font = '20px x';
    expect(wrapText(ctx, 'abcdefghijkl', 50, 0).map((l) => l.text)).toEqual(['abcde', 'fghij', 'kl']);
  });

  it('accounts for letter spacing and text transforms', () => {
    const { ctx } = recordingContext();
    const layout = layoutText(ctx, text({ text: 'abc', letterSpacing: 0.5, textTransform: 'uppercase' }));
    expect(layout.lines[0]!.text).toBe('ABC');
    expect(layout.lines[0]!.width).toBe(3 * 10 + 2 * 10);
    expect(layout.blockHeight).toBe(24);
  });
});

describe('renderDocument', () => {
  const doc: DesignDocument = {
    ...createDocument({ width: 100, height: 100, slideCount: 2, background: { type: 'solid', color: '#abcdef' } }),
    elements: [
      {
        id: 'on1',
        type: 'shape',
        shape: 'rect',
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        rotation: 0,
        opacity: 1,
        fill: { type: 'solid', color: '#111' },
      },
      {
        id: 'on2',
        type: 'shape',
        shape: 'ellipse',
        x: 110,
        y: 10,
        width: 20,
        height: 20,
        rotation: 0,
        opacity: 1,
        fill: { type: 'solid', color: '#222' },
      },
      {
        id: 'hidden',
        type: 'shape',
        shape: 'rect',
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        rotation: 0,
        opacity: 1,
        hidden: true,
        fill: { type: 'solid', color: '#333' },
      },
    ],
  };

  it('paints the background and only the elements inside the region', () => {
    const { ctx, calls } = recordingContext();
    renderDocument(ctx, doc, { region: slideRegion(doc, 0), scale: 1 });
    const fills = calls.filter((c) => c.name === 'set:fillStyle').map((c) => c.args[0]);
    expect(fills).toContain('#abcdef');
    expect(fills).toContain('#111');
    expect(fills).not.toContain('#222'); // on slide 2, culled
    expect(fills).not.toContain('#333'); // hidden
  });

  it('scales shadows into device pixels', () => {
    const { ctx, calls } = recordingContext();
    const withShadow: DesignDocument = {
      ...doc,
      elements: [{ ...doc.elements[0]!, shadow: { color: '#000', blur: 10, x: 2, y: 3 } }],
    };
    renderDocument(ctx, withShadow, { scale: 1 });
    expect(calls.find((c) => c.name === 'set:shadowBlur')?.args[0]).toBe(20);
  });

  it('computes rotated bounds', () => {
    const b = elementBounds({ ...doc.elements[0]!, rotation: 90, width: 40, height: 10 });
    expect(Math.round(b.width)).toBe(10);
    expect(Math.round(b.height)).toBe(40);
  });
});
