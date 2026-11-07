import { expect, test } from '@playwright/test';
import { placeOneMirror, ready, skipTutorial } from './helpers';

test('sound toggle persists across reloads', async ({ page }) => {
  await skipTutorial(page);
  await ready(page);
  const btn = page.getByRole('button', { name: 'Geluid' });
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('lichtbreker:sound'))).toBe('off');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Geluid' })).toHaveAttribute('aria-pressed', 'false');
});

test('a round with sound on logs no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
  await ready(page);
  const cell = await placeOneMirror(page);
  // Nog eens tikken draait de spiegel.
  const canvas = page.locator('.board-host canvas');
  const box = (await canvas.boundingBox())!;
  const size = box.width / Number(await canvas.getAttribute('data-cols'));
  await page.mouse.click(box.x + (cell.x + 0.5) * size, box.y + (cell.y + 0.5) * size);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Ja, vuur!' }).click();
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
