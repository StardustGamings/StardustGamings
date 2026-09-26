# ✦ Stardeck

**Create. Swipe. Flex.** — a free, local-first design studio for Instagram carousels, stories, reel covers, YouTube
thumbnails, collages, posters and moodboards.

- **Free forever.** No subscription, no "Pro" locks on the basics, no watermarks.
- **No account.** Open it and start designing.
- **Local-first.** Projects, photos and settings stay in your browser (IndexedDB). Nothing is uploaded — even background
  removal runs on your device.
- **Works offline.** Installable PWA; the editor, templates, fonts and trend packs are all cached.

> **Status: Phase 4 of 13 complete** — app shell, design system, canvas editor, photo editing and carousel tools. See
> [`docs/ROADMAP.md`](docs/ROADMAP.md) for exactly what works today and what lands next. Features that aren't built yet
> are marked **Soon** in the UI; there are no fake buttons.

---

## What works today

| Area                | What you can do                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**            | Animated dashboard: Quick Create for 8 formats, recent projects (thumbnail, name, last edited, duplicate / rename / favourite / delete), trending templates · typography · layouts · effects · palettes · stickers, and a remix inspiration feed.                                                                                                                                                                                                                                         |
| **New design**      | Format, size preset (4:5, 1:1, 1.91:1, 9:16, 16:9, Pin, A-series, 4:3) or a custom size up to 8000px, slide count (1–30), background, or start from a template.                                                                                                                                                                                                                                                                                                                           |
| **Canvas editor**   | Infinite canvas with pan/zoom (wheel, trackpad pinch, Space-drag, two-finger touch), text with in-place editing and 15 typography styles, shapes, 44 stickers plus your own PNG/SVG uploads, select/marquee/multi-select, move/resize/rotate with snapping & smart guides, rulers & draggable guides, grid, groups, lock/hide, layers panel, align/distribute, copy/paste/duplicate, context menu, keyboard shortcuts, undo/redo, autosave.                                               |
| **Photos**          | Add from the device (picker, drag-and-drop anywhere, paste), local photo library, 10 frame shapes to drop photos into, crop mode (pan, zoom, straighten, aspect presets, rotate 90°, flip), fill/fit, 14 adjustments (exposure → blur), tone curves, perspective, auto-enhance, hold-to-compare — all non-destructive, on the GPU with a CPU fallback.                                                                                                                                    |
| **Cut-outs**        | Background removal on your device: on-device AI (U²-Netp) or instant colour key; edge softness; transparent, colour/gradient, blurred ("portrait") or photo backdrops. An optional self-hosted server provider can be enabled at build time.                                                                                                                                                                                                                                              |
| **Carousel tools**  | Seamless swipe: one panorama across 2–10 slides with slide count, spacing, margin, crop position, alignment (centre / top / bottom / stagger) and manual adjustment. Collage engine for 2–20 photos in 6 styles (grid, editorial, bento, scrapbook, polaroid, filmstrip) with Shuffle, More chaotic / minimal / aesthetic / editorial / Gen-Z, spacing, messiness and tape & stickers — keep any photo in place while shuffling. Live swipe preview of the carousel (drag, arrows, dots). |
| **Photo magic**     | Smart photo dump: pick 3–20 photos and one of 12 vibes (chaotic Gen-Z, clean, cinematic, Y2K, travel, birthday, college, streetwear, vacation, night out, minimal, aesthetic) and get a finished, fully editable carousel — cover, title, collages, captions — generated on your device from design rules, no AI service. Start from the home screen or add to an open design.                                                                                                            |
| **Templates**       | 15 original templates stored as validated JSON, rendered by the same engine used for export.                                                                                                                                                                                                                                                                                                                                                                                              |
| **Trend engine**    | Trend packs are plain JSON in `public/trends/` — publish a new drop without rebuilding the app.                                                                                                                                                                                                                                                                                                                                                                                           |
| **Projects**        | Search, format filters, sort, favourites, trash with undo and 30-day auto-clean, restore, delete forever.                                                                                                                                                                                                                                                                                                                                                                                 |
| **Settings**        | Account (none needed), Appearance (Dark / Light / OLED / System), Animation (System / Full / Reduced / Off), Editor, Export defaults, Performance, Privacy, Storage, Shortcuts, Accessibility, About.                                                                                                                                                                                                                                                                                     |
| **Command palette** | <kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> — create, navigate, search templates, open recent projects, switch theme/motion, editor actions.                                                                                                                                                                                                                                                                                                                                                         |
| **Onboarding**      | Five animated intro screens; skippable; never asks for an account.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **PWA / offline**   | Manifest, maskable icons, install prompt, service worker precaching the whole app, "Offline Mode" indicator.                                                                                                                                                                                                                                                                                                                                                                              |
| **Accessibility**   | Keyboard navigation, focus rings, skip link, screen-reader labels, UI scale (87.5–125%), high contrast, reduced-motion support.                                                                                                                                                                                                                                                                                                                                                           |

## Quick start

Requires Node.js ≥ 20.9.

```bash
npm install
npm run dev          # http://localhost:3000
```

`npm run dev` and `npm run build` first bundle the Web Workers (`public/workers/`) and copy the ONNX Runtime binary
(`public/ml/ort/`) with `npm run workers`.

Production build (static export to `out/`, plus the generated service worker):

```bash
npm run build
npm start            # serves out/ at http://127.0.0.1:3000 with production security headers
```

### Scripts

| Script                          | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                   | Next.js dev server (service worker disabled in dev)                      |
| `npm run build`                 | Static export + service-worker precache manifest                         |
| `npm start`                     | Serve the static build locally                                           |
| `npm run check`                 | Lint + typecheck + unit tests                                            |
| `npm test` / `npm run test:e2e` | Vitest unit & component tests / Playwright end-to-end (desktop + mobile) |
| `npm run format`                | Prettier (with Tailwind class sorting)                                   |
| `npm run workers`               | Bundle the photo/cut-out Web Workers with esbuild                        |
| `npm run fonts`                 | Re-sync bundled fonts from `src/typography/font-catalog.json`            |
| `npm run icons`                 | Re-render PWA icons from the logo                                        |

End-to-end tests run against the production build: `npm run build && npm run test:e2e`.

## Architecture

**Stack:** Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 · Motion · Zustand · Radix UI
primitives · cmdk · IndexedDB (`idb`) · Zod · Vitest · Playwright.

```
src/
  app/            Routes: / · /projects · /discover · /settings · /editor?id=…
  canvas/         Canvas2D scene renderer (fills, text layout, shapes, stickers), previews, thumbnails
  assets/         Local photo library: IndexedDB blobs, file sniffing, worker decode/downscale, decode cache
  layouts/        Collage generators, seamless panorama, smart photo dump styles, apply/regenerate/shuffle
  images/         Photo pipeline: layout maths, adjustments & curves, WebGL develop (+ CPU worker fallback),
    cutout/       Background removal providers (on-device AI, colour key, optional server), guided filter
  editor/         Editor store (history, transactions, autosave), camera, actions, photo actions, shortcuts
    core/         Pure logic: geometry & transforms, snapping, element ops, factories, clipboard
    canvas/       Viewport renderer, pointer/touch interactions, overlay (handles, guides), text editor, rulers
    panels/       Properties, layers, text/shapes/stickers, background, font picker
  components/
    ui/           Design-system primitives (Button, Dialog, Segmented, Switch, Toaster, …)
    shell/        App shell: nav rail, bottom bar, top bar, command palette, providers, backdrop
    carousel/     Swipe preview
    magic/        Photo chooser and the dump / seamless / collage flows
    home/ discover/ projects/ settings/ onboarding/
  projects/       Document model & operations, formats, repository, Zod schemas, store
  storage/        IndexedDB persistence (with in-memory fallback for blocked storage)
  templates/      JSON template library + registry + palette remix
  trends/         Trend-pack schema, loader, store
  stickers/       Original vector sticker library
  typography/     Bundled font catalog & on-demand loader
  settings/       Preferences store, theme/motion resolution, UI store
  hooks/ utils/ types/
public/
  trends/         Runtime-loadable trend packs (index.json → packs)
  fonts/          18 OFL font families (latin + latin-ext), bundled for offline use
  ml/             On-device background-removal model (U²-Netp, Apache-2.0); runtime copied here at build time
  workers/        Generated worker bundles (git-ignored)
```

Key decisions:

- **One continuous canvas per carousel.** A design is a strip of `N` slides laid side by side; elements use strip
  coordinates and may straddle slide boundaries. Seamless "panorama" carousels are therefore the default, not a special
  mode. Slide operations (insert/duplicate/move/delete) move the elements that belong to each slide.
- **Layouts stay live.** A collage or panorama is a small spec (`doc.layouts`) plus membership tags on its elements. The
  generators are pure, seeded functions, so Shuffle / remix / spacing re-run them while each photo keeps its identity,
  crop and adjustments; kept-in-place photos are never moved. Detach turns a layout into plain elements.
- **Canvas + overlay editor.** The scene is drawn into one viewport-sized canvas (only the visible region, once per
  animation frame); selection handles, guides and the text caret live in an SVG/DOM overlay. Gestures run as
  _transactions_ — a drag previews continuously but lands as a single undo step.
- **One renderer everywhere.** Thumbnails, template previews, the editor canvas and (Phase 7) exports all use the same
  pure `renderDocument()` Canvas2D function — what you see is exactly what you export, and it can run in a worker via
  `OffscreenCanvas`.
- **Non-destructive photos.** Photos are stored once (original, 2048px preview, thumbnail) and referenced by id. Crop,
  zoom, straighten and flips are layout maths in the renderer; adjustments, curves, perspective and cut-outs run through
  a cached WebGL "develop" pipeline (a Web Worker does the same maths where WebGL is missing). The vignette is drawn per
  frame so it follows the crop.
- **Workers outside the bundler.** `scripts/build-workers.mjs` bundles the Web Workers with esbuild into plain files the
  static site serves from its own origin — deterministic in dev and production, and CSP-friendly.
- **Local-first storage.** Project metadata, documents and thumbnails live in separate IndexedDB stores so listings stay
  fast as documents grow. If IndexedDB is blocked, an in-memory backend keeps the app usable and the UI says so.
- **Everything that crosses a trust boundary is validated.** Templates, trend packs and persisted settings go through
  Zod/sanitisers (colours, font names and CSS filter strings are allow-listed).
- **Themes are CSS tokens.** `data-theme` / `data-motion` / `data-contrast` / `data-glass` attributes on `<html>` switch
  token sets; an inline head script applies saved preferences before first paint (no flash).
- **Motion levels.** _Full_, _Reduced_ (fades only), _Off_ (Motion's `skipAnimations` + CSS kill-switch); _System_ follows
  `prefers-reduced-motion`.

### Publishing a trend pack (no rebuild)

1. Add `public/trends/<year>/<month>.json` following the schema in `src/trends/schema.ts` (see `2026/september.json`).
2. List it first in `public/trends/index.json`.
3. Deploy the JSON. Clients fetch the newest pack when online and fall back to the bundled pack offline. Unknown template
   or sticker references are dropped automatically.

### Adding a template

Templates are JSON documents in `src/templates/library/<format>/<id>.json` (schema: `src/templates/schema.ts`). Register
the file in `src/templates/registry.ts`; the test suite validates every template on load.

## Deploying

`npm run build` outputs a fully static site in `out/` — host it anywhere (Netlify, Cloudflare Pages, S3, Vercel static).
`public/_headers` ships a strict Content-Security-Policy and caching rules for hosts that support it (Netlify, Cloudflare
Pages).

The app must be served from the **root of a domain** (`https://example.com/`, not `https://example.com/stardeck/`),
because the manifest scope, service worker and asset paths are absolute. That rules out a GitHub Pages _project_ site
(`<user>.github.io/<repo>/`) for now; a custom domain on GitHub Pages works.

Free hosting straight from this repository, no server needed:

| Host             | Setup                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Cloudflare Pages | _Workers & Pages → Create → Pages → Connect to Git_. Build command `npm run build`, output directory `out`.   |
| Netlify          | _Add new site → Import an existing project_. Build command `npm run build`, publish directory `out`.          |
| Vercel           | _Add New → Project → Import_. The Next.js preset works as-is (it runs `npm run build` and serves the export). |

Pick the branch you want to publish as the production branch. The Node version comes from `.nvmrc` (Vercel reads
`engines` in `package.json`). Every push to that branch redeploys automatically.

Optional: set `NEXT_PUBLIC_CUTOUT_ENDPOINT` at build time to offer a self-hosted background-removal server as a third
method (and add its origin to `connect-src` in `public/_headers`). See [`docs/BACKGROUND-REMOVAL.md`](docs/BACKGROUND-REMOVAL.md).

## Installing the app

Stardeck is a Progressive Web App: once it is hosted over HTTPS (or running at `http://localhost`), browsers can install
it like a native app, with its own icon and window, and it keeps working offline.

| Device                  | How to install                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Android (Chrome)        | Open the site → ⋮ menu → **Install app** (or **Add to Home screen**).                                 |
| iPhone / iPad (Safari)  | Open the site → **Share** → **Add to Home Screen**.                                                   |
| Windows / macOS / Linux | In Chrome or Edge, click the install icon in the address bar, or open **Settings → About → Install**. |

The first visit caches the whole app (about 4 MB). After that the editor, templates and fonts all work with no
connection. When you open it online, new versions download in the background and a **Reload** prompt appears.

**Store apps:** native Android/iOS builds aren't published yet. The static export is designed to be wrapped with
[Capacitor](https://capacitorjs.com/) (`webDir: "out"`), which is planned for a later phase. No server is required for
any current feature.

## Privacy & security

- No analytics, trackers or accounts. The app only requests its own files and trend packs.
- Photos are stored in IndexedDB on your device. Imports are checked by their bytes (not the file name), decoded in a
  worker, and SVGs are rasterised through an `<img>` so scripts never run.
- Background removal runs in your browser. The model and runtime (~19 MB) are downloaded once from this site and cached
  for offline use; photos never leave the device. See [`docs/BACKGROUND-REMOVAL.md`](docs/BACKGROUND-REMOVAL.md) for the
  optional, opt-in server provider — it asks before uploading anything.
- CSP forbids third-party scripts, frames and connections; `'wasm-unsafe-eval'` allows WebAssembly compilation (for the
  on-device model) without allowing JavaScript `eval`. User text is never injected as HTML; persisted data is
  re-validated on load.
- Next.js collects anonymous _build-time_ telemetry by default; run `npx next telemetry disable` if you prefer (the app
  itself sends nothing).

## Credits

Fonts are bundled from [Fontsource](https://fontsource.org/) under the SIL Open Font License (licence files ship
alongside each family in `public/fonts/`). Interface icons are from [Lucide](https://lucide.dev/) (ISC). Background
removal uses [U²-Net](https://github.com/xuebinqin/U-2-Net) (U²-Netp, Apache-2.0, ONNX export from
[rembg](https://github.com/danielgatis/rembg)) on [ONNX Runtime Web](https://onnxruntime.ai/) (MIT) — see
`public/ml/NOTICE.txt`. Templates, stickers, the logo and illustrations are original to this project.

The `Afk-Bot.zip` archive at the repository root predates Stardeck and is unrelated; it has been left untouched.
