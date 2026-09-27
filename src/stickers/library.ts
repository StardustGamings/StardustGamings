import type { StickerArt } from '@/types/document';

/**
 * Built-in sticker library. Every vector sticker is original artwork drawn on a
 * 100×100 grid. Layers with `fill: 'tint'` / `stroke: 'tint'` take the user's
 * recolour; other colours are fixed accents.
 */

export interface StickerLayer {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export type StickerCategory =
  | 'emojis'
  | 'arrows'
  | 'stars'
  | 'hearts'
  | 'doodles'
  | 'y2k'
  | 'gaming'
  | 'memes'
  | 'cute'
  | 'streetwear'
  | 'handwritten'
  | 'shapes'
  | 'social';

export interface VectorSticker {
  id: string;
  name: string;
  category: StickerCategory;
  defaultTint: string;
  layers: StickerLayer[];
}

export interface EmojiSticker {
  id: string;
  name: string;
  category: 'emojis';
  char: string;
}

const INK = '#0B0A12';

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

function starPath(points: number, inner: number, rotation = -90, cx = 50, cy = 50, r = 48): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * inner;
    const angle = ((rotation + (i * 180) / points) * Math.PI) / 180;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return parts.join(' ') + ' Z';
}

function pixelPath(rows: string[], size = 100): string {
  const cell = size / Math.max(rows.length, rows[0]!.length);
  const parts: string[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') parts.push(`M${x * cell} ${y * cell}h${cell}v${cell}h${-cell}Z`);
    }),
  );
  return parts.join(' ');
}

export const VECTOR_STICKERS: VectorSticker[] = [
  {
    id: 'sparkle',
    name: 'Sparkle',
    category: 'stars',
    defaultTint: '#C6FF3D',
    layers: [{ d: 'M50 2 C53 36 64 47 98 50 C64 53 53 64 50 98 C47 64 36 53 2 50 C36 47 47 36 50 2 Z', fill: 'tint' }],
  },
  {
    id: 'twin-sparkle',
    name: 'Twin sparkle',
    category: 'y2k',
    defaultTint: '#FFFFFF',
    layers: [
      { d: 'M38 6 C40 32 48 40 74 42 C48 44 40 52 38 78 C36 52 28 44 2 42 C28 40 36 32 38 6 Z', fill: 'tint' },
      { d: 'M78 56 C79 70 83 74 97 75 C83 76 79 80 78 94 C77 80 73 76 59 75 C73 74 77 70 78 56 Z', fill: 'tint' },
    ],
  },
  {
    id: 'burst',
    name: 'Burst badge',
    category: 'shapes',
    defaultTint: '#FFD23D',
    layers: [{ d: starPath(16, 0.8), fill: 'tint' }],
  },
  {
    id: 'y2k-star',
    name: 'Chrome star',
    category: 'y2k',
    defaultTint: '#C6D4FF',
    layers: [{ d: starPath(8, 0.36, -90), fill: 'tint' }],
  },
  {
    id: 'star',
    name: 'Star',
    category: 'stars',
    defaultTint: '#FFD23D',
    layers: [{ d: starPath(5, 0.45), fill: 'tint', stroke: INK, strokeWidth: 3 }],
  },
  {
    id: 'heart',
    name: 'Heart',
    category: 'hearts',
    defaultTint: '#FF4F8B',
    layers: [
      {
        d: 'M50 90 C20 68 4 52 4 32 C4 17 15 7 29 7 C39 7 46 13 50 21 C54 13 61 7 71 7 C85 7 96 17 96 32 C96 52 80 68 50 90 Z',
        fill: 'tint',
      },
    ],
  },
  {
    id: 'heart-outline',
    name: 'Doodle heart',
    category: 'hearts',
    defaultTint: '#FF4F8B',
    layers: [
      {
        d: 'M50 86 C22 66 8 52 8 34 C8 20 18 11 30 11 C40 11 46 17 50 25 C54 17 60 11 70 11 C82 11 92 20 92 34 C92 52 78 66 50 86 Z M44 30 L40 36',
        stroke: 'tint',
        strokeWidth: 6,
      },
    ],
  },
  {
    id: 'pixel-heart',
    name: 'Pixel heart',
    category: 'gaming',
    defaultTint: '#FF3D71',
    layers: [
      {
        d: pixelPath([
          '..##..##..',
          '.########.',
          '##########',
          '##########',
          '##########',
          '.########.',
          '..######..',
          '...####...',
          '....##....',
          '..........',
        ]),
        fill: 'tint',
      },
    ],
  },
  {
    id: 'arrow-curve',
    name: 'Curvy arrow',
    category: 'arrows',
    defaultTint: '#0B0A12',
    layers: [{ d: 'M10 80 C22 36 52 18 86 30 M70 16 L88 31 L70 46', stroke: 'tint', strokeWidth: 6 }],
  },
  {
    id: 'arrow-loop',
    name: 'Loop arrow',
    category: 'handwritten',
    defaultTint: '#0B0A12',
    layers: [
      {
        d: 'M8 70 C30 72 48 60 50 44 C52 28 36 26 34 40 C32 56 58 64 90 50 M76 40 L91 50 L78 62',
        stroke: 'tint',
        strokeWidth: 5,
      },
    ],
  },
  {
    id: 'arrow-bold',
    name: 'Bold arrow',
    category: 'arrows',
    defaultTint: '#C6FF3D',
    layers: [{ d: 'M6 38 H58 V18 L96 50 L58 82 V62 H6 Z', fill: 'tint', stroke: INK, strokeWidth: 4 }],
  },
  {
    id: 'squiggle',
    name: 'Squiggle',
    category: 'doodles',
    defaultTint: '#A06BFF',
    layers: [{ d: 'M4 54 C14 30 24 78 36 54 S56 30 66 54 S86 78 96 50', stroke: 'tint', strokeWidth: 7 }],
  },
  {
    id: 'scribble-circle',
    name: 'Circled',
    category: 'handwritten',
    defaultTint: '#FF3D71',
    layers: [
      { d: 'M70 14 C40 4 8 18 8 48 C8 78 40 92 66 86 C90 80 98 56 90 36 C84 22 66 12 44 14', stroke: 'tint', strokeWidth: 4 },
    ],
  },
  {
    id: 'lightning',
    name: 'Bolt',
    category: 'streetwear',
    defaultTint: '#FFD23D',
    layers: [{ d: 'M60 3 L18 58 H46 L36 97 L84 38 H55 L66 3 Z', fill: 'tint', stroke: INK, strokeWidth: 3 }],
  },
  {
    id: 'smiley',
    name: 'Smiley',
    category: 'cute',
    defaultTint: '#FFE14D',
    layers: [
      { d: circle(50, 50, 46), fill: 'tint', stroke: INK, strokeWidth: 3 },
      { d: `${circle(36, 40, 6)} ${circle(64, 40, 6)}`, fill: INK },
      { d: 'M30 60 C38 76 62 76 70 60', stroke: INK, strokeWidth: 5 },
    ],
  },
  {
    id: 'daisy',
    name: 'Daisy',
    category: 'cute',
    defaultTint: '#FFFFFF',
    layers: [
      {
        d: Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return circle(50 + Math.cos(a) * 28, 50 + Math.sin(a) * 28, 17);
        }).join(' '),
        fill: 'tint',
        stroke: INK,
        strokeWidth: 2,
      },
      { d: circle(50, 50, 15), fill: '#FFC93D', stroke: INK, strokeWidth: 2 },
    ],
  },
  {
    id: 'crown',
    name: 'Crown',
    category: 'streetwear',
    defaultTint: '#FFD23D',
    layers: [
      { d: 'M8 78 L14 26 L34 50 L50 14 L66 50 L86 26 L92 78 Z M8 84 H92 V94 H8 Z', fill: 'tint', stroke: INK, strokeWidth: 3 },
    ],
  },
  {
    id: 'speech',
    name: 'Speech bubble',
    category: 'memes',
    defaultTint: '#FFFFFF',
    layers: [
      {
        d: 'M18 8 H82 C90 8 96 14 96 22 V60 C96 68 90 74 82 74 H44 L22 94 L26 74 H18 C10 74 4 68 4 60 V22 C4 14 10 8 18 8 Z',
        fill: 'tint',
        stroke: INK,
        strokeWidth: 4,
      },
    ],
  },
  {
    id: 'blob',
    name: 'Blob',
    category: 'shapes',
    defaultTint: '#A06BFF',
    layers: [
      { d: 'M52 6 C74 4 96 20 94 44 C92 62 98 80 78 92 C58 102 36 94 22 84 C6 72 2 52 8 34 C14 16 32 8 52 6 Z', fill: 'tint' },
    ],
  },
  {
    id: 'checkmark',
    name: 'Check',
    category: 'shapes',
    defaultTint: '#3CF0C8',
    layers: [
      { d: circle(50, 50, 46), fill: 'tint' },
      { d: 'M28 52 L44 68 L74 34', stroke: INK, strokeWidth: 9 },
    ],
  },
  {
    id: 'globe-y2k',
    name: 'Wire globe',
    category: 'y2k',
    defaultTint: '#3CF0FF',
    layers: [
      {
        d: `${circle(50, 50, 44)} M6 50 H94 M50 6 C28 26 28 74 50 94 M50 6 C72 26 72 74 50 94 M12 30 H88 M12 70 H88`,
        stroke: 'tint',
        strokeWidth: 3,
      },
    ],
  },
  {
    id: 'controller',
    name: 'Controller',
    category: 'gaming',
    defaultTint: '#A06BFF',
    layers: [
      {
        d: 'M24 26 H76 C90 26 98 40 98 58 C98 76 88 82 80 80 C72 78 68 66 60 66 H40 C32 66 28 78 20 80 C12 82 2 76 2 58 C2 40 10 26 24 26 Z',
        fill: 'tint',
        stroke: INK,
        strokeWidth: 3,
      },
      { d: `M20 46 H36 M28 38 V54 ${circle(70, 42, 4)} ${circle(80, 52, 4)}`, stroke: INK, strokeWidth: 4, fill: INK },
    ],
  },
  {
    id: 'like',
    name: 'Like',
    category: 'social',
    defaultTint: '#FF3D71',
    layers: [
      { d: circle(50, 50, 46), fill: 'tint' },
      {
        d: 'M50 72 C34 60 26 52 26 41 C26 33 32 28 39 28 C44 28 48 31 50 35 C52 31 56 28 61 28 C68 28 74 33 74 41 C74 52 66 60 50 72 Z',
        fill: '#FFFFFF',
      },
    ],
  },
  {
    id: 'comment',
    name: 'Comment',
    category: 'social',
    defaultTint: '#0B0A12',
    layers: [
      {
        d: 'M50 10 C74 10 92 26 92 46 C92 66 74 82 50 82 C44 82 38 81 33 79 L12 88 L18 70 C11 63 8 55 8 46 C8 26 26 10 50 10 Z',
        stroke: 'tint',
        strokeWidth: 6,
      },
    ],
  },
  {
    id: 'share',
    name: 'Send',
    category: 'social',
    defaultTint: '#0B0A12',
    layers: [{ d: 'M8 14 L92 14 L46 90 L40 50 Z M40 50 L92 14', stroke: 'tint', strokeWidth: 6 }],
  },
  {
    id: 'bookmark',
    name: 'Save',
    category: 'social',
    defaultTint: '#0B0A12',
    layers: [{ d: 'M22 8 H78 V92 L50 68 L22 92 Z', stroke: 'tint', strokeWidth: 6 }],
  },
  {
    id: 'tape',
    name: 'Washi tape',
    category: 'doodles',
    defaultTint: '#FFC6E8',
    layers: [
      {
        d: 'M4 34 L10 30 L14 36 L20 30 L96 30 L92 36 L96 42 L92 48 L96 54 L92 60 L96 66 L90 70 L4 70 L8 64 L4 58 L8 52 L4 46 L8 40 Z',
        fill: 'tint',
      },
    ],
  },
  {
    id: 'skull',
    name: 'Skull',
    category: 'memes',
    defaultTint: '#FFFFFF',
    layers: [
      {
        d: 'M50 6 C74 6 92 22 92 46 C92 60 86 68 78 72 V88 C78 92 76 94 72 94 H28 C24 94 22 92 22 88 V72 C14 68 8 60 8 46 C8 22 26 6 50 6 Z',
        fill: 'tint',
        stroke: INK,
        strokeWidth: 3,
      },
      { d: `${circle(34, 48, 10)} ${circle(66, 48, 10)} M50 60 L44 72 H56 Z`, fill: INK },
    ],
  },
];

export const EMOJI_STICKERS: EmojiSticker[] = [
  ['🔥', 'Fire'],
  ['✨', 'Sparkles'],
  ['💀', 'Dead'],
  ['😭', 'Crying'],
  ['🫶', 'Heart hands'],
  ['👀', 'Eyes'],
  ['💅', 'Nails'],
  ['🌸', 'Blossom'],
  ['🦋', 'Butterfly'],
  ['💿', 'Disc'],
  ['🍒', 'Cherries'],
  ['⭐', 'Star'],
  ['🌈', 'Rainbow'],
  ['🎀', 'Bow'],
  ['📸', 'Camera'],
  ['🌙', 'Moon'],
].map(([char, name]) => ({ id: `emoji:${char}`, name: name!, category: 'emojis' as const, char: char! }));

const vectorById = new Map(VECTOR_STICKERS.map((s) => [s.id, s]));
const emojiById = new Map(EMOJI_STICKERS.map((s) => [s.id, s]));

export type ResolvedSticker = { kind: 'vector'; sticker: VectorSticker } | { kind: 'emoji'; sticker: EmojiSticker };

/** Sticker art from trend packs, by id (`art:<id>`). Elements carry their own copy, so this only serves pickers. */
const artById = new Map<string, StickerArt>();

export function registerStickerArt(list: { id: string; art: StickerArt }[]): void {
  for (const { id, art } of list) artById.set(id, art);
}

export const stickerArtFor = (ref: string): StickerArt | undefined =>
  ref.startsWith('art:') ? artById.get(ref.slice(4)) : undefined;

const artSticker = (id: string, art: StickerArt): VectorSticker => ({
  id,
  name: art.name,
  category: 'doodles',
  defaultTint: art.defaultTint,
  layers: art.layers,
});

/**
 * Resolves `vector:<id>` or `emoji:<char>` references, and `art:<id>` from the
 * element's own `art` (or a registered trend pack).
 */
export function resolveSticker(ref: string, art?: StickerArt): ResolvedSticker | null {
  if (ref.startsWith('art:')) {
    const found = art ?? artById.get(ref.slice(4));
    return found ? { kind: 'vector', sticker: artSticker(ref.slice(4), found) } : null;
  }
  if (ref.startsWith('vector:')) {
    const sticker = vectorById.get(ref.slice(7));
    return sticker ? { kind: 'vector', sticker } : null;
  }
  if (ref.startsWith('emoji:')) {
    const sticker = emojiById.get(ref) ?? { id: ref, name: 'Emoji', category: 'emojis' as const, char: ref.slice(6) };
    return { kind: 'emoji', sticker };
  }
  return null;
}

export const stickerName = (ref: string): string => resolveSticker(ref)?.sticker.name ?? 'Sticker';
