import type { CollageFamily, ShapeElement, StickerElement } from '@/types/document';
import { clamp, degToRad, seededRandom } from '@/utils/math';
import { createId } from '@/utils/id';
import { aspectOf, type Box, type Layer, type LayoutResult, type PhotoRef, type Slot } from './types';

/**
 * Collage generators. Everything is deterministic for a given seed, so a
 * collage can be regenerated exactly (and "Shuffle" is just a new seed).
 *
 * - grid       justified rows that keep each photo's shape (clean / minimal)
 * - editorial  a big hero plus straight guillotine splits (magazine)
 * - bento      varied rounded tiles (aesthetic)
 * - scrapbook  tilted, overlapping photos with white borders (chaotic / Gen-Z)
 * - polaroid   photos in instant-film cards, loosely pinned
 * - filmstrip  frames on strips of film with sprocket holes
 */

export interface CollageParams {
  family: CollageFamily;
  seed: number;
  /** 0 … 1 */
  chaos: number;
  /** Fraction of the box's short side. */
  gutter: number;
  /** Tape and sticker sprinkles. */
  decor?: boolean;
}

type Rng = () => number;
const range = (rnd: Rng, a: number, b: number) => a + (b - a) * rnd();
const signed = (rnd: Rng) => rnd() * 2 - 1;

export function shuffle<T>(items: T[], rnd: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const softShadow = (size: number) => ({ color: 'rgba(11,10,18,0.28)', blur: size * 0.05, x: 0, y: size * 0.018 });

const rotateVec = (x: number, y: number, deg: number) => {
  const r = degToRad(deg);
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
};

/* ───────────── Justified grid ───────────── */

/** Contiguous split of `weights` into `rows` groups with sums as even as possible. */
export function linearPartition(weights: number[], rows: number): number[][] {
  const n = weights.length;
  const k = clamp(rows, 1, n);
  const prefix = [0];
  for (const w of weights) prefix.push(prefix[prefix.length - 1]! + w);
  const target = prefix[n]! / k;
  const cost = (i: number, j: number) => (prefix[j]! - prefix[i]! - target) ** 2;
  // dp[r][j] = best cost for first j items in r rows.
  const dp = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(Infinity));
  const cut = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(0));
  dp[0]![0] = 0;
  for (let r = 1; r <= k; r++) {
    for (let j = r; j <= n; j++) {
      for (let i = r - 1; i < j; i++) {
        const c = dp[r - 1]![i]! + cost(i, j);
        if (c < dp[r]![j]!) {
          dp[r]![j] = c;
          cut[r]![j] = i;
        }
      }
    }
  }
  const groups: number[][] = [];
  let j = n;
  for (let r = k; r >= 1; r--) {
    const i = cut[r]![j]!;
    groups.unshift(Array.from({ length: j - i }, (_, t) => i + t));
    j = i;
  }
  return groups;
}

function justified(photos: PhotoRef[], box: Box, gap: number, radius: number): Slot[] {
  const aspects = photos.map(aspectOf);
  let best: { rows: number[][]; natural: number } | null = null;
  for (let r = 1; r <= photos.length; r++) {
    const rows = linearPartition(aspects, r);
    const natural =
      rows.reduce((h, row) => h + (box.width - gap * (row.length - 1)) / row.reduce((s, i) => s + aspects[i]!, 0), 0) +
      gap * (rows.length - 1);
    if (!best || Math.abs(Math.log(natural / box.height)) < Math.abs(Math.log(best.natural / box.height))) {
      best = { rows, natural };
    }
  }
  const { rows } = best!;
  const natural = rows.map((row) => (box.width - gap * (row.length - 1)) / row.reduce((s, i) => s + aspects[i]!, 0));
  const scale = (box.height - gap * (rows.length - 1)) / natural.reduce((a, b) => a + b, 0);
  const slots: Slot[] = new Array(photos.length);
  let y = box.y;
  rows.forEach((row, ri) => {
    const h = natural[ri]! * scale;
    const sum = row.reduce((s, i) => s + aspects[i]!, 0);
    let x = box.x;
    for (const i of row) {
      const w = ((box.width - gap * (row.length - 1)) * aspects[i]!) / sum;
      slots[i] = { x, y, width: w, height: h, rotation: 0, cornerRadius: radius || undefined };
      x += w + gap;
    }
    y += h + gap;
  });
  return slots;
}

/* ───────────── Guillotine splits (editorial, bento) ───────────── */

function splitBox(box: Box, count: number, rnd: Rng, gap: number, heroFirst: boolean, spread: number): Box[] {
  if (count <= 1) return [box];
  const sideBySide = box.width >= box.height;
  let first: number;
  let ratio: number;
  if (heroFirst) {
    first = 1;
    ratio = count === 2 ? range(rnd, 0.5, 0.6) : range(rnd, 0.54, 0.66);
  } else {
    first = clamp(Math.round(count / 2 + (count > 3 ? signed(rnd) * 0.6 : 0)), 1, count - 1);
    ratio = clamp(first / count + signed(rnd) * spread, 0.28, 0.72);
  }
  const len = (sideBySide ? box.width : box.height) - gap;
  const a = len * ratio;
  const A: Box = sideBySide ? { ...box, width: a } : { ...box, height: a };
  const B: Box = sideBySide ? { ...box, x: box.x + a + gap, width: len - a } : { ...box, y: box.y + a + gap, height: len - a };
  return [...splitBox(A, first, rnd, gap, false, spread), ...splitBox(B, count - first, rnd, gap, false, spread)];
}

/** Gives each photo the remaining cell whose shape matches it best (the first photo gets the biggest cell). */
function assignByShape(photos: PhotoRef[], cells: Box[]): number[] {
  const free = new Set(cells.map((_, i) => i));
  const assign = new Array<number>(photos.length);
  const area = (b: Box) => b.width * b.height;
  const largest = [...free].sort((a, b) => area(cells[b]!) - area(cells[a]!))[0]!;
  assign[0] = largest;
  free.delete(largest);
  for (let i = 1; i < photos.length; i++) {
    const a = aspectOf(photos[i]!);
    let best = -1;
    let bestScore = Infinity;
    for (const c of free) {
      const score = Math.abs(Math.log(a / aspectOf(cells[c]!)));
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    assign[i] = best;
    free.delete(best);
  }
  return assign;
}

/* ───────────── Scatter (scrapbook, polaroid) ───────────── */

function scatterCells(n: number, box: Box, rnd: Rng, chaos: number) {
  const cols = clamp(Math.round(Math.sqrt((n * box.width) / box.height)), 1, n);
  const rows = Math.ceil(n / cols);
  const cellW = box.width / cols;
  const cellH = box.height / rows;
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
    const offset = ((cols - inRow) * cellW) / 2;
    return {
      cx: box.x + offset + (col + 0.5) * cellW + signed(rnd) * chaos * 0.22 * cellW,
      cy: box.y + (row + 0.5) * cellH + signed(rnd) * chaos * 0.22 * cellH,
      cellW,
      cellH,
    };
  });
}

/** Scale (≤ 1) that makes a rotated w×h box fit inside maxW × maxH. */
function fitRotated(w: number, h: number, deg: number, maxW: number, maxH: number): number {
  const r = degToRad(deg);
  const bw = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r));
  const bh = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
  return Math.min(1, maxW / bw, maxH / bh);
}

/** Keeps a rotated w×h box centred at (cx, cy) inside `box` where possible. */
function keepInside(box: Box, cx: number, cy: number, w: number, h: number, deg: number) {
  const r = degToRad(deg);
  const hx = (Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))) / 2;
  const hy = (Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r))) / 2;
  const x = hx * 2 < box.width ? clamp(cx, box.x + hx, box.x + box.width - hx) : box.x + box.width / 2;
  const y = hy * 2 < box.height ? clamp(cy, box.y + hy, box.y + box.height - hy) : box.y + box.height / 2;
  return { x, y };
}

function sticker(stickerId: string, cx: number, cy: number, size: number, rotation: number): StickerElement {
  return {
    id: createId('el'),
    type: 'sticker',
    stickerId,
    x: cx - size / 2,
    y: cy - size / 2,
    width: size,
    height: size,
    rotation,
    opacity: 1,
    ...(stickerId.startsWith('vector:') ? { tint: stickerId === 'vector:tape' ? '#F5E6B8' : '#FFD23D' } : {}),
  };
}

const SPRINKLES = ['emoji:✨', 'emoji:🦋', 'emoji:⭐', 'vector:sparkle', 'emoji:🫶', 'vector:heart'];

function sprinkle(box: Box, rnd: Rng, count: number): Layer[] {
  const s = Math.min(box.width, box.height);
  return Array.from({ length: count }, () => ({
    decor: sticker(
      SPRINKLES[Math.floor(rnd() * SPRINKLES.length)]!,
      range(rnd, box.x + s * 0.08, box.x + box.width - s * 0.08),
      range(rnd, box.y + s * 0.08, box.y + box.height - s * 0.08),
      s * range(rnd, 0.08, 0.13),
      signed(rnd) * 20,
    ),
  }));
}

function scrapbook(photos: PhotoRef[], box: Box, rnd: Rng, p: CollageParams): LayoutResult {
  const n = photos.length;
  const cells = scatterCells(n, box, rnd, p.chaos);
  const slots: Slot[] = [];
  const tape: Layer[] = [];
  cells.forEach((cell, i) => {
    const a = clamp(aspectOf(photos[i]!), 0.5, 2);
    const base = Math.min(cell.cellW, cell.cellH) * (0.9 + 0.45 * p.chaos) * range(rnd, 0.88, 1.12);
    let w = Math.min(base * Math.sqrt(a), cell.cellW * 1.45);
    let h = Math.min(base / Math.sqrt(a), cell.cellH * 1.45);
    const rotation = signed(rnd) * (2 + 13 * p.chaos);
    // Never wider/taller than the area once tilted (it would spill onto the next slide).
    const fit = fitRotated(w, h, rotation, box.width * 0.98, box.height * 0.98);
    w *= fit;
    h *= fit;
    const c = keepInside(box, cell.cx, cell.cy, w, h, rotation);
    const border = Math.max(2, Math.min(w, h) * 0.035);
    slots.push({
      x: c.x - w / 2,
      y: c.y - h / 2,
      width: w,
      height: h,
      rotation,
      stroke: { color: '#FFFFFF', width: border },
      shadow: softShadow(Math.min(w, h)),
    });
    if (p.decor && rnd() < 0.45) {
      const top = rotateVec(0, -h / 2, rotation);
      tape.push({ decor: sticker('vector:tape', c.x + top.x, c.y + top.y, w * 0.34, rotation + signed(rnd) * 10) });
    }
  });
  const order = shuffle(
    slots.map((_, i) => i),
    rnd,
  );
  const layers: Layer[] = [...order.map((slot) => ({ slot })), ...tape];
  if (p.decor) layers.push(...sprinkle(box, rnd, Math.min(6, 1 + Math.round(p.chaos * n * 0.35))));
  return { slots, assign: photos.map((_, i) => i), layers };
}

function polaroid(photos: PhotoRef[], box: Box, rnd: Rng, p: CollageParams): LayoutResult {
  const n = photos.length;
  const chaos = p.chaos * 0.7;
  const cells = scatterCells(n, box, rnd, chaos);
  const slots: Slot[] = [];
  const layers: Layer[] = [];
  const order = shuffle(
    cells.map((_, i) => i),
    rnd,
  );
  const cards = new Map<number, ShapeElement>();
  cells.forEach((cell, i) => {
    const a = clamp(aspectOf(photos[i]!), 0.8, 1.25);
    let cardW = Math.min(cell.cellW, cell.cellH * 0.9) * (0.86 + 0.3 * chaos);
    const pad = () => cardW * 0.06;
    const bottom = () => cardW * 0.22;
    const cardH = () => (cardW - 2 * pad()) / a + pad() + bottom();
    if (cardH() > cell.cellH * 1.05) cardW *= (cell.cellH * 1.05) / cardH();
    const rotation = signed(rnd) * (2 + 9 * chaos);
    cardW *= fitRotated(cardW, cardH(), rotation, box.width * 0.98, box.height * 0.98);
    const c = keepInside(box, cell.cx, cell.cy, cardW, cardH(), rotation);
    const innerW = cardW - 2 * pad();
    const innerH = innerW / a;
    const offset = rotateVec(0, -cardH() / 2 + pad() + innerH / 2, rotation);
    slots.push({ x: c.x + offset.x - innerW / 2, y: c.y + offset.y - innerH / 2, width: innerW, height: innerH, rotation });
    cards.set(i, {
      id: createId('el'),
      type: 'shape',
      shape: 'rect',
      x: c.x - cardW / 2,
      y: c.y - cardH() / 2,
      width: cardW,
      height: cardH(),
      rotation,
      opacity: 1,
      fill: { type: 'solid', color: '#FFFFFF' },
      cornerRadius: cardW * 0.012,
      shadow: softShadow(cardW),
    });
  });
  for (const i of order) layers.push({ decor: cards.get(i)! }, { slot: i });
  if (p.decor) {
    for (const i of order) {
      if (rnd() > 0.4) continue;
      const card = cards.get(i)!;
      const top = rotateVec(0, -card.height / 2, card.rotation);
      layers.push({
        decor: sticker(
          'vector:tape',
          card.x + card.width / 2 + top.x,
          card.y + card.height / 2 + top.y,
          card.width * 0.36,
          card.rotation + signed(rnd) * 12,
        ),
      });
    }
    layers.push(...sprinkle(box, rnd, Math.min(5, 1 + Math.round(p.chaos * n * 0.3))));
  }
  return { slots, assign: photos.map((_, i) => i), layers };
}

/* ───────────── Film strip ───────────── */

function filmstrip(photos: PhotoRef[], box: Box, rnd: Rng, p: CollageParams): LayoutResult {
  const n = photos.length;
  const rows = n <= 3 ? 1 : n <= 8 ? 2 : 3;
  const perRow = Math.ceil(n / rows);
  const frameAspect = box.width > box.height * 1.3 ? 1.5 : 1.25;
  const gap = Math.min(box.width, box.height) * 0.02;
  // Largest frames that fit the widest row and the stack of strips.
  let frameW = (box.width * 0.96 - gap * (perRow + 1)) / perRow;
  let frameH = frameW / frameAspect;
  const stripH = () => frameH / 0.7;
  const maxStrip = (box.height * 0.96 - gap * 2 * (rows - 1)) / rows;
  if (stripH() > maxStrip) {
    frameH = maxStrip * 0.7;
    frameW = frameH * frameAspect;
  }
  const slots: Slot[] = [];
  const layers: Layer[] = [];
  const totalH = rows * stripH() + gap * 2 * (rows - 1);
  for (let r = 0; r < rows; r++) {
    const items = Math.min(perRow, n - r * perRow);
    if (items <= 0) break;
    const stripW = items * frameW + gap * (items + 1);
    const cx = box.x + box.width / 2 + signed(rnd) * p.chaos * box.width * 0.04;
    const cy = box.y + (box.height - totalH) / 2 + r * (stripH() + gap * 2) + stripH() / 2;
    const rotation = signed(rnd) * p.chaos * 6;
    const place = (lx: number, ly: number) => {
      const v = rotateVec(lx, ly, rotation);
      return { x: cx + v.x, y: cy + v.y };
    };
    const strip: ShapeElement = {
      id: createId('el'),
      type: 'shape',
      shape: 'rect',
      x: cx - stripW / 2,
      y: cy - stripH() / 2,
      width: stripW,
      height: stripH(),
      rotation,
      opacity: 1,
      fill: { type: 'solid', color: '#141318' },
      shadow: p.chaos > 0.2 ? softShadow(stripH()) : undefined,
    };
    layers.push({ decor: strip });
    const holeW = stripH() * 0.065;
    const holeH = stripH() * 0.085;
    const holes = Math.max(2, Math.floor(stripW / (holeW * 2.4)));
    const step = stripW / holes;
    for (const edge of [-1, 1]) {
      for (let h = 0; h < holes; h++) {
        const c = place(-stripW / 2 + step * (h + 0.5), edge * (stripH() / 2 - stripH() * 0.08));
        layers.push({
          decor: {
            id: createId('el'),
            type: 'shape',
            shape: 'rect',
            x: c.x - holeW / 2,
            y: c.y - holeH / 2,
            width: holeW,
            height: holeH,
            rotation,
            opacity: 1,
            fill: { type: 'solid', color: '#EDE8DF' },
            cornerRadius: holeW * 0.3,
          } satisfies ShapeElement,
        });
      }
    }
    for (let k = 0; k < items; k++) {
      const c = place(-stripW / 2 + gap + frameW / 2 + k * (frameW + gap), 0);
      const slot = slots.length;
      slots.push({ x: c.x - frameW / 2, y: c.y - frameH / 2, width: frameW, height: frameH, rotation });
      layers.push({ slot });
    }
  }
  return { slots, assign: photos.map((_, i) => i), layers };
}

/* ───────────── Entry point ───────────── */

export function generateCollage(photos: PhotoRef[], box: Box, params: CollageParams): LayoutResult {
  const n = photos.length;
  if (n === 0) return { slots: [], assign: [], layers: [] };
  const rnd = seededRandom(params.seed);
  const short = Math.min(box.width, box.height);
  const gap = clamp(params.gutter, 0, 0.1) * short;
  const chaos = clamp(params.chaos, 0, 1);
  const p = { ...params, chaos };
  switch (params.family) {
    case 'grid': {
      // A little chaos reorders photos; the grid itself stays tidy.
      const order =
        chaos > 0
          ? shuffle(
              photos.map((_, i) => i),
              rnd,
            )
          : photos.map((_, i) => i);
      const slotsByOrder = justified(
        order.map((i) => photos[i]!),
        box,
        gap,
        chaos > 0.3 ? short * 0.015 : 0,
      );
      const slots = new Array<Slot>(n);
      order.forEach((photoIndex, k) => (slots[photoIndex] = slotsByOrder[k]!));
      return { slots, assign: photos.map((_, i) => i), layers: slots.map((_, i) => ({ slot: i })) };
    }
    case 'editorial':
    case 'bento': {
      const editorial = params.family === 'editorial';
      const cells = splitBox(box, n, rnd, gap, editorial && n > 2, editorial ? 0.08 : 0.12 + chaos * 0.1);
      const radius = editorial ? 0 : short * 0.03;
      const slots: Slot[] = cells.map((c) => ({ ...c, rotation: 0, cornerRadius: radius || undefined }));
      return { slots, assign: assignByShape(photos, cells), layers: slots.map((_, i) => ({ slot: i })) };
    }
    case 'scrapbook':
      return scrapbook(photos, box, rnd, p);
    case 'polaroid':
      return polaroid(photos, box, rnd, p);
    case 'filmstrip':
      return filmstrip(photos, box, rnd, p);
  }
}

/** Collage "moods" behind the More chaotic / minimal / aesthetic / editorial / Gen-Z buttons. */
export type CollageMood = 'chaotic' | 'minimal' | 'aesthetic' | 'editorial' | 'genz';

export function moodParams(
  mood: CollageMood,
  current: Pick<CollageParams, 'family' | 'chaos' | 'gutter' | 'decor'>,
): Pick<CollageParams, 'family' | 'chaos' | 'gutter' | 'decor'> {
  switch (mood) {
    case 'chaotic':
      return {
        family: current.family === 'polaroid' ? 'polaroid' : 'scrapbook',
        chaos: clamp((current.family === 'scrapbook' || current.family === 'polaroid' ? current.chaos : 0.35) + 0.2, 0, 1),
        gutter: current.gutter,
        decor: current.decor,
      };
    case 'minimal':
      return { family: 'grid', chaos: 0, gutter: clamp(Math.max(current.gutter, 0.02) + 0.015, 0, 0.08), decor: false };
    case 'aesthetic':
      return { family: 'bento', chaos: 0.2, gutter: 0.025, decor: false };
    case 'editorial':
      return { family: 'editorial', chaos: 0.05, gutter: 0.012, decor: false };
    case 'genz':
      return {
        family: current.family === 'scrapbook' ? 'polaroid' : 'scrapbook',
        chaos: Math.max(0.6, current.chaos),
        gutter: current.gutter,
        decor: true,
      };
  }
}

export const FAMILY_LABELS: Record<CollageFamily, string> = {
  grid: 'Grid',
  editorial: 'Editorial',
  bento: 'Bento',
  scrapbook: 'Scrapbook',
  polaroid: 'Polaroid',
  filmstrip: 'Film strip',
};

export function defaultCollageParams(family: CollageFamily, seed: number): CollageParams {
  switch (family) {
    case 'grid':
      return { family, seed, chaos: 0, gutter: 0.02 };
    case 'editorial':
      return { family, seed, chaos: 0.05, gutter: 0.012 };
    case 'bento':
      return { family, seed, chaos: 0.2, gutter: 0.025 };
    case 'scrapbook':
      return { family, seed, chaos: 0.55, gutter: 0.02, decor: true };
    case 'polaroid':
      return { family, seed, chaos: 0.45, gutter: 0.02, decor: false };
    case 'filmstrip':
      return { family, seed, chaos: 0.15, gutter: 0.02 };
  }
}
