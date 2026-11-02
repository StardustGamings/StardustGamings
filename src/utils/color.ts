export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX_RE = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i;

export function isValidColor(input: string): boolean {
  return parseColor(input) !== null;
}

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. */
export function parseColor(input: string): RGBA | null {
  const value = input.trim();
  const hex = HEX_RE.exec(value);
  if (hex) {
    let h = hex[1]!;
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgb = RGB_RE.exec(value);
  if (rgb) {
    const alpha = rgb[4];
    return {
      r: Math.min(255, Number(rgb[1])),
      g: Math.min(255, Number(rgb[2])),
      b: Math.min(255, Number(rgb[3])),
      a: alpha === undefined ? 1 : alpha.endsWith('%') ? parseFloat(alpha) / 100 : Math.min(1, Number(alpha)),
    };
  }
  return null;
}

const toHexPair = (n: number) => Math.round(n).toString(16).padStart(2, '0');

export function toHex({ r, g, b, a }: RGBA, withAlpha = false): string {
  const base = `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`;
  return withAlpha && a < 1 ? base + toHexPair(a * 255) : base;
}

export function normalizeHex(input: string): string | null {
  const c = parseColor(input);
  return c ? toHex(c, c.a < 1).toUpperCase() : null;
}

export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (!c) return color;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/** WCAG relative luminance. */
export function luminance(color: string): number {
  const c = parseColor(color);
  if (!c) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Picks whichever of `dark`/`light` reads best on top of `background`. */
export function readableOn(background: string, dark = '#0B0A12', light = '#FFFFFF'): string {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
    a: ca.a + (cb.a - ca.a) * t,
  });
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function toHsl(color: string): HSL {
  const c = parseColor(color) ?? { r: 0, g: 0, b: 0, a: 1 };
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

export function fromHsl({ h, s, l }: HSL): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: 1 }).toUpperCase();
}
