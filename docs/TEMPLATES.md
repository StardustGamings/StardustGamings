# Templates

Stardeck's template engine is plain JSON all the way down: the bundled library, the templates people save themselves and
the files they share are the same format, validated by the same schema (`src/templates/schema.ts`).

## The format

A template is metadata plus a complete design document:

```jsonc
{
  "id": "polaroid-wall", // lowercase letters, digits and dashes
  "name": "Polaroid Wall",
  "format": "carousel", // carousel · story · post · reel-cover · thumbnail · collage · poster · moodboard
  "sizeId": "ig-portrait", // a size preset (src/projects/formats.ts)
  "style": "scrapbook", // editorial · minimal · bold · scrapbook · cinematic · y2k · streetwear · retro · soft · luxury · brutalist · playful
  "description": "Instant prints taped across three slides…",
  "tags": ["polaroid", "scrapbook", "seamless"],
  "palette": ["#EADBC4", "#2B2530", "#F4E7B8", "#E86A5A"],
  "doc": {
    "version": 1,
    "slideWidth": 1080, // canvas size
    "slideHeight": 1350,
    "background": { "type": "solid", "color": "#EADBC4" },
    "slides": [{ "id": "s0", "fill": null }, "…"],
    "elements": ["…"], // text, shapes, stickers and photo frames, with positions, fonts and colours
  },
}
```

What each part covers:

| The brief asks for | Where it lives                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas size        | `doc.slideWidth` / `doc.slideHeight` (+ `sizeId`), `doc.slides`                                                                                                                                   |
| Elements/positions | `doc.elements` — strip coordinates, so an element can straddle two slides (seamless carousels)                                                                                                    |
| Fonts              | each text element's `fontFamily` / weight / style — only bundled fonts, so templates work offline                                                                                                 |
| Colours            | fills and strokes throughout; `palette` lists the main colours so the template can be re-coloured (colourways)                                                                                    |
| Images             | photo frames: image elements with `"assetId": null` and a placeholder fill. Frames keep their shape, border, adjustments and filter (the kit's `look` option), so photos dropped in arrive styled |
| Animations         | not yet — element animation data joins the document format in Phase 9 (Animations & video) behind a `version` bump, with a migration                                                              |
| Metadata           | `name`, `description`, `style`, `tags`, `format`                                                                                                                                                  |

Bundled templates never contain photos (only empty frames), and never reference anything outside the app.

## The bundled library

Files live in `src/templates/library/<format>/<id>.json`. `scripts/build-templates.mjs` generates:

- `src/templates/library/index.ts` — imports every JSON file. The app loads it **lazily** (a separate chunk, precached
  by the service worker), so dozens of templates don't weigh down every page.
- `src/templates/catalog.generated.json` — light metadata (names, formats, styles, tags, palettes, sizes, photo-frame
  counts) available synchronously: search in the command palette and trend-pack validation use it.

`npm run dev` and `npm run build` regenerate both; the unit tests fail if they're out of date.

### Adding a template

Either:

1. **Write JSON** — drop a file in the right format folder and run `npm run templates`. Or design it in the app, _Save
   as template_, export the file from Templates → Yours, and copy its `template` object into the library (give it a
   readable `id`).
2. **Use the authoring kit** — most bundled templates are written in TypeScript with `src/templates/authoring/kit.ts`
   (`text()`, `rect()`, `photo()`, `sticker()`, `polaroid()`, `tornPaper()`, …) and compiled to JSON by
   `npm run templates`. Ids are deterministic, so re-running produces identical files. Edit the `.ts` source, not the
   generated JSON, for those templates.

Then run `npm run templates:check`. It measures every text box with the real bundled fonts in Chromium and fails if a
word is wider than its box or a box is too short for its lines (the kit can only estimate glyph widths). The unit tests
also check that every template validates, uses bundled fonts and known stickers, keeps text on the canvas, matches its
size preset and has unique ids.

Everything must be original: no copied layouts, artwork, photos or brand assets.

## Using templates

- **Templates page** (`/templates`) — search (name, tags, style, format), filter by format and style, and your own
  templates under _Yours_. The command palette searches templates too.
- **Preview** — a swipe preview for carousels, the facts (size, slides, photo frames, fonts), and **colourways**:
  trend-pack palettes mapped onto the template's palette by lightness, so contrast survives (`src/templates/remix.ts`).
- **Use with my photos** — pick photos from the local library (or the device); they fill the photo frames in reading
  order (slide by slide, top to bottom, left to right).
- **In the editor** — the _Templates_ panel adds a template's slides after the current slide, scaled uniformly to the
  design's canvas and centred (a gradient that flows across several template slides is kept seamless as one locked
  backdrop shape). An empty design is replaced instead, and _Replace design_ swaps the content of a design in one step.
  Every change is a single undo step. Ids are re-generated each time, so the same template can be added twice.

## Your own templates

_Save as template_ is in the editor (top bar, Templates panel, command palette) and in every project's ⋯ menu.

- Templates are stored in IndexedDB (`templates` store, database v3) next to your projects — nothing is uploaded.
- **Photos:** by default they turn into empty frames that keep their shape, border and look. Turn on _Keep my photos_ to
  keep them; they stay on this device and count as "in use", so Settings → Storage → Clean up won't delete them.
- Rename, duplicate, export and delete (with undo) from the template's preview.

### Template files

Export writes `<name>.stardeck-template.json`:

```json
{ "kind": "stardeck-template", "version": 1, "template": { "id": "…", "name": "…", "doc": { "…": "…" } } }
```

- **Photos never leave the device.** Exported files contain empty frames only; elements that use your own uploaded
  stickers are left out, and photo file names aren't included.
- **Importing** validates the whole file with the schema (5 MB limit), assigns a new id and strips any asset references
  a file might contain — a template can't point at photos on your device. Font names and colours go through the same
  allow-lists as everything else.
