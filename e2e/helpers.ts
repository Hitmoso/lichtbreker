import { expect, type Page } from '@playwright/test';

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

export async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('.board-host canvas')).toBeVisible();
  await expect(page.locator('.loading')).toBeHidden();
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
  const box = (await page.locator('.board-host canvas').boundingBox())!;
  const size = box.width / 7;
  const before = await usedMirrors(page);
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 7; x++) {
      await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
      if ((await usedMirrors(page)) > before) return { x, y };
    }
  }
  throw new Error('geen leeg vak gevonden');
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
