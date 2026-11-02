# Final quality check

The brief's closing checklist (section 43), with how each item is verified. "e2e" names a Playwright test, which runs
against the production build on desktop Chromium, a Pixel 7 phone and (where it matters) a browser with WebGL turned
off. Every e2e test also fails on any uncaught error or console error (`e2e/fixtures.ts`).

Last full run: **327 unit/component tests** (Vitest) and **157 Playwright runs** (108 tests, each run in whichever
of the desktop, phone and no-WebGL projects it applies to), all passing. `npm run lint`, `npm run typecheck`,
`npm run format:check` and `npm run perf:budget` are clean too.

| Check                   | Status | Evidence                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor works            | ✅     | `e2e/editor.spec.ts`: text in place, the text tool, move with snapping, resize and rotate, nudge / duplicate / group / delete, marquee, context menu, clipboard, stickers and layers, pan / zoom / rulers / guides. `src/editor/core/*.test.ts` cover geometry, snapping and element operations.            |
| Carousel works          | ✅     | `e2e/carousel.spec.ts`: smart photo dump, seamless swipe across slides, collages, adding a dump to an existing carousel, the phone flow. `e2e/app.spec.ts` creates a carousel and edits its slides with undo.                                                                                               |
| Images work             | ✅     | `e2e/photos.spec.ts`: import (picker, paste, drag), local library, crop, adjustments with hold-to-compare, dropping into frames, colour-key and on-device AI cut-outs, stickers, storage clean-up. `e2e/performance.spec.ts`: a 24-megapixel import.                                                        |
| Text works              | ✅     | `e2e/editor.spec.ts`: in-place editing, curved and warped text, fonts from the device, photo-filled text. `src/canvas/render/renderer.test.ts`: layout, wrapping, warps and masks. `npm run templates:check` measures every template's text with the real fonts.                                            |
| Templates work          | ✅     | `e2e/templates.spec.ts`: browse, search, filter, preview, use with your photos, the editor's Templates panel, saving your own, export and import of template files. `src/templates/engine.test.ts` validates all bundled templates.                                                                         |
| Filters work            | ✅     | `e2e/filters.spec.ts`, on the GPU and CPU paths: one-tap looks with intensity, effects, a look on every photo, templates that carry looks. `src/images/*.test.ts` check the develop maths.                                                                                                                  |
| Stickers work           | ✅     | `e2e/editor.spec.ts` (stickers, layers lock), `e2e/photos.spec.ts` (your own transparent sticker), `e2e/trends.spec.ts` (trend stickers).                                                                                                                                                                   |
| Undo/redo works         | ✅     | Covered across the e2e suite (moves, typing, looks, templates, palettes, restyles and version restores are each one undo step). `src/editor/history.test.ts` covers the 100-step limit.                                                                                                                     |
| Autosave works          | ✅     | `e2e/editor.spec.ts` "edits survive a reload", `e2e/app.spec.ts` (carousel autosave, backgrounds persist), `e2e/storage.spec.ts` (two tabs, a full device never loses work).                                                                                                                                |
| Export works            | ✅     | `e2e/export.spec.ts`: PNG, JPG, WebP, PDF, ZIP, the whole carousel as one image, transparency, full-quality photos with their look, photo-filled text, the phone share sheet. `e2e/motion.spec.ts`: MP4 and GIF with the right length, size and sound.                                                      |
| Mobile works            | ✅     | Every e2e test also runs on a Pixel 7 profile; phone-only tests cover the bottom toolbar, touch (tap, double-tap, one-finger drag, two-finger pan and pinch, corner-handle resize), photo flows, Magic, Filters, Trends and export sharing. `e2e/responsive.spec.ts`: no horizontal overflow on any screen. |
| Desktop works           | ✅     | The desktop project runs the full suite at 1440 × 900, and again with WebGL turned off (the CPU photo pipeline).                                                                                                                                                                                            |
| Offline mode works      | ✅     | `e2e/offline.spec.ts`: after one visit, with the network off, the app reloads, navigates, creates and saves a design, exports it and downloads its project file. `e2e/trends.spec.ts`: the last trend drop works offline.                                                                                   |
| No watermark            | ✅     | Exports draw only the design (`src/export`); `e2e/export.spec.ts` checks exported pixels. The export dialog and settings say so.                                                                                                                                                                            |
| No unnecessary paywall  | ✅     | There is no paywall, account or subscription anywhere in the code. The only optional service is a site-run AI server that is off by default (`docs/AI.md`).                                                                                                                                                 |
| Smooth animations       | ✅     | Motion with springs and `prefers-reduced-motion` support (`e2e/a11y.spec.ts` "reduced motion is honoured"); `e2e/performance.spec.ts` keeps drags free of long stalls.                                                                                                                                      |
| No major console errors | ✅     | Every e2e test fails on a console error or uncaught exception. A click-through of every control (below) found none.                                                                                                                                                                                         |
| No broken buttons       | ✅     | A click-through of every control on every screen and editor panel (below). Features that aren't built are labelled **Soon** and disabled: only opt-in cloud backup & sync.                                                                                                                                  |
| No placeholder UI       | ✅     | Every screen has real content or a designed empty state (`e2e/app.spec.ts`, "searching projects shows a helpful empty state", "without photos the Filters panel says so").                                                                                                                                  |
| Good accessibility      | ✅     | `e2e/a11y.spec.ts`: axe (WCAG 2.1 A/AA and best practices) passes on every screen, the editor, each tool and the main dialogs, in dark and light themes and on a phone. Skip link, focus kept inside dialogs, reduced motion, labelled controls, large touch handles on phones.                             |
| Good performance        | ✅     | [PERFORMANCE.md](PERFORMANCE.md): per-page JavaScript budgets checked in CI (`npm run perf:budget`), worker-based photo import and export, a 24-megapixel import without stalls over 150 ms.                                                                                                                |

## Click-through of every control

A script (Playwright, against the production build) opened each screen fresh and clicked every visible, enabled
button, link, tab, radio, switch and menu item, one at a time. After each click it checked that something happened:
the page changed, it navigated, or it opened a dialog, a download, a file picker or a new tab. It also checked that no
console error was logged. Destructive actions (delete, erase, clear, remove) were skipped here; the e2e suite covers them
with their confirmations.

| Screen                                       | Desktop controls | Phone controls |
| -------------------------------------------- | ---------------- | -------------- |
| Home                                         | 50               | 47             |
| Templates                                    | 99               | 98             |
| Discover                                     | 202              | 200            |
| Projects                                     | 26               | 25             |
| Settings                                     | 60               | 59             |
| Editor (new carousel)                        | 41               | 28             |
| Editor (a text box selected, its properties) | 96               | 51             |

No click logged a console error. What it flagged, and the outcome:

- **Fixed:** **Italic** looked available for fonts without an italic face, and a click did nothing. It is now disabled,
  with a tooltip saying the font has no italic.
- **Fixed:** **Bring forward** and **Send backward** stayed enabled for an element already at the top or bottom of the
  stack. They are now disabled when there's nowhere to go. `e2e/editor.spec.ts` covers both fixes.
- **Expected:** choosing the option that's already chosen changes nothing: "All formats", "All styles", the current
  theme, the Select tool, the current slide and the Design tab. So does centring an element that's already centred.
- **Expected:** "Skip to content" sits off-screen until it is focused. It's for keyboard users, and `e2e/a11y.spec.ts`
  covers it.
- **Expected:** on a phone, **Fit** on a design that's already fitted to the screen.
- The first phone run also flagged Home's remix cards and the new-design button. That was the script: the remix feed
  differs from load to load, and the script looked controls up by position. Looked up by name, all of them work.

## Known limits

- Cloud backup & sync is not built. It is labelled **Soon** in Settings, and nothing requires it.
- Rendering an export slide happens on the page: a 12-megapixel slide can take a few hundred milliseconds on a slow
  phone (the progress dialog stays up).
- Fonts you add are used as one face for every weight, so a family's separate bold file isn't paired automatically:
  add it as its own font.
