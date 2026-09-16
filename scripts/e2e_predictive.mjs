// Direct Playwright E2E probe for the Predictive Analytics view.
// Purpose: detect render freezes / infinite reload loops and capture console+network.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/';
const ML = 'http://localhost:5001';
const EMAIL = 'arjunanpradip8@gmail.com';
const PASSWORD = '12345678';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--disable-dev-shm-usage'],
}).catch(async () => {
  return chromium.launch({ headless: true });
});

const page = await browser.newPage();
const consoleErrors = [];
const mlRequests = [];
let pageErrors = 0;

page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500));
});
page.on('pageerror', (e) => { pageErrors++; consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 500)); });
page.on('request', (r) => { if (r.url().startsWith(ML)) mlRequests.push(r.url().replace(ML, '') + ' ' + (r.method())); });

console.log('> navigating to', BASE);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('>>> body head:', bodyText.replace(/\n+/g, ' | ').slice(0, 300));

if (/Sign In/i.test(bodyText)) {
  console.log('> login page detected, attempting sign-in with', EMAIL);
  await page.fill('input[type="email"], input[name="email"], input[type="text"]', EMAIL).catch(() => {});
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], button:has-text("Login")');
  console.log('> submitted login, waiting 8s');
  await page.waitForTimeout(8000);
} else {
  console.log('> already authenticated (no login form seen)');
}

const afterLogin = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('>>> after auth body head:', afterLogin.replace(/\n+/g, ' | ').slice(0, 300));

const clickResult = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent && x.textContent.trim() === 'Predictive Analytics');
  if (!b) return 'NO_BUTTON';
  b.scrollIntoView({ block: 'center' });
  b.click();
  return 'CLICKED';
}).catch((e) => 'EVAL_FAIL ' + String(e).slice(0, 200));
console.log('> PA click result:', clickResult);

// Watch whether ML requests keep multiplying (loop detector)
const sample = async (label) => {
  const n = mlRequests.length;
  await page.waitForTimeout(8000);
  const count = mlRequests.filter((u) => u.includes('/predict/faults')).length;
  console.log(`[${label}] ML total reqs=${mlRequests.length} faults=${count} pageErrors=${pageErrors}`);
  return { total: mlRequests.length, faults: count };
};

await page.waitForTimeout(4000);
await sample('t+12s');
await sample('t+24s');
await sample('t+36s');

// Try to grab what is on screen (even if busy)
try {
  const bodyText = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 1500) : 'NO BODY');
  console.log('--- BODY SNAPSHOT (first 1500 chars) ---');
  console.log(bodyText);
} catch (e) {
  console.log('BODY EVAL FAILED:', String(e).slice(0, 300));
}

console.log('--- CONSOLE ERRORS (' + consoleErrors.length + ') ---');
consoleErrors.slice(0, 25).forEach((e) => console.log('ERR:', e));

await browser.close();
console.log('DONE');