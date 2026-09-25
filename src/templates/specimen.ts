import type { DesignDocument, TextElement } from '@/types/document';
import type { TrendTypography } from '@/trends/schema';
import { supportedWeight } from '@/typography/fonts';
import { createDocument } from '@/projects/document';
import { createId } from '@/utils/id';

const baseText = (over: Partial<TextElement>): TextElement => ({
  id: createId('el'),
  type: 'text',
  x: 80,
  y: 0,
  width: 920,
  height: 100,
  rotation: 0,
  opacity: 1,
  text: '',
  fontFamily: 'Manrope',
  fontSize: 48,
  fontWeight: 400,
  fontStyle: 'normal',
  fill: { type: 'solid', color: '#0B0A12' },
  align: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.1,
  letterSpacing: 0,
  ...over,
});

/** A ready-to-edit post using a trending font pairing. */
export function createTypeSpecimen(typo: TrendTypography, heading: string, body: string): DesignDocument {
  const doc = createDocument({ width: 1080, height: 1350, background: { type: 'solid', color: '#F4F1EA' } });
  doc.elements = [
    baseText({
      y: 330,
      height: 520,
      text: heading,
      fontFamily: typo.heading.family,
      fontWeight: supportedWeight(typo.heading.family, typo.heading.weight),
      fontStyle: typo.heading.style ?? 'normal',
      textTransform: typo.heading.transform,
      fontSize: 150,
      lineHeight: 1,
      letterSpacing: -0.01,
    }),
    baseText({
      y: 900,
      height: 140,
      text: body,
      fontFamily: typo.body.family,
      fontWeight: supportedWeight(typo.body.family, typo.body.weight),
      fontStyle: typo.body.style ?? 'normal',
      textTransform: typo.body.transform,
      fontSize: 44,
      lineHeight: 1.3,
      fill: { type: 'solid', color: '#3B3848' },
    }),
  ];
  return doc;
}
