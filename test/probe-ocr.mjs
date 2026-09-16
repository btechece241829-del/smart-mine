// Probe 5: why is the OCR nav button invisible after Data Hub?
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });
page.on('filechooser', () => console.log('FILECHOOSER OPENED'));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(3000);
if (await page.locator('input[autocomplete="username"]').isVisible().catch(() => false)) {
  await page.locator('input[autocomplete="username"]').fill('super@mine.com');
  await page.locator('input[autocomplete="current-password"]').fill('123456');
  await page.getByRole('button', { name: /Login/ }).click();
  await page.waitForTimeout(6000);
}

const dump = async (label) => {
  const s = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside nav button')];
    const ocr = btns.find(b => b.textContent.includes('OCR'));
    const dh = btns.find(b => b.textContent.includes('Data Hub'));
    const rec = (b) => b ? (() => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { w: r.width, h: r.height, top: r.top, display: cs.display, vis: cs.visibility, opacity: cs.opacity, transform: cs.transform.slice(0, 60) }; })() : null;
    const aside = document.querySelector('aside');
    return {
      navCount: btns.length,
      ocr: rec(ocr),
      dataHub: rec(dh),
      asideVisible: aside ? getComputedStyle(aside).visibility + '/' + getComputedStyle(aside).display + ' transform=' + getComputedStyle(aside).transform.slice(0, 40) : 'none',
      mainHead: document.querySelector('main')?.innerText?.slice(0, 60) ?? '',
      modals: document.querySelectorAll('[role="dialog"]').length,
    };
  });
  console.log(`STATE ${label}:`, JSON.stringify(s));
};

await dump('initial');

// click Data Hub & Upload (button index 3)
const boxes = await page.locator('aside nav button').allInnerTexts();
console.log('LABELS[3]:', boxes[3], '| LABELS[4]:', boxes[4]);
const dh = page.locator('aside nav button').nth(3);
const b = await dh.boundingBox().catch(() => null);
console.log('DataHub boundingBox:', JSON.stringify(b));
if (b) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
await page.waitForTimeout(4000);
await dump('after-DataHub');

// Now can the OCR button be seen?
const ocrTxt = await page.locator('aside nav button').allInnerTexts();
console.log('Nav count after DataHub:', ocrTxt.length, '| idx4:', JSON.stringify(ocrTxt[4]));
try {
  const bb = await page.locator('aside nav button').nth(4).boundingBox({ timeout: 3000 }); // boundingBox has no timeout in old API
  console.log('OCR boundingBox:', JSON.stringify(bb));
} catch (e) {
  console.log('OCR boundingBox ERR:', e.message.slice(0, 120));
}

await browser.close();
console.log('PROBE5 DONE');