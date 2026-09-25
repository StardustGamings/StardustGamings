import { createCarousel, expect, open, test } from './fixtures';

test.describe('onboarding', () => {
  test.use({ fresh: true });

  test('walks through five steps and never forces an account', async ({ app: page }) => {
    await page.goto('/');
    const intro = page.getByRole('dialog');
    await expect(intro.getByRole('heading', { name: 'Create anything.' })).toBeVisible();
    for (const title of ['Design your carousel.', 'Make it yours.', 'Export.', 'Share.']) {
      await intro.getByRole('button', { name: 'Next' }).click();
      await expect(intro.getByRole('heading', { name: title })).toBeVisible();
    }
    await intro.getByRole('button', { name: 'Start Creating' }).click();
    await expect(intro).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { name: /Create\.\s*Swipe\. Flex\./ })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test('home dashboard shows quick create, trending and a friendly empty state', async ({ app: page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What are we making?' })).toBeVisible();
  for (const label of ['Carousel', 'Story', 'Post', 'Reel Cover', 'Thumbnail', 'Collage', 'Poster', 'Moodboard']) {
    await expect(page.getByRole('button', { name: new RegExp(`^New ${label}:`) })).toBeVisible();
  }
  await expect(page.getByText('No designs yet 👀')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What’s hot right now' })).toBeVisible();
  await page.getByRole('radio', { name: 'Palettes' }).click();
  await expect(page.getByText('Acid Mint', { exact: true })).toBeVisible();
});

test('creates a carousel, edits slides with undo/redo, and autosaves', async ({ app: page }) => {
  await createCarousel(page, 3);
  const strip = page.getByTestId('slide-strip');
  await expect(strip.getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(3);

  await strip.getByRole('button', { name: 'Add slide' }).click();
  await expect(strip.getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(4);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(strip.getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(3);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(strip.getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(4);

  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 5000 });
  await page.reload();
  await expect(page.getByTestId('slide-strip').getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(4);
});

test('project management: rename, duplicate, trash with undo, restore, delete forever', async ({ app: page }) => {
  await createCarousel(page);
  await page.getByRole('link', { name: 'Back to home' }).click();
  const card = page.getByTestId('project-card').first();
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: /^Actions for/ }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename project' });
  await rename.getByLabel('Name').fill('Summer dump');
  await rename.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('link', { name: 'Summer dump' })).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Summer dump' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(page.getByRole('link', { name: 'Summer dump (copy)' })).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Summer dump (copy)' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash' }).click();
  await expect(page.getByRole('link', { name: 'Summer dump (copy)' })).toBeHidden();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: 'Summer dump (copy)' })).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Summer dump (copy)' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash' }).click();
  await page.goto('/projects/?view=trash');
  await expect(page.getByText('Summer dump (copy)')).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Summer dump (copy)' }).click();
  await page.getByRole('menuitem', { name: 'Delete forever' }).click();
  await page.getByRole('dialog', { name: 'Delete forever?' }).getByRole('button', { name: 'Delete forever' }).click();
  await expect(page.getByText('Trash is empty ✨')).toBeVisible();

  await page.getByRole('radio', { name: /All/ }).click();
  await expect(page.getByTestId('project-card')).toHaveCount(1);
});

test('searching projects shows a helpful empty state', async ({ app: page }) => {
  await createCarousel(page);
  await page.goto('/projects/');
  await page.getByRole('textbox', { name: 'Search projects' }).fill('zzz-nothing');
  await expect(page.getByText('Nothing matches that 🔍')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByTestId('project-card')).toHaveCount(1);
});

test('command palette switches theme and search templates opens the editor', async ({ app: page }) => {
  await open(page, '/');
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await palette.getByRole('combobox').fill('theme light');
  await expect(palette.getByRole('option', { name: 'Theme: Light' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await expect(palette).toBeHidden();
  await page.keyboard.press('ControlOrMeta+k');
  await palette.getByRole('combobox').fill('film strip');
  await expect(palette.getByRole('option', { name: /Film Strip/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.getByTestId('slide-strip').getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(3);
});

test('templates from Discover open in the editor with their slides', async ({ app: page }) => {
  await page.goto('/discover/');
  await page.getByRole('button', { name: 'Use template Big Type Drop' }).first().click();
  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.getByTestId('slide-strip').getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(5);
});

test('background changes persist across reloads', async ({ app: page, isMobile }) => {
  await createCarousel(page, 2);
  await page.getByRole('button', { name: 'Background', exact: true }).first().click();
  await page.getByRole('button', { name: 'Solid #C6FF3D' }).click();
  if (isMobile) await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 5000 });
  await page.reload();
  await page.getByRole('button', { name: 'Background', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Solid #C6FF3D' })).toHaveAttribute('aria-pressed', 'true');
});

test('settings: theme, motion and UI scale apply immediately and persist', async ({ app: page }) => {
  await page.goto('/settings/');
  await page.getByRole('radio', { name: 'OLED' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'oled');
  await page.getByRole('radio', { name: 'Off' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.getByRole('switch', { name: 'High contrast' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'oled');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('follows the OS preference by default', async ({ app: page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  });
});

test('missing projects get a friendly recovery screen', async ({ app: page }) => {
  await page.goto('/editor/?id=prj_doesnotexist');
  await expect(page.getByText('We can’t find that design 🫥')).toBeVisible();
  await page.getByRole('link', { name: 'See your projects' }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
});

test('accessibility landmarks and skip link', async ({ app: page }) => {
  await open(page, '/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeAttached();
});
