import { expect, test } from '@playwright/test';
import { placeAllMirrors, placeOneMirror, ready, skipTutorial } from './helpers';

test('a full round: place, fire, result, reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  await placeOneMirror(page);
  await expect(page.locator('.tray-mirror.is-used')).toHaveCount(1);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await page.waitForTimeout(450);
  const yes = page.getByRole('button', { name: 'Ja, vuur!' });
  await yes.dblclick();
  const result = page.getByRole('dialog', { name: 'Resultaat' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.locator('.result-score')).toHaveText(/^\d+ \/ \d+$/);
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('lichtbreker:v1')!).history);
  expect(Object.keys(history)).toHaveLength(1);
  // Tips verdwijnen zodra een paneel opent.
  await expect(page.locator('.tip.is-on')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resultaat' })).toBeVisible();
});

test('cancelling the confirmation keeps playing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Nog even niet' }).click();
  await expect(page.getByRole('button', { name: 'Vuur!', exact: true })).toBeEnabled();
  await placeOneMirror(page);
});

test('the board is playable with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  await page.locator('.board-host canvas').focus();
  // Zoek met pijltjes en Enter een leeg vak tot er een spiegel staat.
  for (let i = 0; i < 63 && (await page.locator('.tray-mirror.is-used').count()) === 0; i++) {
    await page.keyboard.press('Enter');
    if ((await page.locator('.tray-mirror.is-used').count()) > 0) break;
    await page.keyboard.press(i % 14 < 6 ? 'ArrowRight' : i % 14 === 6 ? 'ArrowDown' : i % 14 < 13 ? 'ArrowLeft' : 'ArrowDown');
  }
  await expect(page.locator('.tray-mirror.is-used')).toHaveCount(1);
  await expect(page.locator('.sr-only')).toContainText('jouw spiegel');
});

test('a quick double tap on Vuur! does not confirm by accident', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  const fire = (await page.getByRole('button', { name: 'Vuur!', exact: true }).boundingBox())!;
  const x = fire.x + fire.width / 2, y = fire.y + fire.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('lichtbreker:v1')!).history);
  expect(Object.keys(history)).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Ja, vuur!' })).toBeVisible();
});

test('with every mirror placed, Vuur! fires right away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  await placeAllMirrors(page);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Ja, vuur!' })).toHaveCount(0);
});

test('with mirrors left, the confirmation says how many', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  await placeOneMirror(page);
  const total = await page.locator('.tray-mirror').count();
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Bevestig vuren' });
  await expect(dialog).toContainText('Nog spiegels over');
  await expect(dialog).toContainText(`Je hebt nog ${total - 1} spiegels over`);
});
