import { describe, expect, it } from 'vitest';
import { scoreCommand } from './command-score';

describe('command palette scoring', () => {
  it('ranks label matches above keyword-only matches', () => {
    expect(scoreCommand('Theme: Light', 'theme light')).toBeGreaterThan(
      scoreCommand('Night Out', 'theme light', ['night out', 'party']),
    );
    expect(scoreCommand('Film Strip', 'film strip')).toBe(1);
    expect(scoreCommand('Soft Editorial', 'film strip', ['editorial', 'minimal', 'soft'])).toBe(0);
  });

  it('finds commands through keywords', () => {
    expect(scoreCommand('Animations: switch to reduced', 'reduce motion', ['reduce motion'])).toBeGreaterThan(0.4);
    expect(scoreCommand('Open Trash', 'restore', ['deleted', 'restore'])).toBeGreaterThan(0.4);
  });

  it('supports compact typing', () => {
    expect(scoreCommand('New carousel', 'newcar')).toBeGreaterThan(0);
    expect(scoreCommand('New carousel', 'zz')).toBe(0);
  });
});
