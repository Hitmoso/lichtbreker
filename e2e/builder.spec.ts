import { expect, test, type Page } from '@playwright/test';
import { fromAscii } from '../src/core/ascii';
import { loginAs, mockAccounts, mockGithub, tapCell } from './builder-helpers';
import { noScroll, placeOneMirror } from './helpers';

/** Datum van morgen in Amsterdamse tijd, zoals de bouwer die gebruikt. */
const tomorrow = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(new Date(Date.now() + 86_400_000));

const draft = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('lichtbreker:bouwer:ontwerp')!));
const pause = (page: Page) => page.waitForTimeout(450); // panelen negeren tikken vlak na openen

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAccounts(page);
});

test('a wrong password shows a message', async ({ page }) => {
  await mockGithub(page);
  await page.goto('/?bouwer');
  await page.getByLabel('Naam').fill('tester');
  await page.getByLabel('Wachtwoord').fill('fout');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByText('Onjuiste naam of wachtwoord')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Gereedschap' })).toBeHidden();
});

test('draws, cycles colours, checks live and undoes', async ({ page }) => {
  await mockGithub(page);
  await loginAs(page);
  await page.getByRole('radio', { name: 'Muur' }).click();
  await tapCell(page, 2, 2);
  await page.getByRole('radio', { name: 'Kristal' }).click();
  await page.getByRole('radio', { name: 'Rood' }).click();
  await tapCell(page, 3, 3);
  expect((await draft(page)).puzzle.cells[3 * 7 + 3]).toEqual({ kind: 'crystal', color: 'red' });
  await tapCell(page, 3, 3);
  await expect(page.getByRole('radio', { name: 'Groen' })).toHaveAttribute('aria-checked', 'true');
  expect((await draft(page)).puzzle.cells[3 * 7 + 3]).toEqual({ kind: 'crystal', color: 'green' });
  expect((await draft(page)).puzzle.cells[2 * 7 + 2]).toEqual({ kind: 'wall' });
  await expect(page.locator('.ed-status')).toContainText(/Max \d+/);
  await expect(page.locator('.ed-status')).toContainText('geldig');
  await page.getByRole('button', { name: 'Ongedaan maken' }).click();
  expect((await draft(page)).puzzle.cells[3 * 7 + 3]).toEqual({ kind: 'crystal', color: 'red' });
  // De bron weghalen maakt de puzzel ongeldig, met uitleg.
  await page.getByRole('radio', { name: 'Gum' }).click();
  await tapCell(page, 0, 4);
  await expect(page.locator('.ed-status')).toContainText('Er is nog geen bron');
});

test('test play returns to the design', async ({ page }) => {
  await mockGithub(page);
  await loginAs(page);
  await page.getByRole('button', { name: 'Test' }).click();
  await expect(page.locator('.ed-title')).toHaveText('Test');
  await placeOneMirror(page);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Ja, vuur!' }).click();
  const result = page.getByRole('dialog', { name: 'Resultaat' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.locator('.result-label')).toHaveText('Test');
  await pause(page);
  await result.getByRole('button', { name: 'Terug naar bouwen' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Gereedschap' })).toBeVisible();
  await expect(page.locator('.ed-title')).toHaveText('Bouwer');
});

test('leaving test during the fire animation waits for it', async ({ page }) => {
  await mockGithub(page);
  await loginAs(page);
  await page.getByRole('button', { name: 'Test' }).click();
  await placeOneMirror(page);
  await page.getByRole('button', { name: 'Vuur!', exact: true }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Ja, vuur!' }).click();
  await page.getByRole('button', { name: 'Terug naar bouwen' }).click();
  // Tijdens het vuren blijft de test staan; daarna komt gewoon het resultaat.
  await expect(page.locator('.ed-title')).toHaveText('Test');
  await expect(page.getByRole('dialog', { name: 'Resultaat' })).toBeVisible({ timeout: 15_000 });
});

test('opening a date starts a fresh undo history', async ({ page }) => {
  await mockGithub(page, { [tomorrow()]: fromAscii(['....', '>.o.', '..o.', '....'], 2) });
  await loginAs(page);
  await page.getByRole('radio', { name: 'Muur' }).click();
  await tapCell(page, 3, 3);
  await page.getByRole('button', { name: 'Meer' }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Datum openen…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Datum openen' });
  await pause(page);
  await dialog.getByRole('button', { name: 'Morgen' }).click();
  await dialog.getByRole('button', { name: 'Openen' }).click();
  const confirm = page.getByRole('dialog', { name: 'Huidig ontwerp vervangen?' });
  await pause(page);
  await confirm.getByRole('button', { name: 'Doorgaan' }).click();
  await expect(page.locator('.ed-origin')).toContainText('Eigen puzzel');
  await expect(page.getByRole('button', { name: 'Ongedaan maken' })).toBeDisabled();
});

test('a restored unsaved design is not replaced without asking', async ({ page }) => {
  await mockGithub(page);
  await loginAs(page);
  await page.getByRole('radio', { name: 'Muur' }).click();
  await tapCell(page, 3, 3);
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Gereedschap' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Meer' }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Leeg veld' }).click();
  await expect(page.getByRole('dialog', { name: 'Huidig ontwerp vervangen?' })).toBeVisible();
});

test('publishes tomorrow and follows the build', async ({ page }) => {
  const gh = await mockGithub(page, { '2026-01-01': fromAscii(['.....', '>..o.', '.....'], 1) });
  await loginAs(page);
  await page.locator('.ed-publish').click();
  const dialog = page.getByRole('dialog', { name: 'Publiceren' });
  await pause(page);
  await dialog.getByRole('button', { name: 'Morgen' }).click();
  await dialog.getByRole('button', { name: 'Publiceer' }).click();
  await expect(dialog).toBeHidden();
  expect(gh.puts).toHaveLength(1);
  expect(Object.keys(gh.puts[0].data).sort()).toEqual(['2026-01-01', tomorrow()]);
  expect(gh.puts[0].message).toBe(`puzzel: ${tomorrow()} (door tester)`);
  await expect(page.locator('.ed-origin')).toContainText('Eigen puzzel');
  await expect(page.locator('.ed-run')).toHaveText('✓ Live', { timeout: 30_000 });
});

test('opens a date from the repository', async ({ page }) => {
  const own = fromAscii(['....', '>.o.', '..o.', '....'], 2);
  await mockGithub(page, { [tomorrow()]: own });
  await loginAs(page);
  await page.getByRole('button', { name: 'Meer' }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Datum openen…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Datum openen' });
  await pause(page);
  await dialog.getByRole('button', { name: 'Morgen' }).click();
  await dialog.getByRole('button', { name: 'Openen' }).click();
  await expect(page.locator('.ed-origin')).toContainText('Eigen puzzel');
  expect((await draft(page)).puzzle).toEqual(own);
});

test('removing an own puzzle shows the generated one again', async ({ page }) => {
  const own = fromAscii(['....', '>.o.', '..o.', '....'], 2);
  const gh = await mockGithub(page, { [tomorrow()]: own });
  await loginAs(page);
  await page.getByRole('button', { name: 'Meer' }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Datum openen…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Datum openen' });
  await pause(page);
  await dialog.getByRole('button', { name: 'Morgen' }).click();
  await dialog.getByRole('button', { name: 'Openen' }).click();
  await expect(page.locator('.ed-origin')).toContainText('Eigen puzzel');
  await page.getByRole('button', { name: 'Meer' }).click();
  await pause(page);
  await page.getByRole('button', { name: 'Verwijder eigen puzzel' }).click();
  const confirm = page.getByRole('dialog', { name: 'Eigen puzzel verwijderen?' });
  await pause(page);
  await confirm.getByRole('button', { name: 'Verwijderen' }).click();
  await expect(page.locator('.ed-origin')).toContainText('Gegenereerd');
  expect(gh.puts.at(-1)!.data).toEqual({});
  await expect.poll(async () => JSON.stringify((await draft(page)).puzzle)).not.toBe(JSON.stringify(own));
  expect((await draft(page)).puzzle.width).toBe(7);
});

test('a shared link plays as an own level', async ({ page }) => {
  // Klembord nabootsen: echt kopiëren vraagt focus, die parallelle tests niet garanderen.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { (window as unknown as { copied: string }).copied = t; } } });
  });
  await mockGithub(page);
  await loginAs(page);
  await page.getByRole('button', { name: 'Deel' }).click();
  await expect(page.locator('.ed-toast')).toHaveText('Link gekopieerd');
  const url = await page.evaluate(() => (window as unknown as { copied: string }).copied);
  expect(url).toMatch(/\?level=1\.7\.9\.3\./);
  await page.goto(url);
  await expect(page.locator('.top-num')).toHaveText('Eigen level');
});

for (const [name, w, h] of [['phone', 375, 812], ['desktop', 1280, 800]] as const) {
  test(`fits without scrolling on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await mockGithub(page);
    await loginAs(page);
    expect(await noScroll(page)).toEqual({ v: true, h: true });
    await page.getByRole('radio', { name: 'Bron' }).click();
    await expect(page.getByRole('radio', { name: 'Naar beneden' })).toBeVisible();
    expect(await noScroll(page)).toEqual({ v: true, h: true });
  });
}

test('generates a puzzle with a chosen theme', async ({ page }) => {
  await mockGithub(page);
  await loginAs(page);
  await page.getByRole('button', { name: 'Meer' }).click();
  await pause(page);
  if (process.env.KIJK_OUT) await page.screenshot({ path: `${process.env.KIJK_OUT}/menu-thema.png` });
  await page.getByRole('button', { name: 'Prisma', exact: true }).click();
  await expect(page.locator('.ed-toast')).toHaveText('Thema: Prisma', { timeout: 15_000 });
  await expect.poll(async () => (await draft(page)).puzzle.cells.some((c: { kind: string }) => c.kind === 'prism')).toBe(true);
  if (process.env.KIJK_OUT) await page.screenshot({ path: `${process.env.KIJK_OUT}/na-thema.png` });
});
