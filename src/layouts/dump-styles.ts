import type { CollageFamily, Fill, ImageAdjustments } from '@/types/document';

/**
 * Smart Photo Dump styles — plain design rules, no AI. Each style decides the
 * backgrounds, how many photos go on each slide and how they're arranged, the
 * cover, typography, stickers and a photo "look" (adjustments from Phase 3).
 */
export interface DumpStyle {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** `palette-light` / `palette-dark` derive the colour from the photos. */
  background: Fill | 'palette-light' | 'palette-dark';
  /** Alternate slide tints from the photos' palette (light variants). */
  tintSlides?: boolean;
  cover: 'full-bleed' | 'framed' | 'collage';
  /** Photos per content slide, cycled. */
  perSlide: number[];
  collage: { family: CollageFamily; chaos: number; gutter: number; decor?: boolean };
  /** Margin around collages, fraction of the slide's short side. */
  margin: number;
  title: { preset: string; text: string; placement: 'top' | 'bottom' | 'center' };
  /** Small caption on content slides: counter (01/08), or a fixed line. */
  caption?: { preset: string; kind: 'counter' | 'text'; text?: string };
  stickers: string[];
  /** Stickers on the cover (0 … 4). */
  coverStickers: number;
  adjust?: ImageAdjustments;
  /** Cinematic letterbox bars on full-bleed slides. */
  letterbox?: boolean;
}

export const DUMP_STYLES: DumpStyle[] = [
  {
    id: 'chaotic',
    name: 'Chaotic Gen-Z',
    emoji: '🌀',
    blurb: 'Tilted, overlapping, stickered.',
    background: 'palette-light',
    tintSlides: true,
    cover: 'collage',
    perSlide: [3, 4, 3, 5],
    collage: { family: 'scrapbook', chaos: 0.85, gutter: 0.02, decor: true },
    margin: 0.04,
    title: { preset: 'meme', text: 'photo dump 📸', placement: 'top' },
    stickers: ['emoji:✨', 'emoji:💀', 'emoji:😭', 'emoji:🫶', 'emoji:🦋'],
    coverStickers: 3,
    adjust: { contrast: 8, vibrance: 15 },
  },
  {
    id: 'clean',
    name: 'Clean',
    emoji: '🤍',
    blurb: 'Tidy grids and white space.',
    background: { type: 'solid', color: '#FFFFFF' },
    cover: 'framed',
    perSlide: [2, 3, 2, 4],
    collage: { family: 'grid', chaos: 0, gutter: 0.025 },
    margin: 0.07,
    title: { preset: 'minimal', text: 'moments', placement: 'bottom' },
    caption: { preset: 'caption', kind: 'counter' },
    stickers: [],
    coverStickers: 0,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    emoji: '🎬',
    blurb: 'Letterboxed frames, moody grade.',
    background: { type: 'solid', color: '#050507' },
    cover: 'full-bleed',
    perSlide: [1, 1, 2, 1],
    collage: { family: 'editorial', chaos: 0, gutter: 0.012 },
    margin: 0.16,
    title: { preset: 'editorial', text: 'scenes.', placement: 'bottom' },
    caption: { preset: 'caption', kind: 'counter' },
    stickers: [],
    coverStickers: 0,
    adjust: { contrast: 18, saturation: -18, fade: 12, temperature: -8, highlights: -15 },
    letterbox: true,
  },
  {
    id: 'y2k',
    name: 'Y2K',
    emoji: '💿',
    blurb: 'Chrome gradients and sparkles.',
    background: {
      type: 'linear',
      angle: 160,
      stops: [
        { offset: 0, color: '#FFB8F1' },
        { offset: 0.5, color: '#C9D6FF' },
        { offset: 1, color: '#9EF3FF' },
      ],
    },
    cover: 'collage',
    perSlide: [3, 2, 4],
    collage: { family: 'polaroid', chaos: 0.5, gutter: 0.02, decor: false },
    margin: 0.05,
    title: { preset: 'y2k', text: 'dump.exe', placement: 'top' },
    stickers: ['vector:y2k-star', 'vector:globe-y2k', 'emoji:💿', 'emoji:🦋', 'vector:sparkle'],
    coverStickers: 3,
    adjust: { saturation: 15, contrast: 10 },
  },
  {
    id: 'travel',
    name: 'Travel',
    emoji: '🧭',
    blurb: 'Big views, bento details.',
    background: 'palette-light',
    cover: 'full-bleed',
    perSlide: [1, 3, 2, 4],
    collage: { family: 'bento', chaos: 0.2, gutter: 0.022 },
    margin: 0.05,
    title: { preset: 'handwritten', text: 'wish you were here', placement: 'bottom' },
    caption: { preset: 'caption', kind: 'text', text: '📍 somewhere new' },
    stickers: ['vector:arrow-curve', 'emoji:🌈', 'emoji:⭐'],
    coverStickers: 1,
    adjust: { temperature: 10, vibrance: 18 },
  },
  {
    id: 'birthday',
    name: 'Birthday',
    emoji: '🎂',
    blurb: 'Pastel polaroids and bows.',
    background: { type: 'solid', color: '#FFE3EE' },
    cover: 'collage',
    perSlide: [3, 2, 3],
    collage: { family: 'polaroid', chaos: 0.45, gutter: 0.02, decor: true },
    margin: 0.05,
    title: { preset: 'soft', text: 'another lap around the sun', placement: 'top' },
    stickers: ['emoji:🎀', 'emoji:🍒', 'emoji:✨', 'vector:heart'],
    coverStickers: 3,
    adjust: { vibrance: 12, exposure: 5 },
  },
  {
    id: 'college',
    name: 'College',
    emoji: '📚',
    blurb: 'Film strips and doodles.',
    background: { type: 'solid', color: '#F6F2E7' },
    cover: 'collage',
    perSlide: [3, 4, 2],
    collage: { family: 'filmstrip', chaos: 0.2, gutter: 0.02 },
    margin: 0.06,
    title: { preset: 'handwritten', text: 'semester recap', placement: 'top' },
    stickers: ['vector:scribble-circle', 'vector:arrow-loop', 'vector:star'],
    coverStickers: 2,
  },
  {
    id: 'streetwear',
    name: 'Streetwear',
    emoji: '🧢',
    blurb: 'Hard cuts, bold type, low-sat grade.',
    background: { type: 'solid', color: '#0B0A12' },
    cover: 'full-bleed',
    perSlide: [2, 3, 1, 4],
    collage: { family: 'editorial', chaos: 0.1, gutter: 0.008 },
    margin: 0.03,
    title: { preset: 'streetwear', text: 'NEW DROP', placement: 'bottom' },
    caption: { preset: 'caption', kind: 'text', text: 'VOL. 01' },
    stickers: ['vector:lightning'],
    coverStickers: 1,
    adjust: { contrast: 22, saturation: -30, grain: 18 },
  },
  {
    id: 'vacation',
    name: 'Vacation',
    emoji: '🌴',
    blurb: 'Sun-warmed, scrapbook-y.',
    background: 'palette-light',
    tintSlides: true,
    cover: 'full-bleed',
    perSlide: [2, 3, 3],
    collage: { family: 'scrapbook', chaos: 0.45, gutter: 0.02, decor: false },
    margin: 0.05,
    title: { preset: 'editorial', text: 'out of office ☀️', placement: 'bottom' },
    stickers: ['emoji:🌸', 'emoji:🌈', 'emoji:⭐', 'vector:daisy'],
    coverStickers: 2,
    adjust: { temperature: 15, vibrance: 20, highlights: -10 },
  },
  {
    id: 'night-out',
    name: 'Night out',
    emoji: '🪩',
    blurb: 'Flash, grain and neon.',
    background: { type: 'solid', color: '#0B0A12' },
    cover: 'collage',
    perSlide: [3, 2, 4],
    collage: { family: 'scrapbook', chaos: 0.6, gutter: 0.02, decor: false },
    margin: 0.04,
    title: { preset: 'futuristic', text: 'night out', placement: 'top' },
    stickers: ['emoji:✨', 'emoji:🌙', 'emoji:💿', 'vector:sparkle'],
    coverStickers: 3,
    adjust: { contrast: 20, exposure: 6, grain: 35, vignette: 30 },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    emoji: '◻️',
    blurb: 'One photo at a time, lots of air.',
    background: { type: 'solid', color: '#F4F1EA' },
    cover: 'framed',
    perSlide: [1, 1, 2, 1],
    collage: { family: 'grid', chaos: 0, gutter: 0.05 },
    margin: 0.13,
    title: { preset: 'minimal', text: '—', placement: 'bottom' },
    stickers: [],
    coverStickers: 0,
  },
  {
    id: 'aesthetic',
    name: 'Aesthetic',
    emoji: '🕊️',
    blurb: 'Soft bento, faded film look.',
    background: 'palette-light',
    tintSlides: true,
    cover: 'framed',
    perSlide: [3, 2, 4, 3],
    collage: { family: 'bento', chaos: 0.25, gutter: 0.028 },
    margin: 0.06,
    title: { preset: 'editorial', text: 'soft days', placement: 'bottom' },
    stickers: ['vector:sparkle'],
    coverStickers: 1,
    adjust: { fade: 25, grain: 15, saturation: -10, temperature: 6 },
  },
];

export const getDumpStyle = (id: string): DumpStyle => DUMP_STYLES.find((s) => s.id === id) ?? DUMP_STYLES[0]!;

/** The brief's sweet spot is 5–20; three is the least that still makes a dump. */
export const DUMP_MIN_PHOTOS = 3;
export const DUMP_MAX_PHOTOS = 20;
