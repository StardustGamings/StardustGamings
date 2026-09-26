# Export

Every export is made **on this device**. The same `renderDocument()` that draws the editor draws the files, so what you
see is what you get. Nothing is uploaded, no account or network connection is needed (export works offline), and there
is **never a watermark**.

Open it with the **Export** button in the editor, <kbd>Ctrl/⌘</kbd> + <kbd>⇧</kbd> + <kbd>E</kbd>, _Export…_ in the
command palette, or _Export…_ in a project card's menu on the home and projects screens.

## Formats

| Format   | Best for                                           | Transparency | Notes                                                            |
| -------- | -------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| **PNG**  | Text, graphics, anything that must be pixel-sharp  | Yes          | Lossless                                                         |
| **JPG**  | Photo-heavy designs, smallest files                | No           | Quality 88 / 92 / 97 by preset                                   |
| **WebP** | Small files with great quality                     | Yes          | Disabled where the browser can't encode it (checked at run time) |
| **PDF**  | Sending or printing a carousel, one slide per page | No           | Each page is one full-bleed JPEG                                 |
| MP4      | Animated designs                                   | —            | Marked **Soon**; it arrives with animations                      |

## What to export

- **All slides.** One file per slide, delivered as **one ZIP** or, with _Separate files_ on, as individual downloads.
- **One slide.** Pick it from the thumbnails. The dialog opens on the slide you're editing.
- **Full carousel.** The whole strip as a single wide image, for previews, portfolios or a panorama. It isn't offered for
  PDF, because a PDF is always pages.

Files are named after the design: `summer-dump-01.png` … `summer-dump-12.png` inside `summer-dump.zip`,
`summer-dump.png` for a single-slide design, and `summer-dump-carousel.png` for the full strip. Accents are folded and
anything outside `a–z 0–9` becomes a dash.

## Quality

| Preset       | Size                    | Photos                                                                               |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------ |
| **Standard** | The design's own pixels | 2048 px previews (plenty at 1×)                                                      |
| **High**     | 2×                      | 2048 px previews                                                                     |
| **Maximum**  | 3×                      | Your **full-resolution originals** whenever a photo is drawn larger than its preview |

Browsers limit canvas size (Safari to about 16.7 million pixels, every browser to 16,384 px per side), so an export that
would go past **16 million pixels** or **16,384 px** on a side is scaled down just enough to fit. The dialog always shows
the exact output size before you export. A 5-slide 4:5 carousel exported as one strip at High, for example, comes out
at 8,000 × 2,000 px instead of 10,800 × 2,700.

## Transparent background

With PNG or WebP you can leave the background out. This clears the design background and every slide's own fill; photos,
text, shapes and stickers keep their transparency. Use it for stickers, logos and overlays.

## PDF

- One page per slide, in order. Each page is a JPEG at the chosen quality, embedded as-is (`DCTDecode`).
- Pages are sized at 96 px per inch, so a 1080 × 1350 slide is an 810 × 1012.5 pt page. The A-series poster size
  (1240 × 1754 px) is laid out at 150 dpi, which makes it an A4 page.
- The document title is the design name. The writer (`src/export/pdf.ts`) is ~80 lines with no dependencies, and the unit
  tests check its cross-reference table byte offsets.

## Saving and sharing

- **Desktop:** the file (or ZIP, or PDF) downloads as soon as it's ready. _Download again_ saves another copy.
- **Phones and tablets with a share sheet:** nothing is saved until you choose. _Share_ hands the images to the system
  share sheet (straight into Instagram, Photos, Messages…), and _Save_ downloads the file or ZIP instead.
- A short celebration plays when the export is ready (following your motion setting), with the file size and pixel
  dimensions.

## How it works

```
plan (pure)  ─▶  fonts ready  ─▶  per file: load photos ▸ develop looks/edits ▸ render ▸ encode  ─▶  ZIP / PDF / file
```

| File                                     | Role                                                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/export/plan.ts`                     | Pure: which regions, at what scale, with which names; quality presets; canvas limits; transparency; PDF page sizes                                                           |
| `src/export/images.ts`                   | Loads the photos a region needs (previews, or originals for Maximum), waits for the develop pipeline (GPU, or the CPU worker without WebGL), and frees everything afterwards |
| `src/export/encode.ts`                   | `canvas.toBlob` with a check that the browser really produced the requested type                                                                                             |
| `src/export/zip.ts`                      | Minimal ZIP writer (stored entries, CRC-32, UTF-8 names, de-duplicated names)                                                                                                |
| `src/export/pdf.ts`                      | Minimal PDF 1.4 writer                                                                                                                                                       |
| `src/export/export.ts`                   | `exportDesign()`: runs the plan with progress and cancellation, and packages the result                                                                                      |
| `src/components/export/ExportDialog.tsx` | The dialog: options, progress, done screen, save and share                                                                                                                   |

- Files are rendered one at a time, and each canvas is released straight after encoding, so a 20-slide Maximum export
  never holds more than one full-size canvas in memory.
- Photos with looks, adjustments, curves or cut-outs are developed for the export itself, not taken from the editor's
  screen-sized cache, so they're sharp at every quality.
- Photos that are no longer on this device (for example, deleted from the photo library) export as empty frames, and
  the done screen says how many. Empty photo frames export as their plain colour, and the dialog warns about them first.
- An export can be cancelled while it runs; nothing partial is saved.

## Tests

- `src/export/export.test.ts`: ZIP read-back and CRC-32, PDF structure and cross-reference offsets, naming, scopes,
  quality caps, transparency and PDF page sizes.
- `e2e/export.spec.ts`: real downloads checked byte for byte. It covers PNG, JPG and WebP headers and sizes, ZIP
  entries, separate files, the full carousel, PDF pages, transparent pixels, photos with a look (also in the no-WebGL
  project, through the CPU worker), export from a project card, and the phone share / save flow.
- `e2e/offline.spec.ts`: exports with the network switched off.
