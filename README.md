# ✦ Stardeck

**Create. Swipe. Flex.** — a free, local-first design studio for Instagram carousels, stories, reel covers, YouTube
thumbnails, collages, posters and moodboards.

- **Free forever.** No subscription, no "Pro" locks on the basics, no watermarks.
- **No account.** Open it and start designing.
- **Local-first.** Projects, photos and settings stay in your browser (IndexedDB). Nothing is uploaded — even background
  removal runs on your device.
- **Works offline.** Installable PWA; the editor, templates, fonts and trend packs are all cached.
- **Never lose work.** Autosave, version history, `.stardeck` project files and one-tap backups — all on your device.

> **Status: 1.0: all 13 phases complete.** App shell, design system, canvas editor, photo editing, carousel tools,
> templates, filters & effects, export, offline storage, animations & video, the trend system, optional AI tools, a
> performance pass, and testing & hardening. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what each phase delivered
> and [`docs/QUALITY.md`](docs/QUALITY.md) for the final quality checklist. The one feature that isn't built (opt-in
> cloud sync) is marked **Soon** in the UI; there are no fake buttons.

---

## What works today

| Area                  | What you can do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**              | Animated dashboard: Quick Create for 8 formats, recent projects (thumbnail, name, last edited, duplicate / rename / favourite / delete), trending templates · typography · layouts · effects · palettes · stickers, and a remix inspiration feed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **New design**        | Format, size preset (4:5, 1:1, 1.91:1, 9:16, 16:9, Pin, A-series, 4:3) or a custom size up to 8000px, slide count (1–30), background, or start from a template.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Canvas editor**     | Infinite canvas with pan/zoom (wheel, trackpad pinch, Space-drag, two-finger touch), text with in-place editing, 15 typography styles, curved and warped text (arc, wave, bulge, rise), photo-filled text (a photo showing through the letters), 18 bundled fonts plus your own font files (TTF/OTF/WOFF/WOFF2, kept on the device), shapes, 44 stickers plus your own PNG/SVG uploads, select/marquee/multi-select, move/resize/rotate with snapping & smart guides, rulers & draggable guides, grid, groups, lock/hide, layers panel, align/distribute, copy/paste/duplicate, context menu, keyboard shortcuts, undo/redo, autosave.                                                                                                                                                   |
| **Photos**            | Add from the device (picker, drag-and-drop anywhere, paste), local photo library, 10 frame shapes to drop photos into, crop mode (pan, zoom, straighten, aspect presets, rotate 90°, flip), fill/fit, 14 adjustments (exposure → blur), tone curves, perspective, auto-enhance, hold-to-compare — all non-destructive, on the GPU with a CPU fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Filters & effects** | 14 one-tap looks — cinematic, vintage, film, Y2K, cyberpunk, monochrome, VHS, disposable camera, Polaroid, dreamy, dark, street, luxury, minimal — previewed live on your photo, with intensity, _apply to all photos_ and a Filters tool (<kbd>F</kbd>) that restyles every photo in a carousel at once. Effects: glow, light leaks (4 colours), dust & scratches, RGB split, scanlines. They stack with your adjustments, stay editable, and run on the GPU with an identical CPU fallback.                                                                                                                                                                                                                                                                                            |
| **Cut-outs**          | Background removal on your device: on-device AI (U²-Netp) or instant colour key; edge softness; transparent, colour/gradient, blurred ("portrait") or photo backdrops. An optional self-hosted server provider can be enabled at build time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Carousel tools**    | Seamless swipe: one panorama across 2–10 slides with slide count, spacing, margin, crop position, alignment (centre / top / bottom / stagger) and manual adjustment. Collage engine for 2–20 photos in 6 styles (grid, editorial, bento, scrapbook, polaroid, filmstrip) with Shuffle, More chaotic / minimal / aesthetic / editorial / Gen-Z, spacing, messiness and tape & stickers — keep any photo in place while shuffling. Live swipe preview of the carousel (drag, arrows, dots).                                                                                                                                                                                                                                                                                                |
| **Photo magic**       | Smart photo dump: pick 3–20 photos and one of 12 vibes (chaotic Gen-Z, clean, cinematic, Y2K, travel, birthday, college, streetwear, vacation, night out, minimal, aesthetic) and get a finished, fully editable carousel — cover, title, collages, captions — generated on your device from design rules, no AI service. Start from the home screen or add to an open design.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Templates**         | 63 original templates across every format and 12 styles (editorial, minimal, big type, scrapbook, cinematic, Y2K, streetwear, retro, soft, luxury, brutalist, playful) — magazine, tips list, polaroid wall, film stills, torn paper, sticker board, split screen, giant type, story polls, covers, thumbnails, posters, moodboards, and meme & social formats (tier list, nah/yeah, starter pack, POV, thread, hot take, text post…). Templates page with search and filters, swipe preview, colourways, _use with my photos_ (fills the frames), and a Templates panel in the editor that adds slides or replaces the design (undoable). Save any design as your own template (photos stay on the device), rename/duplicate/delete, and export/import `.stardeck-template.json` files. |
| **Export**            | PNG, JPG, WebP and multi-page PDF — every slide as a ZIP or separate files, one slide, or the full carousel as one wide image. Standard / High (2×) / Maximum (3×, from your full-resolution originals), transparent PNG/WebP, progress with cancel, share sheet on phones. Made on your device, works offline, **never watermarked**. <kbd>Ctrl/⌘</kbd> + <kbd>⇧</kbd> + <kbd>E</kbd> or _Export…_ on any project card. **MP4** (H.264 where supported, with sound) and **GIF** for animated designs.                                                                                                                                                                                                                                                                                   |
| **Animation & video** | Entrances (fade, slide, zoom, bounce, pop, rotate, blur reveal, typewriter, glitch, elastic), exits and loops (parallax, float, pulse) on any element; one-tap **auto-animate** in three vibes; slide lengths and transitions (swipe, fade, zoom, cut); a **timeline** to drag timing and scrub; play on the canvas or the whole design as a video. **Video clips** (MP4, WebM, MOV up to 2 min) in any frame, with trim, speed, sound, loop, crop, looks and effects. 14 animated templates. See [`docs/ANIMATION.md`](docs/ANIMATION.md).                                                                                                                                                                                                                                              |
| **Trends**            | Monthly **trend drops** as plain JSON (no rebuild to publish): _What's trending_ on Discover with every category — kits, templates, layouts, fonts, colours, filters, effects, stickers, carousel styles, meme formats, social formats — plus an archive of past drops, scheduled drops that go live on their day, a new-drop dot, and offline caching. Drops add real filters, vector stickers and photo-dump layout rules. In the editor, the **Trends** tool (<kbd>R</kbd>) suggests ideas for your design and restyles it with a kit (colours, fonts, filter, motion) in one tap. Downloads can be turned off; see [`docs/TRENDS.md`](docs/TRENDS.md).                                                                                                                               |
| **AI tools**          | Optional, and on your device by default. The **Magic** tool (<kbd>M</kbd>): captions & hashtags written from your design's words in six tones; colour palettes from your photos plus complementary, analogous, triadic, monochromatic, cinematic, pastel, neon, Y2K and dark-luxury harmonies; font pairings from the bundled fonts; background concepts in your colours; **smart resize** to 4:5, 1:1, 9:16, 16:9 and more (a copy or in place). **Auto** in the photo dump picks the cover, order, vibe and title from the photos. Everything stays editable and undoable. The colour picker takes HEX, RGB or HSL. A site can add an AI server (keys stay on the server, photos are never sent) that people switch on in Settings; see [`docs/AI.md`](docs/AI.md).                    |
| **Projects**          | Search, format filters, sort, favourites, **folders** (drag designs onto them), trash with undo and 30-day auto-clean, restore, delete forever. Import `.stardeck` project files by button or drop.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Storage & history** | Autosave with automatic retries and a rescue download when the device is full. **Version history** (as opened, every 10 min, Ctrl/⌘ S, named versions, before big changes) with preview, restore (undoable) and save-as-copy. **Project files** carry a design and its photos to another device; **Back up everything** saves every design, its history, folders, templates and photos in one file. Settings → Storage shows what's stored by kind, with cleanups. Tabs stay in sync, and edits in two places never overwrite each other silently.                                                                                                                                                                                                                                       |
| **Settings**          | Account (none needed), Appearance (Dark / Light / OLED / System), Animation (System / Full / Reduced / Off), Editor, Export defaults, Performance, Privacy, Trends, AI tools, Storage, Shortcuts, Accessibility, About.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Command palette**   | <kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> — create, navigate, search templates, open recent projects, switch theme/motion, editor actions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Onboarding**        | Five animated intro screens; skippable; never asks for an account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **PWA / offline**     | Manifest, maskable icons, install prompt, service worker precaching the whole app, "Offline Mode" indicator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Accessibility**     | Keyboard navigation, focus rings, skip link, screen-reader labels, UI scale (87.5–125%), high contrast, reduced-motion support.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

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
| `npm run templates`             | Compile the template authoring kit to JSON and re-index the library      |
| `npm run templates:check`       | Check every template's text fits its box, measured with the real fonts   |
| `npm run trends:check`          | Validate every trend drop strictly and check the bundled copy is in sync |
| `npm run perf:budget`           | Check each page's up-front JavaScript against its budget (after a build) |
| `npm run ai-proxy`              | Build and start the optional AI server (see `docs/AI.md`)                |

End-to-end tests run against the production build: `npm run build && npm run test:e2e`.

## Architecture

**Stack:** Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 · Motion · Zustand · Radix UI
primitives · cmdk · IndexedDB (`idb`) · Zod · Vitest · Playwright.

```
src/
  app/            Routes: / · /projects · /discover · /settings · /editor?id=…
  ai/             On-device AI tools (captions, palettes, font pairing, backgrounds, photo analysis & carousel plans,
                  smart resize), shared schemas, and the optional AI-server client
  animations/     Motion engine: presets & easing, poses at a moment, slide sequence & transitions, auto-animate
  canvas/         Canvas2D scene renderer (fills, text layout, shapes, stickers), previews, thumbnails
  assets/         Local photo & video library: IndexedDB blobs, file sniffing, worker decode/downscale, decode cache,
                  video import, live players and frame-exact export frames
  layouts/        Collage generators, seamless panorama, smart photo dump styles, apply/regenerate/shuffle
  filters/        One-tap looks (data), intensity blending over your edits, look previews
  effects/        Effect definitions and the reference maths the shader mirrors (glow, leaks, dust, RGB split, scanlines)
  export/         Export: pure plan (sizes, names, quality caps), photo loading & develop, encoders, ZIP and PDF writers,
                  MP4 (WebCodecs + mp4-muxer) and GIF (gifenc)
  images/         Photo pipeline: layout maths, adjustments & curves, WebGL develop (+ CPU worker fallback),
    cutout/       Background removal providers (on-device AI, colour key, optional server), guided filter
  editor/         Editor store (history, transactions, autosave), camera, actions, photo actions, shortcuts
    core/         Pure logic: geometry & transforms, snapping, element ops, factories, clipboard
    canvas/       Viewport renderer, pointer/touch interactions, overlay (handles, guides), text editor, rulers
    panels/       Properties, layers, text/shapes/stickers, background, font picker, animate, video playback
  components/
    ui/           Design-system primitives (Button, Dialog, Segmented, Switch, Toaster, …)
    shell/        App shell: nav rail, bottom bar, top bar, command palette, providers, backdrop
    carousel/     Swipe preview and motion (play as video) preview
    templates/    Template browser, preview (colourways, use with photos) and save-as-template dialogs
    export/       Export dialog (options, progress, done screen, save & share)
    magic/        Photo chooser and the dump / seamless / collage flows
    home/ discover/ projects/ settings/ onboarding/
  projects/       Document model & operations, formats, repository, Zod schemas, store
  storage/        IndexedDB persistence (in-memory fallback), cross-tab sync, usage, .stardeck files (ZIP reader, import/export)
  templates/      Template engine: schema, lazily loaded JSON library, apply/insert/fill, user templates & files
    authoring/    Authoring kit the bundled templates are written with (compiled to JSON by `npm run templates`)
  trends/         Trend drops: schema, loader (feed, cache, bundled, scheduling), store, kits & restyle, suggestions, checks
  stickers/       Original vector sticker library
  typography/     Bundled font catalog, on-demand loader, fonts you add from your device
  settings/       Preferences store, theme/motion resolution, UI store
  hooks/ utils/ types/
server/
  ai-proxy/       Optional AI server: a Fetch-API handler (Node and Workers adapters) that keeps the model API key server-side
public/
  trends/         Trend drops loaded at run time (index.json → packs) and pack.schema.json
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
- **Looks are data.** A filter is a small set of adjustments, curves and effects; a photo stores only the look's id and
  intensity next to its own edits, and the develop pipeline blends them. See [`docs/FILTERS.md`](docs/FILTERS.md).
- **Canvas + overlay editor.** The scene is drawn into one viewport-sized canvas (only the visible region, once per
  animation frame); selection handles, guides and the text caret live in an SVG/DOM overlay. Gestures run as
  _transactions_ — a drag previews continuously but lands as a single undo step.
- **One renderer everywhere.** Thumbnails, template previews, the editor canvas and exports all use the same pure
  `renderDocument()` Canvas2D function — what you see is exactly what you export, and it can run in a worker via
  `OffscreenCanvas`.
- **Export stays on the device.** Files are rendered one at a time at the chosen scale (photos re-developed at that
  size, originals for Maximum), encoded with `canvas.toBlob`, and packaged by small built-in ZIP and PDF writers — no
  upload, no dependency, works offline, no watermark. See [`docs/EXPORT.md`](docs/EXPORT.md).
- **Motion is a function of time.** Animations are data on each element; a pure engine turns "element + moment" into a
  pose (opacity, offset, scale, rotation, blur, reveal, glitch), and the same renderer draws the editor preview, the
  _Play as video_ preview and every MP4/GIF frame. Without a time, the renderer draws the design at rest, so stills and
  editing are unaffected. Video clips are image elements whose asset is a video: live frames come from `<video>`
  players, exports seek each frame exactly. See [`docs/ANIMATION.md`](docs/ANIMATION.md).
- **Non-destructive photos.** Photos are stored once (original, 2048px preview, thumbnail) and referenced by id. Crop,
  zoom, straighten and flips are layout maths in the renderer; adjustments, curves, perspective and cut-outs run through
  a cached WebGL "develop" pipeline (a Web Worker does the same maths where WebGL is missing). The vignette is drawn per
  frame so it follows the crop.
- **Fast on phones.** Pages load only what's on screen; dialogs and editor tools load on first use (and in the
  background when idle). Photo import, filter thumbnails and export encoding run in workers; previews draw in short
  slices and only when their slide changed; a drag redraws just the moving elements over cached layers. Caches are
  sized by device memory. See [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).
- **Workers outside the bundler.** `scripts/build-workers.mjs` bundles the Web Workers with esbuild into plain files the
  static site serves from its own origin — deterministic in dev and production, and CSP-friendly.
- **Local-first storage.** Project metadata, documents, thumbnails, photos, versions and folders live in separate
  IndexedDB stores so listings stay fast as documents grow. If IndexedDB is blocked, an in-memory backend keeps the app
  usable and the UI says so. Saves are atomic and carry the version they were based on, so a stale tab can't overwrite
  newer work; tabs coordinate over a BroadcastChannel. Moving between devices is a `.stardeck` file you download —
  never an upload. See [`docs/STORAGE.md`](docs/STORAGE.md).
- **Everything that crosses a trust boundary is validated.** Templates, trend packs, project files and persisted settings go through
  Zod/sanitisers (colours, font names and CSS filter strings are allow-listed).
- **Themes are CSS tokens.** `data-theme` / `data-motion` / `data-contrast` / `data-glass` attributes on `<html>` switch
  token sets; an inline head script applies saved preferences before first paint (no flash).
- **Motion levels.** _Full_, _Reduced_ (fades only), _Off_ (Motion's `skipAnimations` + CSS kill-switch); _System_ follows
  `prefers-reduced-motion`.

### Publishing a trend drop (no rebuild)

1. Add `public/trends/<year>/<month>.json` (start from `2026/september.json`; `pack.schema.json` validates it in your
   editor).
2. List it in `public/trends/index.json` with a `publishedAt` date. Drops dated in the future go live on that day.
3. Run `npm run trends:check`, then deploy the JSON. See [`docs/TRENDS.md`](docs/TRENDS.md) for the format, scheduling,
   caching and hosting the feed elsewhere.

### Adding a template

Templates are JSON documents in `src/templates/library/<format>/<id>.json` (schema: `src/templates/schema.ts`). Drop a
file in (or write it with the authoring kit in `src/templates/authoring/`), run `npm run templates` and
`npm run templates:check`. See [`docs/TEMPLATES.md`](docs/TEMPLATES.md) for the format, the kit, user templates and
template files.

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

Optional: set `NEXT_PUBLIC_AI_ENDPOINT` at build time to connect an AI server you run (`npm run ai-proxy`, or the
Workers build) for freer captions, font pairings, background concepts and carousel plans — see
[`docs/AI.md`](docs/AI.md). The app works fully without it.

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
- The AI tools run on your device. If the site has an AI server _and_ you turn it on (Settings → AI tools), the Magic
  tools send it your design's text, colours and photo measurements — never photos — and the panel says so. The model API
  key lives only on that server. See [`docs/AI.md`](docs/AI.md).
- Photos and video clips are stored in IndexedDB on your device. Imports are checked by their bytes (not the file name),
  decoded in a worker (videos by the browser's own `<video>` element), and SVGs are rasterised through an `<img>` so
  scripts never run.
- MP4 and GIF exports are encoded in the browser (WebCodecs, gifenc); CSP allows media only from this site and local
  `blob:` URLs.
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
`public/ml/NOTICE.txt`. Video export uses [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT) and GIF export
[gifenc](https://github.com/mattdesl/gifenc) (MIT). Templates, stickers, the logo and illustrations are original to this project.

The `Afk-Bot.zip` archive at the repository root predates Stardeck and is unrelated; it has been left untouched.
