import { describe, expect, it } from 'vitest';
import type { DesignDocument } from '@/types/document';
import { documentSchema } from './schema';
import { canonicalJson, sameDocument } from './versions';

/**
 * Project files and backups are validated with `documentSchema` on import, and
 * validation drops anything it doesn't know. This keeps the schema honest: a
 * document using every field survives validation unchanged.
 */
const full: DesignDocument = {
  version: 1,
  slideWidth: 1080,
  slideHeight: 1350,
  background: {
    type: 'linear',
    angle: 45,
    stops: [
      { offset: 0, color: '#FF2D55' },
      { offset: 1, color: '#0A84FF' },
    ],
  },
  slides: [
    { id: 's1', fill: null },
    { id: 's2', fill: { type: 'solid', color: '#101010' }, duration: 4500 },
  ],
  motion: { transition: 'zoom', transitionDuration: 400 },
  guides: [{ id: 'g1', axis: 'x', position: 540 }],
  layouts: [
    {
      id: 'l1',
      kind: 'collage',
      family: 'bento',
      seed: 7,
      chaos: 0.4,
      gutter: 0.02,
      frame: { x: 0, y: 0, width: 1, height: 1 },
      decor: true,
    },
    { id: 'l2', kind: 'panorama', seed: 3, slides: 2, spacing: 0.05, margin: 0.1, align: 'stagger' },
  ],
  elements: [
    {
      id: 't1',
      type: 'text',
      name: 'Title',
      x: 10,
      y: 20,
      width: 500,
      height: 120,
      rotation: -4,
      opacity: 0.9,
      locked: true,
      hidden: false,
      groupId: 'grp',
      shadow: { color: '#000000', blur: 12, x: 0, y: 6 },
      text: 'Hello ✦',
      fontFamily: 'Inter',
      fontSize: 64,
      fontWeight: 800,
      fontStyle: 'italic',
      fill: { type: 'solid', color: '#FFFFFF' },
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.1,
      letterSpacing: -0.02,
      textTransform: 'uppercase',
      warp: { style: 'arc', amount: -35 },
      photoFill: { assetId: 'ast_sky', focusX: 0.3, focusY: 0.6, zoom: 1.5 },
      stroke: { color: '#000000', width: 2 },
      highlight: { fill: { type: 'solid', color: '#C6FF3D' }, padding: 8, radius: 6 },
      animation: {
        enter: { preset: 'typewriter', delay: 200, duration: 1200 },
        exit: { preset: 'slide', duration: 400, direction: 'left' },
        loop: { preset: 'float', intensity: 40 },
      },
    },
    {
      id: 'sh1',
      type: 'shape',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      shape: 'star',
      fill: null,
      stroke: { color: '#FFD60A', width: 3 },
      cornerRadius: 4,
      points: 5,
      innerRadius: 0.5,
      dash: [4, 2],
      layout: { id: 'l1', role: 'decor' },
    },
    {
      id: 'im1',
      type: 'image',
      x: 100,
      y: 100,
      width: 400,
      height: 500,
      rotation: 3,
      opacity: 1,
      assetId: 'as_photo',
      fit: 'cover',
      focusX: 0.3,
      focusY: 0.7,
      zoom: 1.4,
      straighten: -6,
      flipX: true,
      flipY: false,
      turns: 1,
      adjust: { exposure: 10, contrast: -5, vignette: 20, grain: 12, sharpness: 30, blur: 2 },
      curves: {
        rgb: [
          { x: 0, y: 0.05 },
          { x: 1, y: 0.95 },
        ],
        r: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.55 },
          { x: 1, y: 1 },
        ],
      },
      filter: { id: 'cinematic', intensity: 80 },
      effects: { glow: 20, leak: 30, leakStyle: 'rose', dust: 10, rgbSplit: 5, scanlines: 15 },
      perspective: { vertical: 12, horizontal: -8 },
      cutout: { maskAssetId: 'as_mask', feather: 30, backdrop: { type: 'blur', amount: 40 }, method: 'on-device' },
      clip: 'arch',
      cornerRadius: 24,
      stroke: { color: '#FFFFFF', width: 8 },
      placeholder: { label: 'Your photo', fill: { type: 'solid', color: '#D9D4E4' } },
      layout: { id: 'l1', role: 'photo', locked: true, index: 2 },
      video: { trimStart: 1.5, trimEnd: 6, speed: 1.5, muted: true, loop: false },
      animation: { enter: { preset: 'bounce', delay: 0, duration: 900, direction: 'down' } },
    },
    {
      id: 'st1',
      type: 'sticker',
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      rotation: 0,
      opacity: 1,
      stickerId: 'vector:star-burst',
      tint: '#FF5CAA',
    },
  ],
};

describe('document schema', () => {
  it('keeps every field of a fully loaded document', () => {
    const parsed = documentSchema.safeParse(full);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues.slice(0, 3)));
    expect(canonicalJson(parsed.data)).toBe(canonicalJson(full));
    expect(sameDocument(parsed.data as DesignDocument, full)).toBe(true);
  });

  it('compares documents regardless of key order', () => {
    // Same content, keys in reverse order at every level.
    const reverse = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reverse)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .reverse()
                .map(([k, x]) => [k, reverse(x)]),
            )
          : v;
    const reordered = reverse(full) as DesignDocument;
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(full));
    expect(sameDocument(reordered, full)).toBe(true);
    expect(sameDocument({ ...full, slideWidth: 1081 }, full)).toBe(false);
  });
});
