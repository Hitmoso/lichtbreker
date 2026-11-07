import { expect, test } from '@playwright/test';
import { brightPixels, noScroll, placeOneMirror, ready, skipTutorial } from './helpers';

type Box = { x: number; y: number; width: number; height: number };
/** Overlappen twee rechthoeken (met 1 px speling)? */
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

const sizes = [[360, 640], [390, 844], [430, 932], [1280, 800], [1920, 1080]] as const;

for (const [width, height] of sizes) {
  test(`no scroll and full board at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await skipTutorial(page);
    await ready(page);
    expect(await noScroll(page)).toEqual({ v: true, h: true });
    const box = (await page.locator('.board-host canvas').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    const fire = (await page.getByRole('button', { name: 'Vuur!', exact: true }).boundingBox())!;
    expect(fire.y + fire.height).toBeLessThanOrEqual(height);
  });
}

test('rotating keeps mirrors and never scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  await placeOneMirror(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  expect(await noScroll(page)).toEqual({ v: true, h: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  expect(await noScroll(page)).toEqual({ v: true, h: true });
  await expect(page.locator('.tray-mirror.is-used')).toHaveCount(1);
});

test('first visit shows the tutorial', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Uitleg' })).toBeVisible();
  await page.waitForTimeout(450);
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Volgende' }).click();
  await page.waitForTimeout(1000); // laat de demo-animatie lopen
  await page.getByRole('button', { name: 'Spelen' }).click();
  await expect(page.getByRole('dialog', { name: 'Uitleg' })).toBeHidden();
  // Regressie: het opruimen van het tutorial-veld mocht het hoofdveld niet leeg maken.
  await page.waitForTimeout(500);
  const png = await page.locator('.board-host canvas').screenshot();
  expect(await brightPixels(page, png), 'main board renders after the tutorial').toBeGreaterThan(500);
});

test('landscape phone: the board never covers the header or the buttons', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await skipTutorial(page);
  await ready(page);
  await page.waitForTimeout(300);
  const board = (await page.locator('.board-host canvas').boundingBox())!;
  const top = (await page.locator('header.top').boundingBox())!;
  const dock = (await page.locator('footer.dock').boundingBox())!;
  expect(overlap(board, top)).toBe(false);
  expect(overlap(board, dock)).toBe(false);
});

test('resizing during the fire animation does not freeze the game', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  await placeOneMirror(page);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Ja, vuur!' }).click();
  for (const w of [430, 360, 400]) { await page.waitForTimeout(150); await page.setViewportSize({ width: w, height: 844 }); }
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible({ timeout: 15_000 });
});

for (const [width, height] of [...sizes, [844, 390]] as const) {
  test(`endless mode: no scroll and board between header and dock at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await skipTutorial(page);
    await ready(page);
    await page.getByRole('radio', { name: 'Oneindig' }).click();
    for (const level of ['Moeilijk', 'Makkelijk']) {
      await page.getByRole('radio', { name: level }).click();
      await expect(page.locator('.loading')).toBeHidden();
      await page.waitForTimeout(300);
      expect(await noScroll(page)).toEqual({ v: true, h: true });
      const board = (await page.locator('.board-host canvas').boundingBox())!;
      const controls = (await page.locator('.mode-controls').boundingBox())!;
      const dock = (await page.locator('footer.dock').boundingBox())!;
      expect(overlap(board, controls)).toBe(false);
      expect(overlap(board, dock)).toBe(false);
    }
  });
}

test('landscape phone keeps the board playable (cells of at least 30 px)', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await skipTutorial(page);
  await ready(page);
  for (const mode of ['Dagelijks', 'Oneindig']) {
    await page.getByRole('radio', { name: mode }).click();
    await expect(page.locator('.loading')).toBeHidden();
    await page.waitForTimeout(300);
    const canvas = page.locator('.board-host canvas');
    const box = (await canvas.boundingBox())!;
    const rows = Number(await canvas.getAttribute('data-rows'));
    expect(box.height / rows, mode).toBeGreaterThanOrEqual(30);
    expect(await noScroll(page)).toEqual({ v: true, h: true });
  }
});
