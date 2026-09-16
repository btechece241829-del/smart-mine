// Probe 4: raw mouse click vs dispatchEvent on the problematic button
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 200)));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(3000);
if (await page.locator('input[autocomplete="username"]').isVisible().catch(() => false)) {
  await page.locator('input[autocomplete="username"]').fill('super@mine.com');
  await page.locator('input[autocomplete="current-password"]').fill('123456');
  await page.getByRole('button', { name: /Login/ }).click();
  await page.waitForTimeout(6000);
}
await page.locator('aside nav button').nth(1).click({ force: true, timeout: 8000 });
await page.waitForTimeout(2000);

// raw mouse click at button center
const pt = await page.evaluate(() => {
  const r = document.querySelectorAll('aside nav button')[2].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
try {
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(2000);
  const main = (await page.locator('main').innerText()).slice(0, 60);
  console.log('MOUSE CLICK OK -> main:', JSON.stringify(main));
} catch (e) {
  console.log('MOUSE CLICK FAILED:', e.message.slice(0, 200));
}

// Go back to GIS and try locator.click after manually scrolling nav to top
await page.locator('aside nav button').nth(1).dispatchEvent('click');
await page.waitForTimeout(1500);
await page.evaluate(() => { document.querySelector('nav').scrollTop = 0; });
try {
  await page.locator('aside nav button').nth(2).click({ force: true, timeout: 4000 });
  console.log('CLICK AFTER MANUAL SCROLL OK');
} catch (e) {
  console.log('CLICK AFTER MANUAL SCROLL FAILED:', e.message.slice(0, 120));
}

console.log('PAGE ERRORS:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
console.log('PROBE4 DONE');