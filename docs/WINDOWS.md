# Windows app

The Windows app is the same static export (`out/`) in an [Electron](https://www.electronjs.org/) window. Everything
ships inside the installer, so it runs fully offline and needs no hosting. It works on Windows 10 and 11 (x64; Arm PCs
run it through Windows' x64 emulation).

## Getting the installer

Every push to `main` or to the app branch runs `.github/workflows/desktop.yml`. It builds the web export, smoke-tests
the app on Windows, builds the installer and publishes it as the **Stardeck for Windows** release (tag
`desktop-latest`):

- Direct download: `https://github.com/StardustGamings/StardustGamings/releases/download/desktop-latest/Stardeck-Setup.exe`
- It's also attached to each workflow run as the `Stardeck-Setup` artifact.

Open `Stardeck-Setup.exe`. It installs for the current Windows user (no admin rights), adds Stardeck to the Start menu
and the desktop, and opens it. The installer isn't code-signed (a certificate costs money), so Windows SmartScreen may
say **Windows protected your PC**: click **More info → Run anyway**. Installing a newer build replaces the app and
keeps your designs; uninstalling (Settings → Apps) keeps them too.

## What's different from the web app

| Area               | In the Windows app                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Pages              | Served from inside the app at `app://stardeck/`, with the same Content-Security-Policy as the website.               |
| Save / Download    | Files go straight to your **Downloads** folder (no dialog per file). One notification says so; click it to see them. |
| Storage            | Designs and photos live in the app's own storage for your Windows user (`%APPDATA%\Stardeck`).                       |
| Offline            | Always. The service worker isn't used.                                                                               |
| Links              | Links to other sites open in your normal browser.                                                                    |
| Settings → Install | Shows **Installed**.                                                                                                 |
| Privacy            | Same as the web app: nothing leaves the PC unless you turn on an online extra (trend packs, cloud AI).               |

The whole app is `desktop/main.mjs`. The page detects it with `isDesktopApp()` in `src/native/platform.ts`.

## Building locally

```bash
npm run build           # the static export
npm run desktop:start   # run it in Electron
npm run desktop:smoke   # launch it and check pages, full page loads, export and downloads
npm run desktop:dist    # the installer → dist-desktop/Stardeck-Setup.exe (build on Windows; elsewhere needs Wine)
```

The installer is configured in `desktop/electron-builder.config.cjs`. Its version follows `package.json`.
