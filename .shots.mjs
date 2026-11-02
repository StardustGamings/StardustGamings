import { chromium, devices } from '@playwright/test';
const [out, prefix = 'after', theme = 'dark', width = '390'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: Number(width), height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript((t) => {
  if (!localStorage.getItem('stardeck.settings')) localStorage.setItem('stardeck.settings', JSON.stringify({ state: { onboarded: true, theme: t, displayName: 'Maya' }, version: 1 }));
}, theme);
const base = 'http://127.0.0.1:4400';
const ready = () => page.waitForSelector('html[data-ready="true"]', { state: 'attached' });
async function shot(name, full = false) { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${prefix}-${name}.png`, fullPage: full }); }
const pages = (process.env.PAGES ?? 'home,projects,templates,discover,settings').split(',').filter(Boolean);
const paths = { home: '/', projects: '/projects/', templates: '/templates/', discover: '/discover/', settings: '/settings/' };
for (const name of pages) { await page.goto(base + paths[name]); await ready(); await shot(name, process.env.FULL === '1'); }
if (process.env.EDITOR !== '0') {
  await page.goto(base + '/'); await ready();
  await page.getByRole('button', { name: /^New Carousel:/ }).click();
  await page.waitForTimeout(500); await shot('new-dialog');
  await page.getByTestId('create-project').click();
  await page.getByTestId('canvas-viewport').waitFor(); await shot('editor');
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Text', exact: true }).click();
  await shot('editor-text-sheet');
  await page.getByTestId('mobile-sheet').getByRole('button', { name: 'Add a heading' }).click();
  await shot('editor-selected');
  await page.getByRole('navigation', { name: 'Selection actions' }).getByRole('button', { name: 'Edit' }).click();
  await shot('editor-props');
  await page.getByRole('navigation', { name: 'Selection actions' }).getByRole('button', { name: 'Done' }).click();
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'More', exact: true }).click();
  await shot('editor-more');
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Elements', exact: true }).click();
  await shot('editor-elements');
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
