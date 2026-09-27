import type { DesignDocument, DesignElement, Fill, ShapeElement } from '@/types/document';
import { luminance, withAlpha } from '@/utils/color';
import { seededRandom } from '@/utils/math';
import type { BackgroundConcept, BackgroundRequest, ConceptShape } from './schemas';

/**
 * Background concepts: a background fill plus a few soft shapes behind
 * everything, described in fractions of the slide so they fit any size.
 * Generated on the device from a palette; the optional AI server returns the
 * same structure. Applying one adds ordinary locked shapes, so every part is
 * editable afterwards.
 */

const linear = (angle: number, ...colors: string[]): Fill => ({
  type: 'linear',
  angle,
  stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
});
const glow = (color: string, strength = 0.9): Fill => ({
  type: 'radial',
  cx: 0.5,
  cy: 0.5,
  radius: 0.5,
  stops: [
    { offset: 0, color: withAlpha(color, strength) },
    { offset: 1, color: withAlpha(color, 0) },
  ],
});

/** Palette roles: darkest, lightest and the accents in between. */
function roles(palette: string[]) {
  const sorted = [...palette].sort((a, b) => luminance(a) - luminance(b));
  const dark = sorted[0]!;
  const light = sorted[sorted.length - 1]!;
  const accents = sorted.slice(1, -1);
  const a = accents[accents.length - 1] ?? light;
  const b = accents[0] ?? dark;
  const c = accents[Math.floor(accents.length / 2)] ?? a;
  return { dark, light, a, b, c };
}

export function localBackgrounds(request: BackgroundRequest, seed = 1): BackgroundConcept[] {
  const { dark, light, a, b, c } = roles(request.palette);
  const rnd = seededRandom(seed * 104729 + request.palette.length);
  const jitter = (v: number, amount = 0.08) => v + (rnd() * 2 - 1) * amount;
  const tall = request.aspect < 1;

  const concepts: BackgroundConcept[] = [
    {
      name: 'Soft glow',
      description: 'A light wash with two blurred colour pools in opposite corners.',
      fill: linear(160, light, withAlpha(c, 0.35)),
      shapes: [
        {
          shape: 'ellipse',
          x: jitter(-0.25),
          y: jitter(-0.2),
          w: 0.95,
          h: 0.95 * request.aspect,
          rotation: 0,
          opacity: 0.9,
          fill: glow(a),
        },
        {
          shape: 'ellipse',
          x: jitter(0.45),
          y: jitter(0.55),
          w: 0.9,
          h: 0.9 * request.aspect,
          rotation: 0,
          opacity: 0.8,
          fill: glow(b),
        },
      ],
    },
    {
      name: 'Spotlight',
      description: 'A dark stage with one warm pool of light behind your subject.',
      fill: {
        type: 'radial',
        cx: 0.5,
        cy: tall ? 0.42 : 0.5,
        radius: 0.85,
        stops: [
          { offset: 0, color: withAlpha(a, 0.9) },
          { offset: 0.55, color: withAlpha(b, 0.6) },
          { offset: 1, color: dark },
        ],
      },
      shapes: [],
    },
    {
      name: 'Aurora',
      description: 'Night sky with slanted bands of colour.',
      fill: linear(180, dark, withAlpha(b, 0.9)),
      shapes: [0, 1, 2].map((i): ConceptShape => ({
        shape: 'rect',
        x: jitter(-0.3 + i * 0.25, 0.05),
        y: jitter(0.1 + i * 0.18, 0.05),
        w: 1.6,
        h: 0.22,
        rotation: -24 + i * 6,
        opacity: 0.55,
        fill: linear(90, withAlpha([a, c, light][i]!, 0), withAlpha([a, c, light][i]!, 0.85), withAlpha([a, c, light][i]!, 0)),
        radius: 1,
      })),
    },
    {
      name: 'Split block',
      description: 'Two flat colour blocks and a circle — bold and graphic.',
      fill: { type: 'solid', color: light },
      shapes: [
        {
          shape: 'rect',
          x: 0,
          y: tall ? 0.58 : 0,
          w: tall ? 1 : 0.46,
          h: tall ? 0.42 : 1,
          rotation: 0,
          opacity: 1,
          fill: { type: 'solid', color: a },
        },
        {
          shape: 'ellipse',
          x: tall ? 0.56 : 0.34,
          y: tall ? 0.46 : 0.28,
          w: tall ? 0.34 : 0.26,
          h: (tall ? 0.34 : 0.26) * request.aspect,
          rotation: 0,
          opacity: 1,
          fill: { type: 'solid', color: b },
        },
      ],
    },
    {
      name: 'Confetti shapes',
      description: 'A pale base with a scatter of small playful shapes at the edges.',
      fill: { type: 'solid', color: light },
      shapes: Array.from({ length: 6 }, (_, i): ConceptShape => {
        const edge = i % 4;
        const along = (i + 0.5) / 6;
        const size = 0.08 + rnd() * 0.07;
        return {
          shape: (['star', 'ellipse', 'rect', 'polygon'] as const)[i % 4]!,
          x: edge === 0 ? jitter(0.02, 0.02) : edge === 1 ? jitter(0.88, 0.02) : jitter(along, 0.05),
          y: edge === 2 ? jitter(0.02, 0.02) : edge === 3 ? jitter(0.9, 0.02) : jitter(along, 0.05),
          w: size,
          h: size * request.aspect,
          rotation: Math.round(rnd() * 90 - 45),
          opacity: 0.9,
          fill: { type: 'solid', color: [a, b, c][i % 3]! },
          radius: 0.3,
          points: 5 + (i % 3),
        };
      }),
    },
    {
      name: 'Sunset bands',
      description: 'Horizontal bands fading from warm to deep — a gradient with rhythm.',
      fill: linear(180, a, c, b),
      shapes: [0, 1, 2, 3].map((i): ConceptShape => ({
        shape: 'rect',
        x: -0.1,
        y: 0.18 + i * 0.2,
        w: 1.2,
        h: 0.045,
        rotation: 0,
        opacity: 0.35 - i * 0.05,
        fill: { type: 'solid', color: light },
      })),
    },
  ];
  // Each seed starts somewhere else, so "More ideas" shows a new set first.
  const start = ((Math.round(seed) % concepts.length) + concepts.length) % concepts.length;
  return [...concepts.slice(start), ...concepts.slice(0, start)].slice(0, 4);
}

const CONCEPT_NAME = 'Background art';

/** Elements made from a concept, on one slide. */
function conceptElements(doc: DesignDocument, concept: BackgroundConcept, slide: number, idPrefix: string): ShapeElement[] {
  const W = doc.slideWidth;
  const H = doc.slideHeight;
  return concept.shapes.map((s, i) => {
    const w = Math.round(s.w * W);
    const h = Math.round(s.h * W);
    return {
      id: `${idPrefix}${slide}-${i}`,
      type: 'shape',
      shape: s.shape,
      name: CONCEPT_NAME,
      x: Math.round(slide * W + s.x * W),
      y: Math.round(s.y * H),
      width: Math.max(1, w),
      height: Math.max(1, h),
      rotation: s.rotation,
      opacity: s.opacity,
      fill: s.fill,
      locked: true,
      ...(s.shape === 'rect' && s.radius ? { cornerRadius: Math.round(s.radius * Math.min(w, h) * 0.5) } : {}),
      ...(s.shape === 'star' ? { points: s.points ?? 5, innerRadius: 0.5 } : {}),
      ...(s.shape === 'polygon' ? { points: s.points ?? 6 } : {}),
    };
  });
}

/**
 * Puts a concept behind a design: on every slide (the design background, with
 * slide colours cleared) or just one (that slide's colour). Earlier concept
 * shapes on those slides are replaced, so trying concepts doesn't pile up.
 */
export function applyConcept(
  doc: DesignDocument,
  concept: BackgroundConcept,
  scope: { slide: number } | 'all',
  idPrefix = 'bg',
): DesignDocument {
  // On a single slide, "this slide" is the whole design: set the design's own background.
  const whole = scope === 'all' || doc.slides.length === 1;
  const slides = scope === 'all' ? doc.slides.map((_, i) => i) : [scope.slide];
  const onSlides = (el: DesignElement) => {
    const center = el.x + el.width / 2;
    return slides.includes(Math.max(0, Math.min(doc.slides.length - 1, Math.floor(center / doc.slideWidth))));
  };
  const kept = doc.elements.filter((el) => !(el.name === CONCEPT_NAME && el.locked && onSlides(el)));
  const added = slides.flatMap((i) => conceptElements(doc, concept, i, idPrefix));
  return {
    ...doc,
    background: whole ? concept.fill : doc.background,
    slides: doc.slides.map((s, i) => (whole ? { ...s, fill: null } : i === slides[0] ? { ...s, fill: concept.fill } : s)),
    // Behind everything else.
    elements: [...added, ...kept],
  };
}
