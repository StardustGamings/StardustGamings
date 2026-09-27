// Tests the Android app on an emulator (run by .github/workflows/android.yml):
//  1. the release APK installs, starts and keeps running without a crash;
//  2. the debug APK (same code, with WebView debugging on) is driven through Playwright:
//     pages load, a full page load opens the right page, Settings says "Installed",
//     a new design exports, Save writes it to Documents/Stardeck, Share opens the
//     Android share sheet, and the back button closes dialogs before leaving the page.
// Screenshots go to android-screenshots/.
// Usage: node scripts/android-smoke.mjs <release.apk> <debug.apk>
import { _android as android } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PKG = 'com.stardustgamings.stardeck';
const [releaseApk, debugApk] = process.argv.slice(2);
assert.ok(releaseApk && debugApk, 'usage: node scripts/android-smoke.mjs <release.apk> <debug.apk>');

const SHOTS = 'android-screenshots';
mkdirSync(SHOTS, { recursive: true });
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const screencap = (name) => writeFileSync(`${SHOTS}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p']));
const step = (text) => console.log(`• ${text}`);

// If anything fails, keep a screenshot and the device log (filtered copy in the job output).
process.on('exit', (code) => {
  if (code === 0) return;
  try {
    screencap('failure');
  } catch {
    /* the emulator may be gone */
  }
  try {
    const log = adb('logcat', '-d', '-v', 'time');
    writeFileSync(`${SHOTS}/logcat.txt`, log);
    const wanted = /AndroidRuntime|FATAL|chromium|cr_|WebView|Capacitor|libc|DEBUG|lowmemorykiller|stardeck|render|Console/i;
    const lines = log.split('\n').filter((l) => wanted.test(l));
    console.log(`--- device log (filtered, last 200 of ${lines.length}) ---\n${lines.slice(-200).join('\n')}`);
    console.log(`--- crash buffer ---\n${adb('logcat', '-d', '-b', 'crash')}`);
  } catch (e) {
    console.log(`Couldn't read the device log: ${e.message}`);
  }
});

/** Emulators sometimes show a system dialog (e.g. "System UI isn't responding") over the app: clear them and wake the screen. */
function clearScreen() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  adb('shell', 'wm', 'dismiss-keyguard');
  adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS');
}

function assertNoCrash() {
  const crashes = adb('logcat', '-d', '-b', 'crash');
  assert.ok(!crashes.includes(PKG), `The app crashed:\n${crashes}`);
}

/* ───────────── 1. Release APK ───────────── */

step('installing the release APK');
adb('install', '-r', releaseApk);
adb('logcat', '-c');
clearScreen();
adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
await sleep(15_000);
screencap('1-release-start');
assert.ok(adb('shell', 'pidof', PKG).trim(), 'the release app is still running');
assertNoCrash();
step('release APK starts and keeps running');
adb('uninstall', PKG);

/* ───────────── 2. Debug APK, driven through its WebView ───────────── */

step('installing the debug APK');
adb('install', '-r', debugApk);
clearScreen();
adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);

const [device] = await android.devices({ omitDriverInstall: true });
assert.ok(device, 'an emulator is connected');
const webview = await device.webView({ pkg: PKG }, { timeout: 60_000 });
const page = await webview.page();
page.setDefaultTimeout(60_000);

const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
// Debug builds log every rejected plugin call; closing the share sheet is one, and the app handles it.
const expected = [/Share canceled/];
page.on('console', (m) => m.type() === 'error' && !expected.some((re) => re.test(m.text())) && problems.push(m.text()));

// The page flags itself ready once its handlers are live (checked as attached: <html> itself has no box to be "visible").
const ready = () => page.waitForSelector('html[data-ready="true"]', { state: 'attached' });
await ready();
step(`home loaded at ${page.url()}`);
assert.equal(new URL(page.url()).pathname, '/');
screencap('2-first-launch');

// Skip the intro tour for the rest of the run.
await page.evaluate(() => localStorage.setItem('stardeck.settings', JSON.stringify({ state: { onboarded: true }, version: 1 })));
await page.reload();
await ready();
assert.match(await page.locator('h1').first().innerText(), /Create/);
screencap('3-home');

step('full page load of /projects/');
await page.goto('https://localhost/projects/');
await ready();
assert.equal(await page.locator('h1').first().innerText(), 'Projects');
assert.equal(await page.title(), 'Projects · Stardeck');

step('Settings shows the app as installed');
await page.goto('https://localhost/settings/');
await ready();
await page.getByText('Installed', { exact: true }).first().waitFor();

step('making a post and exporting it');
await page.goto('https://localhost/');
await ready();
await page.getByRole('button', { name: /^New Post:/ }).click();
await page.getByTestId('create-project').click();
await page.getByTestId('canvas-viewport').waitFor();
await sleep(1500);
screencap('4-editor');

await page.getByTestId('open-export').click();
const exportDialog = page.getByRole('dialog', { name: 'Export' });
await exportDialog.waitFor();
step('back button closes the export dialog');
adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
await exportDialog.waitFor({ state: 'hidden' });
await page.getByTestId('canvas-viewport').waitFor();

await page.getByTestId('open-export').click();
await page.getByTestId('export-start').click();
await page.getByTestId('export-done').waitFor();
screencap('5-export-ready');

step('Save writes the file to Documents/Stardeck');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.getByText('Saved to Documents/Stardeck').first().waitFor();
let saved = '';
for (let i = 0; i < 20 && !/\.png/.test(saved); i++) {
  saved = adb('shell', 'ls', '/sdcard/Documents/Stardeck/').trim();
  if (!/\.png/.test(saved)) await sleep(500);
}
assert.match(saved, /\.png/, 'a PNG was saved in Documents/Stardeck');
const pngName = saved.split(/\s+/).find((f) => f.endsWith('.png'));
const header = execFileSync('adb', ['exec-out', 'head', '-c', '4', `/sdcard/Documents/Stardeck/${pngName}`]);
assert.deepEqual([...header], [0x89, 0x50, 0x4e, 0x47], 'the saved file is a PNG');
screencap('6-saved');

step('Share opens the Android share sheet');
await page.getByRole('button', { name: 'Share', exact: true }).click();
let chooser = '';
for (let i = 0; i < 20 && !/ChooserActivity|ResolverActivity|chooser/i.test(chooser); i++) {
  await sleep(500);
  chooser =
    adb('shell', 'dumpsys', 'activity', 'activities')
      .match(/mResumedActivity.*|topResumedActivity.*/g)
      ?.join('\n') ?? '';
}
screencap('7-share-sheet');
assert.match(chooser, /ChooserActivity|ResolverActivity|chooser/i, `the share sheet opened (resumed: ${chooser})`);
adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
await sleep(2000);
assert.equal(await page.getByText('Couldn’t open the share sheet').count(), 0, 'closing the share sheet is not an error');

step('back button leaves the editor');
await page.getByRole('button', { name: 'Done', exact: true }).click();
await page.getByTestId('export-done').waitFor({ state: 'hidden' });
adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
await page.waitForURL((url) => !url.pathname.startsWith('/editor'));
await ready();
screencap('8-back-home');

assertNoCrash();
assert.deepEqual(problems, [], `Errors in the app:\n${problems.join('\n')}`);
await device.close();
console.log('Android smoke test passed');
