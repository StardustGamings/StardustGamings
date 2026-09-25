import type { FormatId, SizePresetId } from '@/types/project';

export interface SizePreset {
  id: Exclude<SizePresetId, 'custom'>;
  label: string;
  width: number;
  height: number;
  ratio: string;
  platforms: string;
}

export const SIZE_PRESETS: Record<SizePreset['id'], SizePreset> = {
  'ig-portrait': {
    id: 'ig-portrait',
    label: 'Portrait',
    width: 1080,
    height: 1350,
    ratio: '4:5',
    platforms: 'Instagram feed & carousels',
  },
  'ig-square': {
    id: 'ig-square',
    label: 'Square',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    platforms: 'Instagram, Facebook, LinkedIn',
  },
  'ig-landscape': {
    id: 'ig-landscape',
    label: 'Landscape',
    width: 1080,
    height: 566,
    ratio: '1.91:1',
    platforms: 'Instagram landscape, X, LinkedIn',
  },
  story: { id: 'story', label: 'Story', width: 1080, height: 1920, ratio: '9:16', platforms: 'Instagram & Facebook Stories' },
  tiktok: { id: 'tiktok', label: 'TikTok / Reel', width: 1080, height: 1920, ratio: '9:16', platforms: 'TikTok, Reels, Shorts' },
  'yt-thumbnail': {
    id: 'yt-thumbnail',
    label: 'YouTube thumbnail',
    width: 1280,
    height: 720,
    ratio: '16:9',
    platforms: 'YouTube',
  },
  pinterest: { id: 'pinterest', label: 'Pin', width: 1000, height: 1500, ratio: '2:3', platforms: 'Pinterest' },
  poster: { id: 'poster', label: 'Poster', width: 1240, height: 1754, ratio: 'A-series', platforms: 'Print & digital posters' },
  moodboard: {
    id: 'moodboard',
    label: 'Board',
    width: 1600,
    height: 1200,
    ratio: '4:3',
    platforms: 'Moodboards & presentations',
  },
};

export const CUSTOM_SIZE_LIMITS = { min: 100, max: 8000 } as const;

export interface FormatDefinition {
  id: FormatId;
  label: string;
  tagline: string;
  sizeId: SizePreset['id'];
  slideCount: number;
  /** Which size presets make sense for this format (first = default). */
  sizes: SizePreset['id'][];
  /** Two-stop accent used by quick-create tiles & project cards. */
  accent: [string, string];
  multiSlide: boolean;
}

export const FORMATS: Record<FormatId, FormatDefinition> = {
  carousel: {
    id: 'carousel',
    label: 'Carousel',
    tagline: 'Swipeable multi-slide posts',
    sizeId: 'ig-portrait',
    slideCount: 5,
    sizes: ['ig-portrait', 'ig-square', 'ig-landscape', 'story'],
    accent: ['#C6FF3D', '#3CF0C8'],
    multiSlide: true,
  },
  story: {
    id: 'story',
    label: 'Story',
    tagline: 'Full-screen 9:16 moments',
    sizeId: 'story',
    slideCount: 1,
    sizes: ['story', 'tiktok'],
    accent: ['#FF5CAA', '#A06BFF'],
    multiSlide: true,
  },
  post: {
    id: 'post',
    label: 'Post',
    tagline: 'One perfect feed post',
    sizeId: 'ig-portrait',
    slideCount: 1,
    sizes: ['ig-portrait', 'ig-square', 'ig-landscape', 'pinterest'],
    accent: ['#3CF0FF', '#6B7CFF'],
    multiSlide: false,
  },
  'reel-cover': {
    id: 'reel-cover',
    label: 'Reel Cover',
    tagline: 'Covers that stop the scroll',
    sizeId: 'tiktok',
    slideCount: 1,
    sizes: ['tiktok', 'story'],
    accent: ['#FF7A3D', '#FF3D71'],
    multiSlide: false,
  },
  thumbnail: {
    id: 'thumbnail',
    label: 'Thumbnail',
    tagline: 'Clicky 16:9 YouTube art',
    sizeId: 'yt-thumbnail',
    slideCount: 1,
    sizes: ['yt-thumbnail'],
    accent: ['#FFD23D', '#FF5C5C'],
    multiSlide: false,
  },
  collage: {
    id: 'collage',
    label: 'Collage',
    tagline: 'Many photos, one vibe',
    sizeId: 'ig-square',
    slideCount: 1,
    sizes: ['ig-square', 'ig-portrait', 'story'],
    accent: ['#A06BFF', '#3CF0FF'],
    multiSlide: false,
  },
  poster: {
    id: 'poster',
    label: 'Poster',
    tagline: 'Loud, printable graphics',
    sizeId: 'poster',
    slideCount: 1,
    sizes: ['poster', 'pinterest', 'ig-portrait'],
    accent: ['#FF3DDB', '#FFB13D'],
    multiSlide: false,
  },
  moodboard: {
    id: 'moodboard',
    label: 'Moodboard',
    tagline: 'Collect the aesthetic',
    sizeId: 'moodboard',
    slideCount: 1,
    sizes: ['moodboard', 'ig-square', 'story'],
    accent: ['#FFC6E8', '#C6D4FF'],
    multiSlide: false,
  },
};

export const FORMAT_ORDER: FormatId[] = [
  'carousel',
  'story',
  'post',
  'reel-cover',
  'thumbnail',
  'collage',
  'poster',
  'moodboard',
];

export const MAX_SLIDES = 30;

export function isFormatId(value: unknown): value is FormatId {
  return typeof value === 'string' && value in FORMATS;
}

export function resolveSize(sizeId: SizePresetId, custom?: { width: number; height: number }) {
  if (sizeId === 'custom') {
    if (!custom) throw new Error('Custom size requires dimensions');
    return { width: custom.width, height: custom.height };
  }
  const preset = SIZE_PRESETS[sizeId];
  return { width: preset.width, height: preset.height };
}

export function ratioLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  const w = width / d;
  const h = height / d;
  return w > 50 || h > 50 ? (width / height).toFixed(2) + ':1' : `${w}:${h}`;
}
