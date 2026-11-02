# Trends

Stardeck ships monthly **trend drops**. A drop is one JSON file with that month's templates, layouts, fonts, colours,
filters, effects, stickers, carousel styles, meme formats and social formats, plus **trend kits** that restyle a whole
design in one tap. Drops are fetched at run time, so publishing a new one never needs a new build. Everything a drop
contains is plain data that the app validates and renders itself: no images, scripts or fonts are downloaded with it.

## Where drops show up

| Place                              | What it does                                                                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discover** (_What's trending_)   | The drop's cover (drawn from its own data), the archive of earlier drops, and a section per category: kits, templates, layouts, fonts, colours, filters, effects, stickers, carousel styles, meme formats, social formats, and the remix feed |
| **Home**                           | _What's hot right now_ tabs (templates, typography, layouts, filters & effects, palettes, stickers, memes & formats)                                                                                                                          |
| **Editor → Trends** (<kbd>R</kbd>) | Suggestions for the open design, kits with a live preview of _your_ design restyled, and the drop's palettes, fonts, filters and stickers, each one tap and one undo                                                                          |
| **Editor → Filters**               | The drop's own filters under _Trending_, previewed on your photo                                                                                                                                                                              |
| **Editor → Stickers**              | A tab for the drop, including its own sticker art                                                                                                                                                                                             |
| **Smart photo dump**               | The drop's layout rules as extra styles (_✦ From September Drop_). _Try with my photos_ on Discover opens the dump with that style picked                                                                                                     |
| **Settings → Trends**              | Turn downloads off, see which drop is showing and where it came from, check now, and preview a pack file                                                                                                                                      |

A dot on **Discover** in the navigation (and _New drop_ on the home screen) marks a drop that arrived since you last
opened Discover.

## What a drop contains

The schema is `src/trends/schema.ts`, and `public/trends/pack.schema.json` is generated from it for editors. Version 2 is
current. Version 1 packs (without the newer sections) still load.

| Section       | The brief's category     | Contents                                                                                                                                                   |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| metadata      | metadata                 | `id`, `title`, `subtitle`, `publishedAt` (the day it goes live), `accent` colours                                                                          |
| `cover`       | preview                  | A headline, one of the drop's type pairings and palettes, up to 4 stickers. The app draws the cover itself                                                 |
| `templates`   | —                        | Trending built-in templates, with a label and heat (0–100)                                                                                                 |
| `layouts`     | layouts                  | Template-based layouts                                                                                                                                     |
| `layoutRules` | layout rules             | Photo-dump recipes: background, photos per slide, collage family / chaos / gutter, cover, title and caption text styles, stickers, a photo edit, letterbox |
| `typography`  | fonts                    | Heading + body pairings, from the fonts bundled with the app                                                                                               |
| `palettes`    | colors                   | 2–8 colours each                                                                                                                                           |
| `looks`       | filters                  | New filters as data: the same adjustments, tone curves and effects as the built-in looks                                                                   |
| `effects`     | effects                  | Effect cards: a CSS preview (allow-listed functions only) and, ideally, a built-in or pack look that recreates it                                          |
| `stickers`    | stickers                 | References to library stickers (`vector:…`, `emoji:…`) or to the drop's own art (`art:…`)                                                                  |
| `stickerArt`  | stickers                 | New vector stickers: SVG path data on a 100 × 100 grid (commands and numbers only), fills and strokes that can take the user's recolour                    |
| `formats`     | carousel / meme / social | A built-in template presented as a format, with `category`: `carousel`, `meme` or `social`                                                                 |
| `styles`      | —                        | **Trend kits**: a palette and a type pairing from this drop, an optional look (built-in or the drop's own) and intensity, stickers, and a motion vibe      |

Lists are capped (40 templates, 24 looks, 24 sticker art, 16 kits…) and every string is length-limited.

## Publishing a drop

1. Write `public/trends/<year>/<month>.json`. Start from `2026/september.json`. Add
   `"$schema": "../pack.schema.json"` at the top for autocompletion and validation in your editor.
2. List it in `public/trends/index.json` with its `path`, `publishedAt` and `title`.
3. Run `npm run trends:check`. It validates strictly: every template, sticker, look, font and text style must exist in
   this build, and ids must be unique. `npm run trends` also refreshes the copy bundled into the app.
4. Deploy the JSON files. That's it — no app build is needed.

- **Scheduling.** A drop with a future `publishedAt` stays hidden until that day, at local midnight for each viewer. The
  October drop in this repository is published ahead of time and goes live on 1 October.
- **Fixes.** The newest drop is always downloaded fresh, so a corrected file reaches people on their next visit.
- **Archive.** Every live drop listed in the index shows in Discover's drop switcher. Older ones are downloaded when
  picked.
- **Previewing.** Settings → Trends → _Preview a pack file_ loads a JSON file from your device into Discover and the
  editor for this session, listing every problem the strict check finds.

The app itself is lenient where the check is strict: a pack written for a newer version still shows everything this
version understands, and drops references it can't resolve (an unknown template, sticker or look).

### Hosting the feed elsewhere

By default the feed is `/trends/index.json` on the app's own site. A build can point at another feed with
`NEXT_PUBLIC_TRENDS_URL=https://example.com/trends/index.json` — useful for the native app, whose bundled files can't
change after install. That origin must then be added to `connect-src` in `public/_headers` (and `scripts/serve.mjs`).
Pack paths are resolved against the index and must stay on the same origin; anything else is ignored.

## How drops load

```
feed (index.json → newest live pack)  ─┐
local cache (last drops downloaded)    ├─▶  sanitise ─▶  store ─▶ Discover · Home · editor · pickers
bundled copy (compiled into the app)  ─┘
```

1. **Bundled.** Every pack in `public/trends/` is compiled into the app (`src/trends/bundled.generated.json`), so trends
   render offline on first launch.
2. **Cache.** Each time the feed is reached, the drop list and up to 8 packs are saved on the device, so the newest
   drop keeps working offline, including in browsers without the service worker. The service worker also caches
   `/trends/` requests (network first).
3. **Feed.** When downloads are on, the index and the newest live pack are fetched after the page loads.

The pre-rendered pages show the drop that was live when the app was built (so the page and the browser's first render
agree), and the store switches to today's drop right after load.

## Drops inside designs

Anything a drop adds to a design is copied into the design, so it keeps working after the drop is gone, offline, and
in `.stardeck` project files:

- A photo with a drop's filter stores the filter's full recipe with it (`filter.look`). Built-in looks are stored by id,
  as before.
- A sticker from a drop's art stores its paths (`sticker.art`).
- Kits and palettes change the design's own colours, fonts, filters and animations. Nothing links back to the pack.

## Kits and suggestions

**Restyling** (`src/trends/restyle.ts`) is pure and runs in one undo step:

- **Colours** are mapped lightest-to-lightest and darkest-to-darkest onto the palette, so dark text on a light
  background stays readable.
- **Fonts:** the largest text on each slide (and anything within 80% of its size) takes the heading font, and the rest
  takes the body font. A word that no longer fits its box shrinks the text, and boxes grow if the text needs more room
  (never shrink, so labels centred on shapes stay centred). Fonts load before text is measured.
- **Filter** goes on every photo and empty photo frame, so photos dropped in later match.
- **Motion** runs auto-animate in the kit's vibe.

The editor's Trends tool can switch any of the four parts off, and previews every kit on the slide you're editing.

**Suggestions** (`src/trends/suggest.ts`) are rules, not AI, and look only at the open design:

- A kit for the whole design.
- The drop's filter when photos have none.
- A trending pairing when the headline font isn't in any.
- Motion when nothing moves.
- A layout rule when there are 3 or more photos.
- A meme or social format for a single-slide post.

## Privacy and safety

- Checking for drops is a plain file download from the app's own site. No identifiers, cookies or design data are sent.
  Turn it off in Settings → Trends, and only the bundled drops are shown.
- Packs are data only, validated before use: colours are parsed, fonts must be bundled, CSS previews are an allowlist
  of filter functions, sticker art is path data only, and paths can't leave the feed's origin. No pack content is ever
  injected as HTML.

## Files

| File                                                    | Role                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/trends/schema.ts`                                  | Pack and index schemas (v1 and v2)                                                     |
| `src/trends/pack.ts`                                    | Sanitising, looks and sticker art from a pack, layout rules as dump styles, scheduling |
| `src/trends/loader.ts`                                  | Bundled packs, the local cache, the feed (index, newest live pack, archive)            |
| `src/trends/store.ts`                                   | The drop being shown, the archive, new-drop tracking, pack-file preview                |
| `src/trends/restyle.ts`, `suggest.ts`                   | Kits and suggestions                                                                   |
| `src/trends/cover.ts`                                   | The cover art, drawn from the pack                                                     |
| `src/trends/validate.ts`                                | Strict checks for authors, and the JSON Schema                                         |
| `scripts/build-trends.mjs`                              | `npm run trends` / `trends:check`                                                      |
| `src/components/discover/*`                             | Discover and Home's trending sections                                                  |
| `src/editor/panels/TrendsPanel.tsx`, `trend-actions.ts` | The editor's Trends tool                                                               |
| `src/components/settings/TrendsSection.tsx`             | Settings → Trends                                                                      |

## Tests

- `src/trends/loader.test.ts`: v1 packs, sanitising, CSS and path-data injection, scheduling by local day, index path
  rules, the feed (newest live drop, broken newest pack, offline cache, downloads off, archive).
- `src/trends/restyle.test.ts`: kits (colours keep contrast, headline and body fonts, looks travel with photos, motion,
  the result validates), one part at a time, suggestions appearing and going away.
- `src/trends/packs.test.ts`: every published pack passes the strict check, the bundled copy is in sync, and each drop
  covers every category.
- `e2e/trends.spec.ts`: Discover (every category, archive, kit to a new post), a scheduled drop going live and the
  new-drop dot, a new drop from the feed and offline, downloads off (no requests), the pack-file preview, the editor's
  Trends tool (suggestions, restyle, undo, palettes), drop filters and sticker art surviving a reload, a layout rule in
  the photo dump, the new formats, and the phone flow.

## Known limits

- Packs use the fonts bundled with the app. They can't ship font files, because designs must render offline and export
  identically.
- Layout rules are photo-dump recipes over the built-in collage families. A brand-new layout algorithm still needs an
  app update.
- Suggestions are simple rules about the open design. Smarter suggestions are part of the optional AI tools (Phase 11).
