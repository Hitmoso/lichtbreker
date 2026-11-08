import { expect, test, type Page } from '@playwright/test';
import { ready, seedPerfect } from './helpers';

async function fire(page: Page) {
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Ja, vuur!' }).click();
}

test('a perfect round celebrates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPerfect(page);
  await ready(page);
  await fire(page);
  const result = page.getByRole('dialog', { name: 'Resultaat' });
  const counter = page.locator('.counter');
  // De viering maakt de teller goud bij de schokgolf, dus vóórdat het resultaatpaneel opent.
  await expect(counter).toHaveClass(/is-perfect/, { timeout: 15_000 });
  await expect(result).toBeHidden();
  await expect(result).toBeVisible({ timeout: 15_000 });
  const [score, max] = (await result.locator('.result-score').textContent())!.split(' / ');
  expect(score).toBe(max);
  // Beste oplossing tonen: geen goud; terug naar je eigen straal: weer goud.
  await result.getByRole('button', { name: 'Bekijk beste oplossing' }).click();
  await expect(page.getByRole('button', { name: 'Jouw straal' })).toBeVisible({ timeout: 15_000 });
  await expect(counter).not.toHaveClass(/is-perfect/);
  await page.getByRole('button', { name: 'Jouw straal' }).click();
  await expect(counter).toHaveClass(/is-perfect/);
  expect(errors).toEqual([]);
});

test('perfect round with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPerfect(page);
  await ready(page);
  await fire(page);
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.counter')).toHaveClass(/is-perfect/);
});

test('resizing during the celebration does not freeze', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { max } = await seedPerfect(page);
  await ready(page);
  await fire(page);
  // Het laatste kristal is geraakt: nu begint de viering (flits, puls, golf). Resizen tijdens die viering.
  await expect(page.locator('.counter')).toHaveText(`💎 ${max}`, { timeout: 15_000 });
  for (const w of [430, 360, 400]) { await page.waitForTimeout(150); await page.setViewportSize({ width: w, height: 844 }); }
  await expect(page.locator('.counter')).not.toHaveClass(/is-perfect/);
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.counter')).toHaveClass(/is-perfect/);
});
