import { describe, expect, it } from 'vitest';
import { luminance } from '@/utils/color';
import { loadBundledTemplate } from './registry';
import { buildPaletteMap, remixDocument } from './remix';

describe('palette remix', () => {
  it('maps colours by luminance rank so contrast survives', () => {
    const map = buildPaletteMap(['#FFFFFF', '#000000'], ['#221133', '#FFEEDD']);
    expect(map.get('#FFFFFF')).toBe('#FFEEDD');
    expect(map.get('#000000')).toBe('#221133');
  });

  it('recolours a template while keeping text darker than its background', async () => {
    const t = (await loadBundledTemplate('big-type-drop'))!;
    const remixed = remixDocument(t.doc, t.palette, ['#E9DFFF', '#FFE3D3', '#FFF4E0', '#F3D6E8', '#5B3E86']);
    const bg = remixed.background.type === 'solid' ? remixed.background.color : '';
    const headline = remixed.elements.find((e) => e.type === 'text' && e.text.startsWith('NEW'));
    const ink = headline?.type === 'text' && headline.fill.type === 'solid' ? headline.fill.color : '';
    expect(bg).not.toBe('#C6FF3D');
    expect(luminance(ink)).toBeLessThan(luminance(bg));
  });

  it('leaves colours outside the source palette alone', async () => {
    const t = (await loadBundledTemplate('film-strip'))!;
    const remixed = remixDocument(t.doc, ['#123456'], ['#FFFFFF']);
    expect(remixed.background).toEqual(t.doc.background);
  });
});
