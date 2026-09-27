# Offline storage

Everything Stardeck keeps lives **in your browser on this device**: projects, photos, version history, folders, saved
templates, fonts you add and settings. Nothing is uploaded, no account exists, and every feature below works offline.
The only way your work leaves the device is a file you download yourself: an export, a project file or a backup.

## What's stored where

IndexedDB database `stardeck` (schema v5, `src/storage/db.ts`):

| Store        | Holds                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------- |
| `projects`   | Listing records (name, format, size, slide count, dates, favourite, folder, trash)        |
| `documents`  | Each design as JSON (kept apart so listings stay fast)                                    |
| `thumbnails` | A small WebP of each design's first slide                                                 |
| `assets`     | Photo, sticker and cut-out mask records (size, hash, palette…)                            |
| `assetBlobs` | Three sizes of each photo: the original (≤ 8192 px), a 2048 px preview and a 384 px thumb |
| `templates`  | Your saved templates                                                                      |
| `versions`   | Version history (indexed by project)                                                      |
| `folders`    | Folders on the projects screen                                                            |
| `fonts`      | Font files you added (TTF, OTF, WOFF, WOFF2), with their family name and hash             |

Settings are in `localStorage`. Meta and document are written in one transaction, and a failed write rolls back. If
IndexedDB is blocked (some private-browsing modes), an in-memory backend keeps the app usable. The UI then says work
won't survive the tab, and suggests downloading a project file.

## Autosave

- Every edit is saved about 0.7 s after it is made. The top bar shows _Saved just now_, _Saving…_ or _Unsaved changes_.
- Unsaved edits are flushed when the tab is hidden, and the browser asks before closing mid-save.
- Transient failures are retried automatically (after 2, 5, 15 and 30 s).
- When the device is full, a banner explains the problem. It offers **Download a copy**, a project file made from the
  in-memory design (no storage needed), and **Try again**. Nothing unsaved is lost.

## Version history

Open it with the clock button in the editor (phones: **⋯ → Version history**) or **Version history** in the command
palette.

Versions are taken:

- when a session's first change is saved: the design **as it was when you opened it**,
- **every 10 minutes** while you keep editing,
- when you press **Ctrl/⌘ S** or choose **Save a version** (the toast confirms it's kept),
- as a **named version**, from the field at the top of History,
- **before big changes**: restoring a version, or replacing the design with a template.

Unnamed versions are skipped when nothing changed since the last one.

**Retention** (`versionsToPrune`, per design):

- every version from the last hour,
- then the newest of each hour for a day,
- then the newest of each day for 30 days,
- at most 50 unnamed versions.

Named versions are kept until you delete them (up to 50). Deleting a design forever deletes its history. Duplicating a
design starts a fresh history.

In History you can preview any version slide by slide, and do three things with it:

- **Restore** it. This is one undoable step, and the current design is kept as a version first.
- **Save it as a new design** next to the original.
- **Rename** or **delete** it.

Photos used by a version count as "in use", so cleaning up photos never breaks a version you might restore.

## Folders

On the projects screen:

- **New folder** creates a folder, with a name and one of 8 colours.
- The folder chips filter the list. The filter is kept in the URL (`?folder=`), so it survives reloads and back/forward.
- To move a design, **drag** it onto a chip, or use **Move to folder…** in its menu (keyboard and touch friendly). Moving
  doesn't change "last edited", and there's an **Undo** in the toast.
- **Edit folder** renames or recolours it. **Delete folder** removes only the folder: its designs return to _All projects_.

## Project files and backups (`.stardeck`)

A `.stardeck` file is a ZIP:

```
stardeck.json                    manifest: kind (project | backup), format version, project list, asset ids,
                                 fonts, folders and templates (backups)
projects/<id>.json               { meta, doc, thumbnail?, versions? }
thumbs/<id>.webp                 the design's thumbnail
assets/<id>/asset.json           photo record (name, size, palette…)
assets/<id>/original|preview|thumb.<ext>
templates/<id>.json              saved templates (backups)
fonts/<id>.<ttf|otf|woff|woff2>  fonts you added that the designs use (all of them in a backup)
```

- **Download project file**: from a project card's menu, the editor's **⋯** menu or the command palette. It holds one
  design, only the photos and added fonts it uses, and no version history. Use it to move a design to another device
  or send it to someone. The toast notes that it includes your photos.
- **Back up everything**: from Settings → Storage. It holds every design outside the trash with its version history,
  plus folders, saved templates, every font you added and the whole photo and sticker library.
- **Import**: use **Import** on the projects screen (or drop a `.stardeck` file onto it), or **Restore…** in
  Settings → Storage.

Import never trusts the file and never overwrites anything:

- Every JSON part is validated with the same Zod schemas as templates (`documentSchema`). A unit test proves a document
  using every field survives validation unchanged.
- Every image is identified by its bytes. Only raster images are accepted: SVG and anything unrecognised is refused.
- Photos are de-duplicated by the SHA-256 of their bytes (computed, not taken from the file).
- Ids are kept when they're free and remapped when they're not, so restoring a backup on a new device keeps its links.
- A design that's already here unchanged is skipped. A changed one is added as a copy labelled _(imported)_. Folders are
  merged by name.
- Damaged parts are skipped and counted. A file from a newer version of Stardeck gets a clear message.

The writer (`createZipBlob`) holds only one entry in memory at a time. The reader (`src/storage/unzip.ts`) reads straight
from the file, supports stored and deflated entries (so a file re-zipped by another app still opens), checks every CRC,
and ignores unsafe paths. The ZIP format caps a file at 4 GB, and the app says so if a backup would be larger.

## Storage settings

Settings → Storage shows:

- a bar of what's stored by kind: designs, photos and cut-outs, stickers, version history and saved templates;
- the browser's own usage and free space, with a warning when space runs low (under 200 MB free or 90% full). The
  projects screen shows the same warning.

It also offers:

- **Empty trash**, and **Clean up** for photos nothing uses.
- **Clear** version history. Named versions are kept.
- **Back up** and **Restore…**.
- **Protect my projects** (`navigator.storage.persist()`).
- **Erase everything**, which suggests a backup first.

## Several tabs at once

Every write announces what changed on a `BroadcastChannel` (`src/storage/sync.ts`). Messages stay inside this browser:

- Project lists, folders and photo libraries in other tabs refresh on their own.
- A design open in two tabs stays in step. When one tab saves, the other picks up the change if it has no unsaved edits
  (_Updated with changes from another tab_).
- If both tabs changed the design, the second one never overwrites silently. Saves carry the `updatedAt` they were based
  on, and the repository refuses a stale one (`SaveConflictError`). The editor then shows a banner: **Load latest** or
  **Keep mine**. Autosave pauses until you choose.
- If the design was deleted in another tab, the banner offers **Keep editing** (restores it) or **Leave it**.

## Tests

- `src/projects/versions.test.ts`: retention, version CRUD, copies, clearing, cascade on delete, photos-in-use.
- `src/projects/folders.test.ts`: folders, moving, deleting, merging from backups.
- `src/storage/project-file.test.ts`: the ZIP reader (stored, deflated, CRC and unsafe paths), a backup round trip on an
  empty device, sharing one design, re-import dedupe, labelled copies, and refusing hostile or damaged files.
- `src/projects/schema-roundtrip.test.ts`: validation keeps every field of a document.
- `src/projects/repository.test.ts`: the stale-save guard.
- `e2e/storage.spec.ts`:
  - version history: Ctrl+S, naming, restore with undo, rename and delete;
  - folders, by menu and by drag;
  - a project file carried to a clean browser profile (with its photo);
  - a backup restored on a clean profile (folder and history included);
  - two tabs in sync, with a real conflict;
  - Storage settings;
  - a simulated full disk (rescue copy, then saving resumes);
  - the phone menu.
- `e2e/offline.spec.ts`: creates, exports and downloads a project file with the network off.
