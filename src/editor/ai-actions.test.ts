import { describe, expect, it } from 'vitest';
import { createDocument } from '@/projects/document';
import type { TextElement } from '@/types/document';
import { createText, slideCenter } from './core/factory';
import { designTexts, headlineElement } from './ai-actions';

describe('the words the AI tools read from a design', () => {
  const doc = createDocument({ width: 1080, height: 1350, slideCount: 2 });
  const text = (slide: number, value: string, fontSize: number, y: number): TextElement => ({
    ...createText(doc, slideCenter(doc, slide), undefined, value),
    fontSize,
    y,
  });

  it('takes the biggest text with real words as the headline, then reads slide by slide, top to bottom', () => {
    const d = {
      ...doc,
      elements: [
        text(1, 'Second slide', 40, 100),
        text(0, '“', 400, 50), // a decorative quote mark is not the headline
        text(0, 'Coffee shops of Lisbon', 120, 400),
        text(0, '01', 200, 60),
        text(0, 'A guide', 40, 900),
        { ...text(0, 'Hidden words', 300, 10), hidden: true },
      ],
    };
    expect(headlineElement(d)?.text).toBe('Coffee shops of Lisbon');
    expect(designTexts(d)).toEqual(['Coffee shops of Lisbon', 'A guide', 'Second slide']);
    expect(designTexts({ ...doc, elements: [text(0, '→', 90, 0)] })).toEqual([]);
  });

  it('keeps what it sends small, whatever the script', () => {
    const d = { ...doc, elements: Array.from({ length: 60 }, (_, i) => text(0, '日本語のテキスト'.repeat(60), 40, i)) };
    const texts = designTexts(d);
    expect(texts.length).toBeLessThanOrEqual(40);
    expect(texts.every((t) => t.length <= 300)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(texts)).length).toBeLessThan(8 * 1024);
  });
});
