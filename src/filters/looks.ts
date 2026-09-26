import type { CurvePoint, ImageAdjustments, ImageCurves, ImageEffects, ImageFilter } from '@/types/document';

/**
 * One-tap looks. Each is plain data — adjustments, tone curves and effects at
 * full strength — blended over the photo's own edits by the intensity slider
 * (see compose.ts). Everything runs through the same develop pipeline as the
 * manual tools, on the GPU or in a worker.
 */
export interface LookDefinition {
  id: string;
  name: string;
  description: string;
  /** Two colours for the chip behind the name. */
  swatch: [string, string];
  adjust: ImageAdjustments;
  curves?: ImageCurves;
  effects?: ImageEffects;
}

const pts = (...xy: [number, number][]): CurvePoint[] => xy.map(([x, y]) => ({ x, y }));

export const LOOKS: LookDefinition[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Teal shadows, warm skin, rich contrast.',
    swatch: ['#0E4D5C', '#F2994A'],
    adjust: { contrast: 18, highlights: -22, shadows: 8, saturation: -8, vignette: 28 },
    curves: {
      r: pts([0, 0], [0.25, 0.21], [0.75, 0.8], [1, 1]),
      g: pts([0, 0.02], [0.5, 0.5], [1, 0.97]),
      b: pts([0, 0.08], [0.25, 0.3], [0.75, 0.7], [1, 0.92]),
    },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Warm, faded and a little dusty.',
    swatch: ['#C68B59', '#EBD8B7'],
    adjust: { fade: 38, saturation: -28, temperature: 22, contrast: -8, grain: 22, vignette: 22 },
    curves: { b: pts([0, 0.1], [1, 0.86]), r: pts([0, 0.04], [1, 1]) },
    effects: { dust: 28 },
  },
  {
    id: 'film',
    name: 'Film',
    description: 'Soft roll-off, gentle grain, true colours.',
    swatch: ['#3E5C4B', '#E8C48A'],
    adjust: { contrast: 10, highlights: -14, fade: 16, saturation: -6, temperature: 6, grain: 32 },
    curves: { rgb: pts([0, 0.04], [0.25, 0.22], [0.75, 0.8], [1, 0.97]), g: pts([0, 0.03], [1, 1]) },
  },
  {
    id: 'y2k',
    name: 'Y2K',
    description: 'Candy colours, chrome glow, pixel sparkle.',
    swatch: ['#9EE7FF', '#FF7AD9'],
    adjust: { saturation: 32, vibrance: 22, brightness: 8, contrast: 12, tint: 12 },
    curves: { b: pts([0, 0.12], [0.5, 0.55], [1, 1]) },
    effects: { glow: 32, rgbSplit: 14 },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon magenta and electric blue.',
    swatch: ['#2B0A5E', '#FF2ED1'],
    adjust: { tint: 42, temperature: -38, contrast: 26, saturation: 22, shadows: -10 },
    curves: { b: pts([0, 0.14], [0.5, 0.58], [1, 1]), g: pts([0, 0], [0.5, 0.44], [1, 0.95]) },
    effects: { rgbSplit: 26, glow: 22 },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Clean black and white with depth.',
    swatch: ['#111111', '#E6E6E6'],
    adjust: { saturation: -100, contrast: 22, highlights: -8, grain: 10 },
  },
  {
    id: 'vhs',
    name: 'VHS',
    description: 'Tape wobble: scanlines, colour bleed, noise.',
    swatch: ['#243B8F', '#FF5A5A'],
    adjust: { saturation: 16, contrast: 10, fade: 12, blur: 6, grain: 26, temperature: -6 },
    effects: { rgbSplit: 48, scanlines: 55 },
  },
  {
    id: 'disposable',
    name: 'Disposable',
    description: 'Flash, warm cast and a light leak.',
    swatch: ['#FF8A3D', '#FFE08A'],
    adjust: { exposure: 10, contrast: 16, saturation: 10, temperature: 14, vignette: 36, grain: 38 },
    effects: { leak: 45, leakStyle: 'amber' },
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    description: 'Creamy whites, cool shadows, soft contrast.',
    swatch: ['#B7D3CF', '#F3E6CC'],
    adjust: { fade: 30, contrast: -14, saturation: -16, temperature: 8, tint: -6, highlights: -16, vignette: 12 },
    curves: { b: pts([0, 0.12], [0.5, 0.5], [1, 0.9]), r: pts([0, 0.03], [1, 0.98]) },
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    description: 'Hazy, bright and a soft pink bloom.',
    swatch: ['#F9C6D8', '#FFF1E6'],
    adjust: { brightness: 12, contrast: -18, highlights: 10, saturation: -6, fade: 10, tint: 8 },
    effects: { glow: 58 },
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Moody, deep and desaturated.',
    swatch: ['#15161C', '#4A4F5E'],
    adjust: { exposure: -16, contrast: 22, shadows: -22, highlights: -26, saturation: -28, temperature: -8, vignette: 46 },
  },
  {
    id: 'street',
    name: 'Street',
    description: 'Gritty contrast and muted colour.',
    swatch: ['#2E2E2E', '#C9C2B4'],
    adjust: { contrast: 32, saturation: -32, sharpness: 38, grain: 26, temperature: -5, highlights: -10 },
    curves: { rgb: pts([0, 0], [0.2, 0.12], [0.8, 0.86], [1, 1]) },
  },
  {
    id: 'luxury',
    name: 'Luxury',
    description: 'Golden highlights and inky shadows.',
    swatch: ['#1E1A17', '#C9A86A'],
    adjust: { contrast: 14, saturation: -12, highlights: -12, shadows: -6, temperature: 8, fade: 6, vignette: 22 },
    curves: {
      r: pts([0, 0], [0.75, 0.78], [1, 1]),
      b: pts([0, 0.02], [0.75, 0.7], [1, 0.9]),
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Airy, bright and quietly muted.',
    swatch: ['#EDEDED', '#BFC7CC'],
    adjust: { brightness: 12, contrast: -12, saturation: -22, highlights: 8, fade: 8, temperature: -4 },
  },
];

const byId = new Map(LOOKS.map((l) => [l.id, l]));

/** A built-in look, or undefined for ids this version doesn't know (they're ignored, not errors). */
export const getLook = (id: string | undefined): LookDefinition | undefined => (id ? byId.get(id) : undefined);

export const isBuiltInLook = (id: string): boolean => byId.has(id);

/**
 * The look a photo uses: a built-in by id, or the recipe carried in the filter
 * (looks from trend packs), so designs render the same wherever they're opened.
 */
export function resolveLook(filter: ImageFilter | undefined): LookDefinition | undefined {
  if (!filter) return undefined;
  const builtIn = byId.get(filter.id);
  if (builtIn) return builtIn;
  const custom = filter.look;
  if (!custom) return undefined;
  return {
    id: filter.id,
    name: custom.name,
    description: '',
    swatch: ['#7A5CFF', '#C6FF3D'],
    adjust: custom.adjust,
    curves: custom.curves,
    effects: custom.effects,
  };
}

/** The filter to store on a photo for a look: built-ins by id, anything else with its recipe. */
export function lookFilter(look: LookDefinition, intensity: number): ImageFilter {
  if (byId.has(look.id)) return { id: look.id, intensity };
  const recipe: NonNullable<ImageFilter['look']> = { name: look.name, adjust: look.adjust };
  if (look.curves) recipe.curves = look.curves;
  if (look.effects) recipe.effects = look.effects;
  return { id: look.id, intensity, look: recipe };
}
