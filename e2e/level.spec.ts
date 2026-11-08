import { expect, test } from '@playwright/test';
import { fromAscii } from '../src/core/ascii';
import { encodeLevel } from '../src/core/levelcode';
import { placeOneMirror, ready, skipTutorial } from './helpers';

const LEVEL = fromAscii([
  '.....',
  '>.o.o',
  '..o..',
  '.o..o',
  '.....',
], 2);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipTutorial(page);
});

test('plays a shared level', async ({ page }) => {
  await page.goto(`/?level=${encodeLevel(LEVEL)}`);
  await expect(page.locator('.top-num')).toHaveText('Eigen level');
  await expect(page.getByRole('radio', { name: 'Oneindig' })).toBeHidden();
  await expect(page.locator('.loading')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('.board-host canvas')).toHaveAttribute('data-cols', '5');
  await placeOneMirror(page);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Ja, vuur!' }).click();
  const result = page.getByRole('dialog', { name: 'Resultaat' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.locator('.result-label')).toHaveText('Eigen level');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lichtbreker:v1') ?? '{}'));
  expect(saved.history ?? {}).toEqual({});
});

test('a broken code shows a message', async ({ page }) => {
  await page.goto('/?level=kapot');
  await expect(page.getByText('Dit level kan niet geladen worden')).toBeVisible();
  await page.getByRole('button', { name: 'Naar het spel' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test('a decodable but invalid level shows a message', async ({ page }) => {
  await page.goto(`/?level=${encodeLevel(fromAscii(['....', '>..<', '....'], 1))}`);
  await expect(page.getByText('Dit level kan niet geladen worden')).toBeVisible();
});

test('tapping the logo five times opens the builder', async ({ page }) => {
  await ready(page);
  const logo = page.locator('.brand');
  // Snel achter elkaar, zoals een mens tikt (losse clicks kunnen onder testbelasting > 2 s duren).
  await logo.click({ clickCount: 5, delay: 40 });
  await expect(page).toHaveURL(/\?bouwer$/);
});
