import type { DesignDocument, DesignElement } from '@/types/document';
import { createDocument } from '@/projects/document';
import { luminance } from '@/utils/color';
import { supportedWeight } from '@/typography/fonts';
import { stickerArtFor } from '@/stickers/library';
import { paletteById, typographyById } from './pack';
import type { TrendPack } from './schema';

/**
 * A drop's cover art, drawn by the canvas renderer from the pack's own data:
 * its headline in one of its type pairings, on one of its palettes, with a few
 * of its stickers. No images are downloaded for it.
 */
export function coverDocument(pack: TrendPack, width = 1600, height = 900): DesignDocument {
  const palette = paletteById(pack, pack.cover?.palette) ?? pack.palettes[0];
  const typo = typographyById(pack, pack.cover?.typography) ?? pack.typography[0];
  const colors = palette?.colors ?? [...pack.accent, '#0B0A12', '#F4F1EA'];
  const byLight = [...colors].sort((a, b) => luminance(a) - luminance(b));
  const dark = byLight[0]!;
  const light = byLight[byLight.length - 1]!;
  const accents = colors.filter((c) => c !== dark && c !== light);
  const doc = createDocument({
    width,
    height,
    background: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0, color: dark },
        { offset: 1, color: accents[1] ?? accents[0] ?? dark },
      ],
    },
  });
  const headline = pack.cover?.headline ?? pack.title;
  const elements: DesignElement[] = [
    {
      id: 'cv-blob',
      type: 'shape',
      shape: 'ellipse',
      x: width * 0.55,
      y: -height * 0.25,
      width: width * 0.7,
      height: width * 0.7,
      rotation: 0,
      opacity: 0.85,
      fill: {
        type: 'radial',
        cx: 0.5,
        cy: 0.5,
        radius: 0.5,
        stops: [
          { offset: 0, color: accents[0] ?? light },
          { offset: 1, color: `${(accents[0] ?? light).slice(0, 7)}00` },
        ],
      },
    },
    {
      id: 'cv-headline',
      type: 'text',
      x: width * 0.06,
      y: height * 0.22,
      width: width * 0.8,
      height: height * 0.56,
      rotation: 0,
      opacity: 1,
      text: headline,
      fontFamily: typo?.heading.family ?? 'Unbounded',
      fontSize: Math.round(height * 0.2),
      fontWeight: typo ? supportedWeight(typo.heading.family, typo.heading.weight) : 800,
      fontStyle: typo?.heading.style ?? 'normal',
      ...(typo?.heading.transform && typo.heading.transform !== 'none' ? { textTransform: typo.heading.transform } : {}),
      fill: { type: 'solid', color: light },
      align: 'left',
      verticalAlign: 'middle',
      lineHeight: 0.98,
      letterSpacing: -0.01,
    },
  ];
  (pack.cover?.stickers ?? []).slice(0, 3).forEach((ref, i) => {
    const size = height * (0.26 - i * 0.04);
    const art = stickerArtFor(ref);
    elements.push({
      id: `cv-st${i}`,
      type: 'sticker',
      stickerId: ref,
      x: width * (0.78 - i * 0.12),
      y: height * (0.08 + i * 0.52),
      width: size,
      height: size,
      rotation: [12, -10, 6][i]!,
      opacity: 1,
      ...(art ? { art, tint: accents[i % Math.max(1, accents.length)] ?? art.defaultTint } : {}),
    });
  });
  doc.elements = elements;
  return doc;
}
