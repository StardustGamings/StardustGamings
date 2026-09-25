import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { resolveMotion, resolveTheme } from './resolve';
import { sanitizeSettings } from './store';

describe('settings', () => {
  it('falls back to defaults for missing or malicious data', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({
      theme: 'hacker',
      motion: 42,
      uiScale: 99,
      displayName: 'x'.repeat(500),
      editor: { defaultFormat: 'nope', carouselSlides: -3 },
      export: { format: 'exe' },
    });
    expect(s.theme).toBe('dark');
    expect(s.motion).toBe('system');
    expect(s.uiScale).toBe(1.25);
    expect(s.displayName).toHaveLength(40);
    expect(s.editor.defaultFormat).toBe('carousel');
    expect(s.editor.carouselSlides).toBe(1);
    expect(s.export.format).toBe('png');
  });

  it('keeps valid values', () => {
    const s = sanitizeSettings({
      theme: 'oled',
      motion: 'off',
      uiScale: 0.9,
      editor: { defaultFormat: 'story', carouselSlides: 8 },
    });
    expect([s.theme, s.motion, s.uiScale, s.editor.defaultFormat, s.editor.carouselSlides]).toEqual([
      'oled',
      'off',
      0.9,
      'story',
      8,
    ]);
  });

  it('resolves system preferences', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('oled', false)).toBe('oled');
    expect(resolveMotion('system', true)).toBe('reduced');
    expect(resolveMotion('system', false)).toBe('full');
    expect(resolveMotion('off', false)).toBe('off');
  });
});
