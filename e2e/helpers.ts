import { expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

/** Slaat de tutorial over zodat het speelscherm direct bruikbaar is. */
export async function skipTutorial(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('lichtbreker:v1')) {
      localStorage.setItem('lichtbreker:v1', JSON.stringify({
        version: 1, tutorialSeen: true, seenElements: [], current: null, history: {},
      }));
    }
  });
}

/**
 * Zet de beste oplossing van de dagpuzzel van vandaag klaar (nog niet ingediend), zodat "Vuur!" het maximum haalt.
 * De puzzel wordt in Node berekend (via vite-node, vanwege de JSON-imports), net als in de browser.
 */
export async function seedPerfect(page: Page): Promise<{ max: number }> {
  const out = execSync('npx vite-node e2e/daily-solution.ts', { encoding: 'utf8' });
  const daily = JSON.parse(out.trim().split(/\r?\n/).pop()!) as { number: number; max: number; solution: unknown[] };
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('lichtbreker:v1', JSON.stringify({
      version: 1, tutorialSeen: true, seenElements: ['fixedMirror', 'prism', 'filter'], history: {},
      current: { number: d.number, placements: d.solution, submitted: false, score: null },
    }));
  }, { number: daily.number, solution: daily.solution });
  return { max: daily.max };
}

export async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('.board-host canvas')).toBeVisible();
  await expect(page.locator('.loading')).toBeHidden({ timeout: 15_000 });
}

export async function noScroll(page: Page) {
  return page.evaluate(() => ({
    v: document.documentElement.scrollHeight <= innerHeight && document.body.scrollHeight <= innerHeight,
    h: document.documentElement.scrollWidth <= innerWidth,
  }));
}

const usedMirrors = (page: Page) => page.locator('.tray-mirror.is-used').count();

/** Tikt vakken in leesvolgorde tot er een spiegel geplaatst is. Geeft het vak terug. */
export async function placeOneMirror(page: Page): Promise<{ x: number; y: number }> {
  const canvas = page.locator('.board-host canvas');
  const box = (await canvas.boundingBox())!;
  const cols = Number(await canvas.getAttribute('data-cols'));
  const rows = Number(await canvas.getAttribute('data-rows'));
  const size = box.width / cols;
  const before = await usedMirrors(page);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
      if ((await usedMirrors(page)) > before) return { x, y };
    }
  }
  throw new Error('geen leeg vak gevonden');
}

/** Tikt elk vak in leesvolgorde één keer aan tot alle spiegels liggen. */
export async function placeAllMirrors(page: Page): Promise<void> {
  const canvas = page.locator('.board-host canvas');
  const box = (await canvas.boundingBox())!;
  const cols = Number(await canvas.getAttribute('data-cols'));
  const rows = Number(await canvas.getAttribute('data-rows'));
  const size = box.width / cols;
  const total = await page.locator('.tray-mirror').count();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((await usedMirrors(page)) >= total) return;
      await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
    }
  }
  throw new Error('niet genoeg lege vakken');
}

/** Aantal heldere pixels (straal, kristallen) in een PNG; een leeg veld heeft er bijna geen. */
export async function brightPixels(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 450) n++;
    return n;
  }, png.toString('base64'));
}
