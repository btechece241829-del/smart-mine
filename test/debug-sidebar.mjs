import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('PAGE ERR:', e.message.slice(0, 300)));
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.locator('input[autocomplete="username"]').fill('audit.log@smartmine.dev');
await page.locator('input[autocomplete="current-password"]').fill('Test@12345');
await page.getByRole('button', { name: /Login/i }).click();
await page.waitForTimeout(6000);
const body = await page.locator('body').innerText();
console.log('BODY SAMPLE:', body.replace(/\n+/g, ' | ').slice(0, 400));
const asideCnt = await page.locator('aside').count();
console.log('ASIDE COUNT:', asideCnt);
if (asideCnt > 0) {
  const navBtns = await page.locator('aside nav button').allInnerTexts();
  console.log('NAV BUTTONS:', navBtns.join(' | '));
  const html = await page.locator('aside').first().innerHTML();
  console.log('ASIDE HTML SAMPLE:', html.slice(0, 600));
}
await browser.close();