# Filters & effects

Everything here runs on the device: on the GPU (WebGL 1) where available, otherwise the same maths in a Web Worker. No
filter or effect needs a network connection, an account or a paid API, and nothing is watermarked.

## One-tap looks

14 built-in looks (`src/filters/looks.ts`): **Cinematic, Vintage, Film, Y2K, Cyberpunk, Monochrome, VHS, Disposable,
Polaroid, Dreamy, Dark, Street, Luxury, Minimal.**

A look is plain data — adjustments, optional tone curves and optional effects, all at full strength:

```ts
{
  id: 'disposable',
  name: 'Disposable',
  adjust: { exposure: 10, contrast: 16, saturation: 10, temperature: 14, vignette: 36, grain: 38 },
  effects: { leak: 45, leakStyle: 'amber' },
}
```

A photo stores only a reference: `filter: { id: 'disposable', intensity: 100 }`. Its own edits stay separate, so the
look can be changed or removed at any time without losing them.

### How intensity blends (`src/filters/compose.ts`)

- **Sliders:** effective value = your value + look value × intensity, clamped to the slider's range.
- **Curves:** your curves first, then the look's curve blended toward identity by intensity (one combined lookup
  table).
- **Effects:** added the same way as sliders; your own light-leak colour wins over the look's.
- **Vignette:** drawn by the renderer so it follows the visible frame (crop and zoom), including the look's share.

Unknown look ids (e.g. a design made in a newer version) are ignored rather than treated as errors.

## Effects

`src/effects/effects.ts` is the reference implementation; the shader in `src/images/gl.ts` mirrors it and the CPU path
calls it directly. All effects work in normalised photo coordinates, so they look the same on thumbnails, in the editor
and in exports.

| Effect           | What it does                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Glow             | A blurred bright-pass copy of the photo screened back on top — a soft bloom around highlights |
| Light leak       | Three soft coloured blobs screened in from the edges; four palettes: Amber, Rose, Prism, Ice  |
| Dust & scratches | Procedural specks (light and dark) on a fine grid plus a few hairline vertical scratches      |
| RGB split        | Red sampled from the right, blue from the left — chromatic aberration                         |
| Scanlines        | 320 soft lines per frame height, like a CRT or a paused tape                                  |

Grain, fade, vignette, sharpness and blur remain adjustments (Adjust section); looks use them too.

### Pipeline order

```
source ─▶ perspective ─▶ blur ─▶ RGB split + sharpen ─▶ exposure … vibrance ─▶ curves (yours, then the look's)
       ─▶ fade ─▶ glow ─▶ light leak ─▶ scanlines ─▶ dust ─▶ grain ─▶ cut-out composite ─▶ canvas (+ vignette)
```

Developed pixels are cached per element and resolution; the cache key includes the look id, its intensity and the
effects.

## Where you use them

- **Photo → Design tab:** _Filters_ (live thumbnails of your photo in every look, intensity, _Apply to all N photos_),
  _Adjust_, _Effects_. _Hold to compare_ shows the original.
- **Filters tool** (rail, <kbd>F</kbd>, or the phone selection bar): with photos selected it changes those; with none
  selected it changes every photo in the design at once — one consistent look for a whole carousel.
- **Templates** can give their photo frames a look (`look` option in the authoring kit); photos dropped in get it
  automatically.
- **Trend packs** name a look for each effect (`look` + `intensity`); Discover renders those cards with the real
  filters. Packs that name a look this version doesn't have fall back to a CSS preview.

## Adding a look

Add an entry to `LOOKS` in `src/filters/looks.ts` (values must stay within each slider's range — the unit tests check
that every look is valid and distinct). Look ids are stored in designs, so never rename or remove an existing one.
