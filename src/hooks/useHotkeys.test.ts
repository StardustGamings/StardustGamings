import { describe, expect, it } from 'vitest';
import { matchesHotkey } from './useHotkeys';

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  new KeyboardEvent('keydown', { key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

describe('matchesHotkey (non-Apple platform)', () => {
  it('matches mod combos with Ctrl', () => {
    expect(matchesHotkey(key('k', { ctrlKey: true }), 'mod+k')).toBe(true);
    expect(matchesHotkey(key('k'), 'mod+k')).toBe(false);
  });

  it('distinguishes undo from redo', () => {
    expect(matchesHotkey(key('Z', { ctrlKey: true, shiftKey: true }), 'mod+z')).toBe(false);
    expect(matchesHotkey(key('Z', { ctrlKey: true, shiftKey: true }), 'mod+shift+z')).toBe(true);
    expect(matchesHotkey(key('z', { ctrlKey: true }), 'mod+z')).toBe(true);
  });

  it('tolerates Shift for symbols and maps Backspace to delete', () => {
    expect(matchesHotkey(key('+', { ctrlKey: true, shiftKey: true }), 'mod++')).toBe(true);
    expect(matchesHotkey(key('Backspace'), 'delete')).toBe(true);
    expect(matchesHotkey(key('ArrowLeft'), 'arrowleft')).toBe(true);
  });
});
