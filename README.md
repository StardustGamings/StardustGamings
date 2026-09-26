# ✦ Stardeck

**Create. Swipe. Flex.** — a free, local-first design studio for Instagram carousels, stories, reel covers, YouTube
thumbnails, collages, posters and moodboards.

- **Free forever.** No subscription, no "Pro" locks on the basics, no watermarks.
- **No account.** Open it and start designing.
- **Local-first.** Projects, photos and settings stay in your browser (IndexedDB). Nothing is uploaded.
- **Works offline.** Installable PWA; the editor, templates, fonts and trend packs are all cached.

> **Status: Phase 2 of 13 complete** — app shell, design system and the canvas editor. See
> [`docs/ROADMAP.md`](docs/ROADMAP.md) for exactly what works today and what lands next. Features that aren't built yet
> are marked **Soon** in the UI; there are no fake buttons.

---

## What works today

| Area                | What you can do                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**            | Animated dashboard: Quick Create for 8 formats, recent projects (thumbnail, name, last edited, duplicate / rename / favourite / delete), trending templates · typography · layouts · effects · palettes · stickers, and a remix inspiration feed.                                                                                                                                                             |
| **New design**      | Format, size preset (4:5, 1:1, 1.91:1, 9:16, 16:9, Pin, A-series, 4:3) or a custom size up to 8000px, slide count (1–30), background, or start from a template.                                                                                                                                                                                                                                               |
| **Canvas editor**   | Infinite canvas with pan/zoom (wheel, trackpad pinch, Space-drag, two-finger touch), text with in-place editing and 15 typography styles, shapes, 44 stickers, select/marquee/multi-select, move/resize/rotate with snapping & smart guides, rulers & draggable guides, grid, groups, lock/hide, layers panel, align/distribute, copy/paste/duplicate, context menu, keyboard shortcuts, undo/redo, autosave. |
| **Templates**       | 15 original templates stored as validated JSON, rendered by the same engine used for export.                                                                                                                                                                                                                                                                                                                  |
| **Trend engine**    | Trend packs are plain JSON in `public/trends/` — publish a new drop without rebuilding the app.                                                                                                                                                                                                                                                                                                               |
| **Projects**        | Search, format filters, sort, favourites, trash with undo and 30-day auto-clean, restore, delete forever.                                                                                                                                                                                                                                                                                                     |
| **Settings**        | Account (none needed), Appearance (Dark / Light / OLED / System), Animation (System / Full / Reduced / Off), Editor, Export defaults, Performance, Privacy, Storage, Shortcuts, Accessibility, About.                                                                                                                                                                                                         |
| **Command palette** | <kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> — create, navigate, search templates, open recent projects, switch theme/motion, editor actions.                                                                                                                                                                                                                                                                             |
| **Onboarding**      | Five animated intro screens; skippable; never asks for an account.                                                                                                                                                                                                                                                                                                                                            |
| **PWA / offline**   | Manifest, maskable icons, install prompt, service worker precaching the whole app, "Offline Mode" indicator.                                                                                                                                                                                                                                                                                                  |
| **Accessibility**   | Keyboard navigation, focus rings, skip link, screen-reader labels, UI scale (87.5–125%), high contrast, reduced-motion support.                                                                                                                                                                                                                                                                               |

## Quick start

Requires Node.js ≥ 20.9.

```bash
npm install
npm run dev          # http://localhost:3000
```

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
  editor/         Editor store (history, transactions, autosave), camera, actions, shortcuts
    core/         Pure logic: geometry & transforms, snapping, element ops, factories, clipboard
    canvas/       Viewport renderer, pointer/touch interactions, overlay (handles, guides), text editor, rulers
    panels/       Properties, layers, text/shapes/stickers, background, font picker
  components/
    ui/           Design-system primitives (Button, Dialog, Segmented, Switch, Toaster, …)
    shell/        App shell: nav rail, bottom bar, top bar, command palette, providers, backdrop
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
```

Key decisions:

- **One continuous canvas per carousel.** A design is a strip of `N` slides laid side by side; elements use strip
  coordinates and may straddle slide boundaries. Seamless "panorama" carousels are therefore the default, not a special
  mode. Slide operations (insert/duplicate/move/delete) move the elements that belong to each slide.
- **Canvas + overlay editor.** The scene is drawn into one viewport-sized canvas (only the visible region, once per
  animation frame); selection handles, guides and the text caret live in an SVG/DOM overlay. Gestures run as
  _transactions_ — a drag previews continuously but lands as a single undo step.
- **One renderer everywhere.** Thumbnails, template previews, the editor canvas and (Phase 7) exports all use the same
  pure `renderDocument()` Canvas2D function — what you see is exactly what you export, and it can run in a worker via
  `OffscreenCanvas`.
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
- Photos (from Phase 3) will be stored in IndexedDB on your device. Any future cloud/AI feature will be opt-in and will
  say clearly, before upload, what leaves the device.
- CSP forbids third-party scripts, frames and connections; user text is never injected as HTML; persisted data is
  re-validated on load.
- Next.js collects anonymous _build-time_ telemetry by default; run `npx next telemetry disable` if you prefer (the app
  itself sends nothing).

## Credits

Fonts are bundled from [Fontsource](https://fontsource.org/) under the SIL Open Font License (licence files ship
alongside each family in `public/fonts/`). Interface icons are from [Lucide](https://lucide.dev/) (ISC). Templates,
stickers, the logo and illustrations are original to this project.

The `Afk-Bot.zip` archive at the repository root predates Stardeck and is unrelated; it has been left untouched.
