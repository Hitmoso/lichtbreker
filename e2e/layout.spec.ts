import { expect, test } from '@playwright/test';
import { brightPixels, noScroll, placeOneMirror, ready, skipTutorial } from './helpers';

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
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Volgende' }).click();
  await page.waitForTimeout(1000); // laat de demo-animatie lopen
  await page.getByRole('button', { name: 'Spelen' }).click();
  await expect(page.getByRole('dialog', { name: 'Uitleg' })).toBeHidden();
  // Regressie: het opruimen van het tutorial-veld mocht het hoofdveld niet leeg maken.
  await page.waitForTimeout(500);
  const png = await page.locator('.board-host canvas').screenshot();
  expect(await brightPixels(page, png), 'main board renders after the tutorial').toBeGreaterThan(500);
});
