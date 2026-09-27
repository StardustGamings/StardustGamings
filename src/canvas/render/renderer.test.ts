import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesignDocument, TextElement } from '@/types/document';
import { createDocument } from '@/projects/document';
import { createFillStyle, fillToCss } from './fill';
import { renderDocument, elementBounds, slideRegion } from './renderer';
import { isWarped, layoutText, warpedGlyphs, wrapText } from './text';
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

describe('image elements', () => {
  const photo = {
    id: 'ph',
    type: 'image' as const,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    opacity: 1,
    assetId: 'as_1',
    fit: 'cover' as const,
  };
  const docWith = (el: object): DesignDocument => ({
    ...createDocument({ width: 200, height: 200 }),
    elements: [el as DesignDocument['elements'][number]],
  });
  const source = { width: 400, height: 400 } as unknown as CanvasImageSource & { width: number; height: number };

  it('asks the resolver for pixels and draws the photo covering the frame', () => {
    const { ctx, calls } = recordingContext();
    const seen: number[] = [];
    renderDocument(ctx, docWith(photo), {
      scale: 1,
      images: (el, pixelScale) => {
        seen.push(pixelScale);
        expect(el.id).toBe('ph');
        return { source, width: 400, height: 400, alpha: false };
      },
    });
    expect(seen).toEqual([2]); // the recording context reports a 2× device transform
    const draw = calls.find((c) => c.name === 'drawImage')!;
    // 400×400 into 100×50 with cover: 100×100, centred on the frame's centre.
    expect(draw.args.slice(1)).toEqual([-50, -50, 100, 100]);
    expect(calls.some((c) => c.name === 'clip')).toBe(true);
  });

  it('draws a drop zone for empty frames and a neutral fill while loading', () => {
    const empty = recordingContext();
    renderDocument(empty.ctx, docWith({ ...photo, assetId: null }), { scale: 1, images: () => undefined });
    expect(empty.calls.some((c) => c.name === 'drawImage')).toBe(false);
    expect(empty.calls.filter((c) => c.name === 'set:fillStyle').map((c) => c.args[0])).toContain('#D9D6E8');

    const loading = recordingContext();
    renderDocument(loading.ctx, docWith(photo), { scale: 1, images: () => undefined });
    expect(loading.calls.filter((c) => c.name === 'set:fillStyle').map((c) => c.args[0])).toContain('rgba(140, 136, 160, 0.28)');
  });

  it('clips to the frame shape and applies flips', () => {
    const { ctx, calls } = recordingContext();
    renderDocument(ctx, docWith({ ...photo, clip: 'ellipse', flipX: true }), {
      scale: 1,
      images: () => ({ source, width: 400, height: 400, alpha: false }),
    });
    expect(calls.some((c) => c.name === 'ellipse')).toBe(true);
    expect(calls.some((c) => c.name === 'scale' && c.args[0] === -1 && c.args[1] === 1)).toBe(true);
  });

  it('draws the vignette over the frame, not the whole photo', () => {
    const { ctx, calls } = recordingContext();
    renderDocument(ctx, docWith({ ...photo, adjust: { vignette: 50 } }), {
      scale: 1,
      images: () => ({ source, width: 400, height: 400, alpha: false }),
    });
    expect(calls.some((c) => c.name === 'createRadialGradient')).toBe(true);
    expect(calls.some((c) => c.name === 'fillRect' && c.args.join() === '-1,-1,2,2')).toBe(true);
  });
});

describe('curved & warped text', () => {
  const glyphsOf = (over: Partial<TextElement>) => {
    const { ctx } = recordingContext();
    const el = text({ text: 'CURVED TEXT', width: 400, align: 'center', ...over });
    return warpedGlyphs(ctx, el, layoutText(ctx, el));
  };

  it('arcs lines around a circle: up for positive, down for negative', () => {
    const up = glyphsOf({ warp: { style: 'arc', amount: 60 } });
    const ys = up.glyphs.map((g) => g.y);
    const mid = Math.floor(ys.length / 2);
    expect(ys[0]!).toBeGreaterThan(ys[mid]!); // the ends droop below the middle
    expect(ys[ys.length - 1]!).toBeGreaterThan(ys[mid]!);
    expect(up.glyphs[0]!.angle).toBeLessThan(0); // left end leans left, right end right
    expect(up.glyphs[up.glyphs.length - 1]!.angle).toBeGreaterThan(0);
    expect(up.above).toBe(0);
    expect(up.below).toBeGreaterThan(0);

    const down = glyphsOf({ warp: { style: 'arc', amount: -60 } });
    const dys = down.glyphs.map((g) => g.y);
    expect(dys[0]!).toBeLessThan(dys[mid]!); // a smile: the ends rise
    expect(down.above).toBeGreaterThan(0);
    // A stronger bend reaches further.
    expect(glyphsOf({ warp: { style: 'arc', amount: 100 } }).below).toBeGreaterThan(up.below);
  });

  it('waves, bulges and rises', () => {
    const wave = glyphsOf({ warp: { style: 'wave', amount: 80 } });
    const straight = layoutText(recordingContext().ctx, text({ text: 'CURVED TEXT', width: 400 }));
    const baseline = straight.lineHeight / 2 + (straight.ascent - straight.descent) / 2;
    expect(wave.glyphs.some((g) => g.y < baseline - 1)).toBe(true);
    expect(wave.glyphs.some((g) => g.y > baseline + 1)).toBe(true);
    expect(wave.above).toBeGreaterThan(0);
    expect(wave.below).toBeGreaterThan(0);

    const bulge = glyphsOf({ warp: { style: 'bulge', amount: 100 } }).glyphs;
    const middle = bulge[Math.floor(bulge.length / 2)]!;
    expect(middle.scaleY).toBeGreaterThan(bulge[0]!.scaleY);

    const rise = glyphsOf({ warp: { style: 'rise', amount: 100 } }).glyphs;
    expect(rise[rise.length - 1]!.scaleY).toBeGreaterThan(rise[0]!.scaleY);
    const fall = glyphsOf({ warp: { style: 'rise', amount: -100 } }).glyphs;
    expect(fall[0]!.scaleY).toBeGreaterThan(fall[fall.length - 1]!.scaleY);
  });

  it('draws each glyph on its own, and straight text is unchanged', () => {
    const { ctx, calls } = recordingContext();
    const doc = createDocument({ width: 400, height: 400 });
    doc.elements = [text({ text: 'HI', width: 300, warp: { style: 'arc', amount: 50 } })];
    renderDocument(ctx, doc, { scale: 1 });
    const fills = calls.filter((c) => c.name === 'fillText');
    expect(fills.map((c) => c.args[0])).toEqual(['H', 'I']);
    expect(calls.some((c) => c.name === 'rotate')).toBe(true);
    expect(isWarped({ warp: { style: 'arc', amount: 0 } })).toBe(false);
    expect(isWarped({})).toBe(false);
  });
});

describe('photo-filled text (text masks)', () => {
  const source = { width: 400, height: 200 } as unknown as CanvasImageSource & { width: number; height: number };

  /** A fresh renderer whose scratch layer is a recording canvas (jsdom has no canvas pixels). */
  async function withLayer() {
    const layers: ReturnType<typeof recordingContext>[] = [];
    class FakeCanvas {
      width: number;
      height: number;
      private layer = recordingContext();
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
        layers.push(this.layer);
      }
      getContext() {
        return this.layer.ctx;
      }
    }
    vi.resetModules();
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const mod = await import('./renderer');
    return { renderDocument: mod.renderDocument, layers };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('shows the photo through the letters, covering the text box', async () => {
    const { renderDocument: render, layers } = await withLayer();
    const doc = createDocument({ width: 400, height: 400 });
    doc.elements = [text({ text: 'HI', photoFill: { assetId: 'as_1', zoom: 1 } })];
    const asked: string[] = [];
    const { ctx, calls } = recordingContext();
    render(ctx, doc, {
      scale: 1,
      images: (el) => {
        asked.push(`${el.id}:${el.assetId}:${el.width}x${el.height}`);
        return { source, width: 400, height: 200, alpha: false };
      },
    });
    expect(asked).toEqual(['t~photo:as_1:200x100']);
    const layer = layers[0]!.calls;
    // Glyphs first, then the photo drawn "source-in" so it only lands on them.
    const glyph = layer.findIndex((c) => c.name === 'fillText');
    const through = layer.findIndex((c) => c.name === 'set:globalCompositeOperation' && c.args[0] === 'source-in');
    const photo = layer.findIndex((c) => c.name === 'drawImage' && c.args[0] === source);
    expect(glyph).toBeGreaterThanOrEqual(0);
    expect(through).toBeGreaterThan(glyph);
    expect(photo).toBeGreaterThan(through);
    // 400×200 covering 200×100: drawn 200×100 around the box's centre.
    expect(layer[photo]!.args.slice(1)).toEqual([-100, -50, 200, 100]);
    // Only the part of the layer this text used is drawn back (2× pixels, a font-size margin).
    const back = calls.find((c) => c.name === 'drawImage')!;
    expect(back.args.slice(1)).toEqual([0, 0, 480, 280, -20, -20, 240, 140]);
    expect(calls.some((c) => c.name === 'fillText')).toBe(false);
  });

  it('uses the text colour while the photo loads or when it is missing', async () => {
    const { renderDocument: render } = await withLayer();
    const doc = createDocument({ width: 400, height: 400 });
    doc.elements = [text({ text: 'HI', photoFill: { assetId: 'as_1' } })];
    for (const answer of [undefined, null]) {
      const { ctx, calls } = recordingContext();
      render(ctx, doc, { scale: 1, images: () => answer });
      expect(calls.filter((c) => c.name === 'fillText').map((c) => c.args[0])).toEqual(['HI']);
      expect(calls.some((c) => c.name === 'drawImage')).toBe(false);
    }
  });

  it('works on warped text too', async () => {
    const { renderDocument: render, layers } = await withLayer();
    const doc = createDocument({ width: 400, height: 400 });
    doc.elements = [text({ text: 'HI', width: 300, warp: { style: 'arc', amount: 50 }, photoFill: { assetId: 'as_1' } })];
    const { ctx } = recordingContext();
    render(ctx, doc, { scale: 1, images: () => ({ source, width: 400, height: 200, alpha: false }) });
    const layer = layers[0]!.calls;
    expect(layer.filter((c) => c.name === 'fillText').map((c) => c.args[0])).toEqual(['H', 'I']);
    expect(layer.some((c) => c.name === 'drawImage' && c.args[0] === source)).toBe(true);
  });
});
