import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const results = [];
function R(t,s,d='') { results.push({t,s,d}); console.log((s==='PASS'?'OK':s==='WARN'?'!!':'XX')+' '+t+(d?' -- '+d:'')); }
const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:1440,height:900}});
const page = await ctx.newPage();
const errs=[], perrs=[], frets=[];
page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
page.on('pageerror',e=>perrs.push(e.message));
page.on('requestfailed',r=>{ if(!r.url().includes('fonts')&&!r.url().includes('firebase')) frets.push(r.url()); });

// 1. Login page
console.log('\n== 1. LOGIN ==');
await page.goto(BASE+'/',{timeout:30000,waitUntil:'domcontentloaded'}); await page.waitForTimeout(3000);
R('Login page renders', (await page.locator('body').innerText()).includes('Sign In')?'PASS':'FAIL');

// Direct URL access
for(const u of ['/dashboard','/reports']){
  await page.goto(BASE+u,{timeout:30000,waitUntil:'domcontentloaded'}); await page.waitForTimeout(2000);
  const b=await page.locator('body').innerText();
  R('Direct URL '+u, b.includes('Sign In')?'PASS':'FAIL', 'url='+page.url());
}

// Bad login
await page.goto(BASE+'/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1000);
await page.locator('input[autocomplete="username"]').fill('bad@x.com');
await page.locator('input[autocomplete="current-password"]').fill('wrong');
await page.getByRole('button',{name:/Login/}).click(); await page.waitForTimeout(4000);
const errText=(await page.locator('body').innerText());
R('Bad login error', /error|invalid|wrong|not found|no user/i.test(errText)?'PASS':'FAIL', errText.slice(0,120));

// 2. Signup
console.log('\n== 2. SIGNUP ==');
await page.goto(BASE+'/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2000);
const ca=page.getByText('Create an account');
if(await ca.isVisible().catch(()=>false)) await ca.click();
await page.waitForTimeout(1000);
const nm='Test'+Date.now().toString().slice(-6);
const em='test'+Date.now().toString().slice(-8)+'@smartmine.dev';
const pw='Test@12345';
await page.locator('input[placeholder*="e.g."]').first().fill(nm);
const ei=page.locator('input[type="email"]'); if(await ei.count()) await ei.first().fill(em);
const pi=page.locator('input[type="password"]');
if(await pi.count()>=2){await pi.nth(0).fill(pw);await pi.nth(1).fill(pw);}
await page.waitForTimeout(500);
await page.locator('button[type="submit"]').last().click();
await page.waitForTimeout(8000);
R('Signup submitted', 'PASS', em);

const roleVisible = (await page.locator('body').innerText()).toLowerCase().includes('your role');
R('Role selection screen', roleVisible?'PASS':'WARN');
if(roleVisible){
  const sc=page.getByText(/Super Admin/i).first();
  if(await sc.isVisible().catch(()=>false)) await sc.click();
  await page.waitForTimeout(8000);
  R('Selected super_admin', 'PASS');
}
await page.waitForTimeout(4000);

const authed=(await page.locator('body').innerText()).toLowerCase().includes('dashboard') || (await page.locator('body').innerText()).toLowerCase().includes('safety');
R('Reached app shell', authed?'PASS':'FAIL');

// 3. Sidebar walk
console.log('\n== 3. PAGE WALK ==');
const links=page.locator('aside nav button');
const lc=await links.count();
const seen=[];
const refreshFailed=[];
for(let i=0;i<lc&&i<30;i++){
  const txt=(await links.nth(i).innerText().catch(()=>'')).trim();
  if(!txt||txt.length<2||txt.length>60||seen.includes(txt)) continue;
  seen.push(txt);
  await links.nth(i).scrollIntoViewIfNeeded().catch(()=>{});
  await links.nth(i).click().catch(()=>{});
  await page.waitForTimeout(2500);
  const main=(await page.locator('main').first().innerText().catch(()=>'')).trim();
  const blank=main.length<5;
  R('Nav: '+txt, blank?'FAIL':'PASS', 'chars='+main.length);
  // refresh
  await page.reload({waitUntil:'domcontentloaded'}).catch(()=>{});
  await page.waitForTimeout(3000);
  const rb=(await page.locator('body').innerText().catch(()=>''));
  const lost=rb.includes('Sign In')&&!rb.includes('Dashboard');
  if(lost) refreshFailed.push(txt);
  R('Refresh: '+txt, lost?'FAIL':'PASS', lost?'to login':'ok');
}

// 4. Logout/login
console.log('\n== 4. LOGOUT/LOGIN ==');
const lob=page.locator('button:has-text("Logout"),button:has-text("Sign Out")').first();
if(await lob.isVisible().catch(()=>false)){
  await lob.click(); await page.waitForTimeout(3000);
  R('Logout', (await page.locator('body').innerText()).includes('Sign In')?'PASS':'FAIL');
  // Re-login
  await page.locator('input[autocomplete="username"]').fill(em);
  await page.locator('input[autocomplete="current-password"]').fill(pw);
  await page.getByRole('button',{name:/Login/}).click(); await page.waitForTimeout(5000);
  R('Re-login', (await page.locator('body').innerText()).toLowerCase().includes('dashboard')?'PASS':'FAIL');
}

// Summary
console.log('\n== SUMMARY ==');
const fail=results.filter(r=>r.s==='FAIL').length;
const warn=results.filter(r=>r.s==='WARN').length;
const pass=results.filter(r=>r.s==='PASS').length;
console.log('PASS:'+pass+' WARN:'+warn+' FAIL:'+fail);
if(refreshFailed.length) console.log('REFRESH FAILURES:', refreshFailed.join(', '));
console.log('Page errors:', perrs.length?perrs.slice(0,10):'none');
console.log('Console errors:', errs.length?errs.slice(0,10).map(s=>s.slice(0,150)):'none');
console.log('Failed requests:', frets.length?frets:'none');
await browser.close();
process.exit(fail>0?1:0);
