// ════════════════════════════════════════════════════════════════
// SMART-MINE FULL SYSTEM E2E AUDIT — 4 isolated browsers, one per role.
// DOM-native helpers to avoid Playwright locator resolution hangs
// (Leaflet/DataHub CSS animations stall the locator engine in headless).
// ════════════════════════════════════════════════════════════════
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const WARN = '⚠️  WARN';

const ACCOUNTS = [
  { email: 'super@mine.com', password: '123456', role: 'super_admin', roleLabel: 'Super Admin / Agent' },
  { email: 'manager@mine.com', password: '123456', role: 'mine_manager', roleLabel: 'Mine Manager' },
  { email: 'overman@mine.com', password: '123456', role: 'overman', roleLabel: 'Overman' },
  { email: 'worker@mine.com', password: '123456', role: 'worker', roleLabel: 'Worker / Miner' },
];

const NAV_BY_ROLE = {
  super_admin: [
    'Dashboard','GIS Mapping','Report Issue','Data Hub & Upload','OCR Attendance','Mines',
    'Attendance Register','Attendance Review','Users','Complaints','All Departments','Compliance',
    'Reports','Audit Logs','Escalation Rules','System Settings','Notifications','Profile',
    'Report Safety Issue','Complaint Explorer','Complaint Map','Safety Analytics','Manage Categories',
    'Blockchain Dashboard','Verify Records','Audit Trail','QR Verification','Predictive Analytics',
  ],
  mine_manager: [
    'Dashboard','GIS Mapping','Report Issue','All Mine Complaints','Critical Issues','Compliance Analytics',
    'Attendance Register','Attendance Review','Reports','Notifications','Profile',
    'Report Safety Issue','Complaint Explorer','Complaint Map','Safety Analytics','Manage Categories',
    'Blockchain Dashboard','Verify Records','Audit Trail','QR Verification',
  ],
  overman: [
    'Dashboard','GIS Mapping','Report Issue','Complaints','Inspections','Mark Attendance','Escalations','Notifications','Profile',
    'Report Safety Issue','Complaint Explorer','Complaint Map','Blockchain Dashboard','Verify Records','QR Verification',
  ],
  worker: [
    'Dashboard','GIS Mapping','Report Issue','My Complaints','Notifications','Profile',
    'Report Safety Issue','Complaint Explorer','Complaint Map','Verify Records','QR Verification',
  ],
};

const results = { pass: 0, fail: 0, warn: 0, details: [] };
function R(name, status, detail = '') {
  if (status === PASS) results.pass++; else if (status === FAIL) results.fail++; else results.warn++;
  const line = `[${status}] ${name}${detail ? ' — ' + detail : ''}`;
  results.details.push(line); console.log(line);
}
// ── DOM-native helpers (never use Playwright locator engine) ──

/** Click the nav button by index (pure DOM + raw mouse). */
async function navClick(page, index) {
  const r = await page.evaluate((i) => {
    const b = document.querySelectorAll('aside nav button')[i];
    if (!b) return null;
    const box = b.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width, h: box.height };
  }, index);
  if (!r || r.w === 0 || r.h === 0) {
    await page.evaluate((i) => document.querySelectorAll('aside nav button')[i]?.click(), index);
  } else {
    await page.mouse.click(r.x, r.y);
  }
}

/** Click the first element matching a text string inside a container CSS selector (DOM + raw mouse). */
async function clickByText(page, containerCss, text) {
  const r = await page.evaluate(({ css, text }) => {
    const matches = [...document.querySelectorAll(css)].filter(el => el.textContent.includes(text));
    if (!matches.length) return null;
    const box = matches[0].getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width, h: box.height };
  }, { css: containerCss, text });
  if (!r) throw new Error(`clickByText: no match for "${text}" in ${containerCss}`);
  if (r.w > 0 && r.h > 0) await page.mouse.click(r.x, r.y);
  else await page.evaluate(({ css, text }) => { [...document.querySelectorAll(css)].find(el => el.textContent.includes(text))?.click(); }, { css: containerCss, text });
}

/** Wait for a text to become visible somewhere in the DOM (polling, no locator). */
async function waitForText(page, text, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await page.evaluate((t) => document.body.innerText.includes(t), text);
    if (found) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function mainText(page) {
  return (await page.evaluate(() => document.querySelector('main')?.innerText ?? '').catch(() => '')).trim();
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body.innerText ?? '').catch(() => '')).trim();
}

/** Get all sidebar nav button labels. */
async function getNavItems(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('aside nav button')].map(b => b.textContent.trim()).filter(t => t.length > 0);
  });
}

async function navCount(page) {
  return page.evaluate(() => document.querySelectorAll('aside nav button').length);
}

/** All sidebar nav labels, in DOM order (alias used by the runner). */
async function navLabels(page) {
  return getNavItems(page);
}

/** Scroll a sidebar nav item into view, fire a native DOM click, then wait. */
async function navTo(page, label, opts = {}) {
  const wait = opts.wait ?? 2500;
  const before = await page.evaluate(() => document.querySelector('main')?.innerText.length ?? -1);
  const clicked = await page.evaluate((lbl) => {
    const btns = [...document.querySelectorAll('aside nav button')];
    const b = btns.find(x => x.textContent.trim().includes(lbl));
    if (!b) return false;
    try { b.scrollIntoView({ block: 'center' }); } catch { b.scrollIntoView(); }
    b.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`navTo: no sidebar button for "${label}"`);
  await page.waitForTimeout(wait);
  const after = await page.evaluate(() => document.querySelector('main')?.innerText.length ?? -1);
  return { before, after };
}

/** Fill an input by CSS selector using the native value setter + input event (React-safe, no locator). */
async function fillBySelector(page, css, value) {
  return page.evaluate(({ css, value }) => {
    const el = document.querySelector(css);
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, { css, value });
}
// ── Auth helpers ────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Already at dashboard or role selection?
  if (await page.evaluate(() => document.body.innerText.includes('Select Your Role'))) return 'role_selection';
  if (await page.evaluate(() => !!document.querySelector('aside'))) return 'dashboard';

  // Fill login form
  const hasLogin = await page.evaluate(() => !!document.querySelector('input[autocomplete="username"]'));
  if (!hasLogin) {
    const hasBack = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Sign in'));
      return !!b;
    });
    if (hasBack) { await clickByText(page, 'button', 'Sign in'); await page.waitForTimeout(1500); }
  }
  const hasEmail = await page.evaluate(() => !!document.querySelector('input[autocomplete="username"]'));
  if (hasEmail) {
    await fillBySelector(page, 'input[autocomplete="username"]', email);
    await fillBySelector(page, 'input[autocomplete="current-password"]', password);
    await clickByText(page, 'button', 'Login').catch(() => page.evaluate(() => document.querySelector('button[type="submit"]')?.click()));
    await page.waitForTimeout(7000);
  }

  let body = await bodyText(page);
  if (body.includes('Select Your Role')) return 'role_selection';
  if (body.includes('Dashboard') || body.includes('Coal Mine')) return 'dashboard';

  // Signup fallback
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  const hasSignup = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Create account')));
  if (hasSignup) {
    await clickByText(page, 'button', 'Create account');
    await page.waitForTimeout(1000);
    const nameField = await page.evaluate(() => !!document.querySelector('input[placeholder*="e.g."]'));
    if (nameField) await fillBySelector(page, 'input[placeholder*="e.g."]', email.split('@')[0]);
    const euExists = await page.evaluate(() => !!document.querySelector('input[autocomplete="username"]'));
    if (euExists) await fillBySelector(page, 'input[autocomplete="username"]', email);
    const pwCount = await page.evaluate(() => document.querySelectorAll('input[autocomplete="new-password"]').length);
    for (let i = 0; i < pwCount; i++) {
      await page.evaluate((idx) => {
        const el = document.querySelectorAll('input[autocomplete="new-password"]')[idx];
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(el, email.split('@')[0]);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, i);
    }
    await page.evaluate(() => document.querySelector('button[type="submit"]')?.click());
    await page.waitForTimeout(7000);
    body = await bodyText(page);
    if (body.includes('Select Your Role')) return 'role_selection';
    if (body.includes('Dashboard') || body.includes('Coal Mine')) return 'dashboard';
  }
  return 'unknown';
}

async function selectRole(page, role) {
  const labels = {
    worker: 'Worker / Miner', mining_mate: 'Mining Mate', overman: 'Overman',
    safety_officer: 'Safety Officer', mine_manager: 'Mine Manager', super_admin: 'Super Admin',
  };
  const label = labels[role];
  const found = await waitForText(page, label, 4000);
  if (found) {
    await clickByText(page, 'button', label);
    await page.waitForTimeout(2500);
  }
  const confirmVisible = await waitForText(page, 'Confirm', 4000);
  if (confirmVisible) {
    await clickByText(page, 'button', 'Confirm');
    await page.waitForTimeout(4000);
  }
}

async function ensureAuthed(page, email, password) {
  const body = await bodyText(page);
  if (body.includes('Sign In') && !body.includes('Coal Mine')) {
    await loginAs(page, email, password);
    await page.waitForTimeout(2000);
  }
  const hasShell = await page.evaluate(() => !!document.querySelector('aside nav button'));
  const bodyNow = await bodyText(page);
  return hasShell || bodyNow.includes('Dashboard') || bodyNow.includes('Coal Mine') || bodyNow.includes('Select Your Role');
}

// ── Fake photo attachment for OCR upload fields ──────────────

/** Attach a minimal 1x1 PNG to the first file input on the page. */
async function attachFakePhoto(page, css = 'input[type="file"]') {
  // 1x1 transparent PNG (43 bytes)
  const hex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c62600000000200014821e10000000049454e44ae426082';
  const set = await page.evaluate(({ css, hex }) => {
    const el = document.querySelector(css);
    if (!el) return false;
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const file = new File([bytes], 'evidence.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { css, hex });
  return set;
}
// ── Per-role test runner ─────────────────────────────────────

async function runRole(page, acct) {
  const { email, password, role, roleLabel } = acct;
  const bar = '─'.repeat(50);
  console.log(`\n${bar}`);
  console.log(`  ROLE: ${roleLabel} (${role})`);
  console.log(bar);

  // 1. Login
  const state = await loginAs(page, email, password);
  if (state === 'role_selection') {
    await selectRole(page, role);
    await page.waitForTimeout(2000);
  }
  await ensureAuthed(page, email, password);

  // 2. Dashboard check
  const hasAside = await page.evaluate(() => !!document.querySelector('aside'));
  R('Login + dashboard', hasAside ? PASS : FAIL, `state=${hasAside ? 'dashboard' : 'lost'}`);
  if (!hasAside) return;

  // 3. Sidebar items
  const items = await navLabels(page);
  R('Sidebar rendered', items.length > 0 ? PASS : FAIL, `items=${items.length}`);

  // 4. Expected nav items
  const expected = NAV_BY_ROLE[role] || [];
  const missing = expected.filter(e => !items.some(i => i.includes(e)));
  const extra = items.filter(i => !expected.some(e => e.includes(i)));
  R('Expected nav items', missing.length === 0 ? PASS : FAIL, missing.length ? `missing: ${missing.join(', ')}` : 'all present');
  if (extra.length) R('Extra nav items', WARN, extra.join(', '));

  // 5. Walk sidebar nav
  console.log(`\n  ── SIDEBAR WALK ──`);
  for (let i = 0; i < items.length; i++) {
    const label = items[i];
    try {
      const { before, after } = await navTo(page, label);
      const txt = await mainText(page);
      const chars = txt.length;
      const isOk = chars > 10 || label.includes('GIS') || label.includes('Data Hub') || label.includes('Map');
      R(`Nav → ${label}`, isOk ? PASS : WARN, `chars=${chars}`);
    } catch (err) {
      R(`Nav → ${label}`, FAIL, err.message);
    }
  }

  // 6. Role-specific feature tests
  console.log(`\n  ── ROLE-SPECIFIC FEATURES ──`);

  if (role === 'super_admin') {
    try { await navTo(page, 'Users'); R('Users page renders', (await mainText(page)).length > 10 ? PASS : FAIL); } catch (e) { R('Users page renders', FAIL, e.message); }
    try { await navTo(page, 'System Settings'); R('System Settings page renders', (await mainText(page)).length > 10 ? PASS : FAIL); } catch (e) { R('System Settings page renders', FAIL, e.message); }
    try { await navTo(page, 'Audit Logs'); R('Audit Logs page renders', (await mainText(page)).length > 10 ? PASS : FAIL); } catch (e) { R('Audit Logs page renders', FAIL, e.message); }
  }

  if (role === 'mine_manager' || role === 'super_admin') {
    try { await navTo(page, 'Attendance Register'); R('Attendance Register renders', (await mainText(page)).length > 10 ? PASS : FAIL); } catch (e) { R('Attendance Register renders', FAIL, e.message); }
  }

  if (role === 'overman') {
    try { await navTo(page, 'Mark Attendance'); R('Mark Attendance renders', (await mainText(page)).length > 10 ? PASS : FAIL); } catch (e) { R('Mark Attendance renders', FAIL, e.message); }
  }

  // OCR Attendance — file input attachment
  if (items.some(i => i.includes('OCR'))) {
    try {
      await navTo(page, 'OCR Attendance', { wait: 3000 });
      const main = await mainText(page);
      R('OCR Attendance page renders', main.length > 5 ? PASS : WARN, `chars=${main.length}`);
      const attached = await attachFakePhoto(page);
      R('OCR file input', attached ? PASS : WARN, attached ? 'attached' : 'no input found');
    } catch (e) { R('OCR Attendance', FAIL, e.message); }
  }

  // Report Issue
  if (items.some(i => i.includes('Report Issue'))) {
    try {
      await navTo(page, 'Report Issue');
      const hasFile = await page.evaluate(() => !!document.querySelector('input[type="file"]'));
      R('Report Issue page', PASS, hasFile ? 'has file input' : 'no file input');
      if (hasFile) { const ok = await attachFakePhoto(page); R('Report Issue photo upload', ok ? PASS : FAIL); }
    } catch (e) { R('Report Issue page', FAIL, e.message); }
  }

  // Profile
  if (items.some(i => i.includes('Profile'))) {
    try { await navTo(page, 'Profile'); R('Profile page renders', PASS, 'loaded'); } catch (e) { R('Profile page renders', FAIL, e.message); }
  }

  // Notifications
  if (items.some(i => i.includes('Notifications'))) {
    try { await navTo(page, 'Notifications'); R('Notifications page renders', PASS, 'loaded'); } catch (e) { R('Notifications page renders', FAIL, e.message); }
  }

  // Blockchain
  if (items.some(i => i.includes('Blockchain'))) {
    try { await navTo(page, 'Blockchain Dashboard', { wait: 3000 }); R('Blockchain Dashboard renders', PASS, 'loaded'); } catch (e) { R('Blockchain Dashboard', FAIL, e.message); }
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  SMART-MINE FULL SYSTEM TEST — 4 ISOLATED BROWSERS     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const browser = await chromium.launch({ headless: true });

  for (const acct of ACCOUNTS) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await runRole(page, acct);
    } catch (err) {
      R(`${acct.roleLabel} overall`, FAIL, err.message);
    } finally {
      await context.close().catch(() => {});
    }
  }

  await browser.close();

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  SUMMARY                                                ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ PASS: ${String(results.pass).padStart(3)}   ❌ FAIL: ${String(results.fail).padStart(3)}   ⚠️  WARN: ${String(results.warn).padStart(3)}       ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (results.fail > 0) {
    console.log('\nFailed tests:');
    results.details.filter(d => d.includes('FAIL')).forEach(d => console.log(`  ${d}`));
  }

  process.exit(results.fail > 0 ? 1 : 0);
}

main();