# Android app (APK)

The Android app is the same static export (`out/`) packed into an APK with
[Capacitor](https://capacitorjs.com/). Everything, including the editor, templates, fonts, filters and on-device AI
models, ships inside the APK, so it runs fully offline and needs no hosting.

## Getting the APK

Every push to `main` or to the app branch runs `.github/workflows/android.yml`. It builds a signed release APK and
publishes it as the **Stardeck for Android** release (tag `android-latest`):

- Direct download: `https://github.com/StardustGamings/StardustGamings/releases/download/android-latest/Stardeck.apk`
- It's also attached to each workflow run as the `Stardeck-apk` artifact.

On the phone, download `Stardeck.apk` and open it. Android asks once to allow installs from that browser or Files app.
Later builds install over the old one and keep your designs, because every build is signed with the same key and
carries a higher version code (the workflow run number).

## What's different from the web app

| Area               | In the APK                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save / Download    | Files are written to **Documents/Stardeck** on the phone (gallery apps and Files see them). Android 10 and older ask for storage permission once. |
| Share              | Opens the Android share sheet (Instagram, WhatsApp, Drive, …) with the exported files.                                                            |
| Offline            | Always: the app is on the phone. The service worker isn't used.                                                                                   |
| Back button        | Closes an open dialog or menu first, then goes back a page, then leaves the app.                                                                  |
| Status bar         | Follows the app's theme (light icons on dark themes, dark icons on light).                                                                        |
| Settings → Install | Shows **Installed**.                                                                                                                              |
| Privacy            | Same as the web app: photos stay on the phone; the internet is only used for optional extras you turn on (trend packs, cloud AI).                 |

The native glue lives in `src/native/` and is loaded only inside the app (`isNativeApp()`), so browsers never download
it.

`android/app/src/main/java/com/stardustgamings/stardeck/MainActivity.java` maps page URLs like `/projects/` to their
own `index.html`. Capacitor's built-in server answers every such URL with the home page (right for single-page apps,
wrong for a static export with one HTML file per page).

## Building locally

Needs Node 22, JDK 21 and the Android SDK (Android Studio installs it; set `ANDROID_HOME`).

```bash
npm run android:sync   # next build + copy out/ into android/ + update plugins
npm run android:apk    # the above, then ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

Open `android/` in Android Studio to run it on an emulator or a USB-connected phone. After changing the logo, run
`npm run icons:android` to re-render the launcher icons and launch screens.

## Signing

APKs are signed with `android/app/sideload.keystore` (alias `stardeck`, password `stardeck-sideload`). The key is in
the repo on purpose: that lets every CI build update the previous install without a secrets setup. The trade-off is
that anyone could sign an APK with it, so only install Stardeck APKs from this repo's Releases page.

For a private key (required before publishing to the Play Store), add these repository secrets and the workflow uses
them instead: `STARDECK_KEYSTORE_BASE64` (the keystore, base64-encoded), `STARDECK_KEYSTORE_PASSWORD` and
`STARDECK_KEY_ALIAS`. Switching keys means uninstalling the old app once, so back up your designs first
(**Settings → Storage → Back up everything**).
