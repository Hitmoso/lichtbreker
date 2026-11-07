import { expect, test, type Page } from '@playwright/test';
import { placeOneMirror, ready, skipTutorial } from './helpers';

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('lichtbreker:v1')!));
const pause = (page: Page) => page.waitForTimeout(450); // paneel negeert tikken vlak na openen

async function openEndless(page: Page) {
  await page.getByRole('radio', { name: 'Oneindig' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Moeilijkheid' })).toBeVisible();
  await expect(page.locator('.loading')).toBeHidden();
  await expect(page.locator('.board-host canvas')).toBeVisible();
}

async function fire(page: Page) {
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Ja, vuur!' }).click();
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
});

test('play an endless round and continue with the next puzzle', async ({ page }) => {
  await openEndless(page);
  await expect(page.getByRole('radio', { name: 'Normaal' })).toHaveAttribute('aria-checked', 'true');
  await placeOneMirror(page);
  await fire(page);
  const result = page.getByRole('dialog', { name: 'Resultaat' });
  await expect(result.locator('.result-score')).toHaveText(/^\d+ \/ \d+$/);
  const seedBefore = (await saved(page)).endless.current.seed;
  await pause(page);
  await result.getByRole('button', { name: 'Volgende puzzel' }).click();
  await expect(result).toBeHidden();
  await expect(page.locator('.tray-mirror.is-used')).toHaveCount(0);
  const st = await saved(page);
  expect(st.endless.stats.normal.played).toBe(1);
  expect(st.endless.current.seed).not.toBe(seedBefore);
  expect(st.history).toEqual({});
});

test('skip: direct without mirrors, asks with mirrors', async ({ page }) => {
  await openEndless(page);
  const seed1 = (await saved(page)).endless.current.seed;
  await page.getByRole('button', { name: 'Overslaan' }).click();
  await expect.poll(async () => (await saved(page)).endless.current.seed).not.toBe(seed1);
  expect((await saved(page)).endless.stats.normal.played).toBe(0);
  await placeOneMirror(page);
  await page.getByRole('button', { name: 'Overslaan' }).click();
  await expect(page.getByRole('dialog', { name: 'Deze puzzel overslaan?' })).toBeVisible();
  await pause(page);
  await page.getByRole('button', { name: 'Blijven' }).click();
  await expect(page.locator('.tray-mirror.is-used')).toHaveCount(1);
});

test('easy uses a smaller grid that is still playable', async ({ page }) => {
  await openEndless(page);
  await page.getByRole('radio', { name: 'Makkelijk' }).click();
  await expect(page.locator('.board-host canvas')).toHaveAttribute('data-cols', '5');
  const box = (await page.locator('.board-host canvas').boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(5 / 7, 1);
  await placeOneMirror(page);
  expect((await saved(page)).endless.difficulty).toBe('easy');
});

test('reload resumes a submitted endless puzzle without reopening the sheet', async ({ page }) => {
  await openEndless(page);
  await placeOneMirror(page);
  await fire(page);
  const seed = (await saved(page)).endless.current.seed;
  await page.reload();
  await expect(page.locator('.board-host canvas')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Oneindig' }).click();
  await expect(page.getByRole('button', { name: 'Volgende puzzel' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toHaveCount(0);
  expect((await saved(page)).endless.current.seed).toBe(seed);
});

test('switching modes keeps both rounds and never touches the daily history', async ({ page }) => {
  await placeOneMirror(page);
  await openEndless(page);
  await placeOneMirror(page);
  await placeOneMirror(page);
  await page.getByRole('radio', { name: 'Dagelijks' }).click();
  await expect(page.locator('.tray-mirror.is-used')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Oneindig' }).click();
  await expect(page.locator('.tray-mirror.is-used')).toHaveCount(2);
  const st = await saved(page);
  expect(st.history).toEqual({});
  expect(st.current.placements).toHaveLength(1);
});

test('"Meer spelen" in the daily result opens endless', async ({ page }) => {
  await placeOneMirror(page);
  await fire(page);
  await pause(page);
  await page.getByRole('button', { name: 'Meer spelen' }).click();
  await expect(page.getByRole('radio', { name: 'Oneindig' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radiogroup', { name: 'Moeilijkheid' })).toBeVisible();
});

test('stats show an Oneindig block only after playing endless', async ({ page }) => {
  await page.getByRole('button', { name: 'Statistieken' }).click();
  const stats = page.getByRole('dialog', { name: 'Statistieken' });
  await expect(stats).toBeVisible();
  await expect(stats.getByRole('heading', { name: 'Oneindig' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await openEndless(page);
  await placeOneMirror(page);
  await fire(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Statistieken' }).click();
  const block = stats.locator('.endless-stats');
  await expect(stats.getByRole('heading', { name: 'Oneindig' })).toBeVisible();
  await expect(block).toContainText('Normaal');
  await expect(block.locator('.es-played')).toHaveText('1');
});
