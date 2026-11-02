import { fromHsl, luminance, parseColor, toHsl, type HSL } from '@/utils/color';

/**
 * Colour tools, all on the device: a palette from the photos in a design, and
 * palettes generated around a base colour — colour-theory harmonies plus the
 * looks people ask for (cinematic, pastel, neon, Y2K, dark luxury).
 */

export interface GeneratedPalette {
  id: string;
  name: string;
  description: string;
  colors: string[];
}

const wrap = (h: number) => ((h % 360) + 360) % 360;
const hsl = (h: number, s: number, l: number) =>
  fromHsl({ h: wrap(h), s: Math.max(0, Math.min(100, s)), l: Math.max(0, Math.min(100, l)) });

/** Red/green/blue distance, 0 … ~441. */
function distance(a: string, b: string): number {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return 0;
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
}

/**
 * One palette from many photos' palettes: colours weighted by how prominent
 * they are in each photo, near-identical ones merged, most common first — and
 * always with something light and something dark to set text on.
 */
export function paletteFromPhotos(palettes: string[][], size = 5): string[] {
  const buckets: { color: string; weight: number }[] = [];
  for (const palette of palettes) {
    palette.forEach((color, i) => {
      const weight = 1 / (i + 1);
      const near = buckets.find((b) => distance(b.color, color) < 38);
      if (near) near.weight += weight;
      else buckets.push({ color: color.toUpperCase(), weight });
    });
  }
  const ranked = buckets.sort((a, b) => b.weight - a.weight).map((b) => b.color);
  const out: string[] = [];
  for (const c of ranked) {
    if (out.length >= size) break;
    if (out.every((o) => distance(o, c) > 60)) out.push(c);
  }
  if (out.length === 0) return [];
  // Guarantee contrast for text: add (or swap in) a light and a dark derived from the palette.
  const light = [...out].sort((a, b) => luminance(b) - luminance(a))[0]!;
  const dark = [...out].sort((a, b) => luminance(a) - luminance(b))[0]!;
  const base = toHsl(out[0]!);
  if (luminance(light) < 0.7) out.push(hsl(base.h, Math.min(base.s, 30), 95));
  if (luminance(dark) > 0.08) out.push(hsl(base.h, Math.min(base.s, 40), 10));
  return out.slice(0, size + 2);
}

/** A short read of a palette's mood ("warm · vivid · light"), used by captions and layout. */
export function paletteMood(colors: string[]): string {
  if (colors.length === 0) return 'neutral';
  const hsls = colors.map(toHsl);
  const avg = (f: (c: HSL) => number) => hsls.reduce((n, c) => n + f(c), 0) / hsls.length;
  const warmth = avg((c) => (c.s < 12 ? 0 : Math.cos(((c.h - 30) * Math.PI) / 180)));
  const saturation = avg((c) => c.s);
  const light = avg((c) => c.l);
  return [
    warmth > 0.25 ? 'warm' : warmth < -0.25 ? 'cool' : 'balanced',
    saturation > 55 ? 'vivid' : saturation < 22 ? 'muted' : 'soft',
    light > 62 ? 'light' : light < 32 ? 'dark' : 'mid',
  ].join(' · ');
}

/** Palettes built around a base colour. */
export function generatePalettes(base: string): GeneratedPalette[] {
  const { h, s, l } = toHsl(base);
  const sat = Math.max(s, 35);
  return [
    {
      id: 'complementary',
      name: 'Complementary',
      description: 'Your colour and its opposite — maximum pop.',
      colors: [hsl(h, sat, 50), hsl(h, sat * 0.5, 88), hsl(h + 180, sat, 50), hsl(h + 180, sat * 0.6, 30), hsl(h, 15, 8)],
    },
    {
      id: 'analogous',
      name: 'Analogous',
      description: 'Neighbours on the colour wheel — calm and cohesive.',
      colors: [hsl(h - 30, sat, 52), hsl(h, sat, 50), hsl(h + 30, sat, 55), hsl(h, sat * 0.4, 92), hsl(h, 30, 12)],
    },
    {
      id: 'triadic',
      name: 'Triadic',
      description: 'Three evenly spaced hues — playful and balanced.',
      colors: [hsl(h, sat, 52), hsl(h + 120, sat, 52), hsl(h + 240, sat, 52), hsl(h, 20, 95), hsl(h, 25, 10)],
    },
    {
      id: 'monochromatic',
      name: 'Monochromatic',
      description: 'One hue in five strengths — clean and on-brand.',
      colors: [hsl(h, sat, 94), hsl(h, sat, 78), hsl(h, sat, Math.min(Math.max(l, 40), 60)), hsl(h, sat, 30), hsl(h, sat, 12)],
    },
    {
      id: 'cinematic',
      name: 'Cinematic',
      description: 'Teal shadows, warm highlights — film-poster energy.',
      colors: [hsl(190, 55, 16), hsl(185, 45, 32), hsl(h, sat, 55), hsl(28, 75, 62), hsl(35, 50, 90)],
    },
    {
      id: 'pastel',
      name: 'Pastel',
      description: 'Soft, airy tints — dreamy and light.',
      colors: [hsl(h, 70, 88), hsl(h + 60, 65, 88), hsl(h + 160, 55, 86), hsl(h + 260, 60, 90), hsl(h, 25, 35)],
    },
    {
      id: 'neon',
      name: 'Neon',
      description: 'Electric colours on near-black — nightlife.',
      colors: [hsl(h, 20, 6), hsl(h, 100, 58), hsl(h + 110, 100, 55), hsl(h + 220, 100, 62), hsl(h, 30, 96)],
    },
    {
      id: 'y2k',
      name: 'Y2K',
      description: 'Chrome silver, candy colours, baby blue.',
      colors: [hsl(220, 12, 84), hsl(h, 90, 76), hsl(200, 95, 78), hsl(290, 80, 80), hsl(250, 60, 22)],
    },
    {
      id: 'dark-luxury',
      name: 'Dark luxury',
      description: 'Near-black, cream and gold — quietly expensive.',
      colors: [hsl(h, 12, 6), hsl(h, 10, 16), hsl(40, 52, 58), hsl(40, 35, 90), hsl(h, Math.min(sat, 45), 30)],
    },
  ];
}
