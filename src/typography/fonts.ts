import catalog from './font-catalog.json';
import files from './font-files.generated.json';

export type FontCategory = 'sans' | 'serif' | 'display' | 'script' | 'mono';

export interface FontFaceFile {
  file: string;
  subset: string;
  style: string;
  weight: string;
}

export interface BundledFont {
  id: string;
  family: string;
  category: FontCategory;
  variable: boolean;
  /** [min, max] for variable fonts, or the list of static weights. */
  weights: number[];
  styles: string[];
  vibes: string[];
  fallback: string;
  faces: FontFaceFile[];
}

const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT_RANGE =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

export const BUNDLED_FONTS: BundledFont[] = catalog.fonts.map((font) => ({
  id: font.id,
  family: font.family,
  category: font.category as FontCategory,
  variable: font.variable,
  weights: font.weights,
  styles: font.styles,
  vibes: font.vibes,
  fallback: font.fallback,
  faces: (files as Record<string, FontFaceFile[]>)[font.id] ?? [],
}));

const byFamily = new Map(BUNDLED_FONTS.map((f) => [f.family.toLowerCase(), f]));

export function findBundledFont(family: string): BundledFont | undefined {
  return byFamily.get(family.toLowerCase());
}

/** CSS `font-family` value with a sensible generic fallback. */
export function fontStack(family: string): string {
  const font = findBundledFont(family);
  return `"${family.replace(/"/g, '')}", ${font?.fallback ?? 'sans-serif'}`;
}

/** Nearest weight a bundled font can actually render. */
export function supportedWeight(family: string, weight: number): number {
  const font = findBundledFont(family);
  if (!font) return weight;
  if (font.variable) return Math.min(Math.max(weight, font.weights[0]!), font.weights[font.weights.length - 1]!);
  return font.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));
}

const registered = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** Registers the @font-face rules for a bundled family (idempotent, lazy). */
function register(font: BundledFont): void {
  if (registered.has(font.id) || typeof FontFace === 'undefined' || typeof document === 'undefined') return;
  registered.add(font.id);
  for (const face of font.faces) {
    const ff = new FontFace(font.family, `url(${face.file}) format('woff2')`, {
      style: face.style,
      weight: face.weight,
      display: 'swap',
      unicodeRange: face.subset === 'latin' ? LATIN_RANGE : LATIN_EXT_RANGE,
    });
    document.fonts.add(ff);
  }
}

/**
 * Ensures a font is ready for canvas rendering. Resolves (never rejects) once the
 * face is loaded or loading failed — rendering then falls back gracefully.
 */
export function loadFont(family: string, weight = 400, style = 'normal'): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const font = findBundledFont(family);
  if (font) register(font);
  const key = `${family}|${weight}|${style}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = document.fonts
    .load(`${style} ${weight} 32px "${family}"`)
    .then(() => undefined)
    .catch(() => undefined);
  pending.set(key, promise);
  return promise;
}

export function loadFonts(list: { family: string; weight: number; style: string }[]): Promise<void> {
  return Promise.all(list.map((f) => loadFont(f.family, f.weight, f.style))).then(() => undefined);
}

export function isFontReady(family: string, weight = 400, style = 'normal'): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  try {
    return document.fonts.check(`${style} ${weight} 32px "${family}"`);
  } catch {
    return true;
  }
}
