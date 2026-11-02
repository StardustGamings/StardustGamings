// Packages the Windows installer: `npm run desktop:dist` (after `npm run build`).
// Output: dist-desktop/Stardeck-Setup.exe
// eslint-disable-next-line @typescript-eslint/no-require-imports -- electron-builder loads this file as CommonJS
const { version } = require('../package.json');

module.exports = {
  appId: 'com.stardustgamings.stardeck',
  productName: 'Stardeck',
  directories: { app: 'desktop', output: 'dist-desktop' },
  // The installer's version always follows the web app's.
  extraMetadata: { version },
  // The app is main.mjs plus the static export: no npm packages ship inside it.
  files: ['main.mjs', 'package.json', 'web/**/*', '!**/node_modules/**'],
  npmRebuild: false,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'public/icons/icon-512.png',
  },
  nsis: {
    // One click, no admin rights: installs for this Windows user and opens Stardeck.
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Stardeck',
    // Uninstalling keeps your designs, so reinstalling brings them back.
    deleteAppDataOnUninstall: false,
    artifactName: 'Stardeck-Setup.${ext}',
  },
};
