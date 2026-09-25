import { describe, expect, it } from 'vitest';
import { contrastRatio, fromHsl, isValidColor, mix, normalizeHex, parseColor, readableOn, toHsl, withAlpha } from './color';

describe('color utils', () => {
  it('parses hex and rgb(a) forms', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#C6FF3D')).toEqual({ r: 198, g: 255, b: 61, a: 1 });
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.5, 1);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });

  it('rejects anything that is not a colour', () => {
    for (const bad of ['', 'red', '#12', 'url(x)', 'rgb(1,2)', 'javascript:alert(1)', '#ggg']) {
      expect(isValidColor(bad)).toBe(false);
    }
  });

  it('normalises hex values', () => {
    expect(normalizeHex('c6ff3d')).toBe('#C6FF3D');
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('nope')).toBeNull();
  });

  it('computes WCAG contrast and picks readable text', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 0);
    expect(readableOn('#C6FF3D')).toBe('#0B0A12');
    expect(readableOn('#2A1470')).toBe('#FFFFFF');
  });

  it('mixes, converts to HSL and back', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    const hsl = toHsl('#A06BFF');
    expect(fromHsl(hsl)).toBe('#A06BFF');
    expect(withAlpha('#ff0000', 0.3)).toBe('rgba(255, 0, 0, 0.3)');
  });
});
