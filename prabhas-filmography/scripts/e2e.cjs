// Browser walkthrough. Run `npm run build && npm run preview`, then `node scripts/e2e.cjs`.
// Needs Playwright with Chromium available (npm i -D playwright && npx playwright install chromium).
const { chromium } = require('playwright');
const OUT = process.env.OUT || 'docs/screenshots/';
const BASE = process.env.BASE || 'http://localhost:4173/';
const args = ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch({ args });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Skip intro' }).click();
  await p.waitForTimeout(2500);
  ok(await p.getByRole('button', { name: 'Replay intro' }).isVisible(), 'skip intro -> replay button');
  const summary = await p.locator('.title p').first().textContent();
  console.log('  summary:', summary);
  await p.screenshot({ path: OUT + 'full.png', timeout: 120000 });

  await p.getByRole('button', { name: 'Films', exact: true }).click();
  const search = p.getByRole('searchbox', { name: 'Search films' });
  for (const [q, expect] of [['bahubali', 'Baahubali'], ['Fauji', 'Fauzi'], ['chhatrapati', 'Chatrapathi'], ['eeshwar', 'Eeswar'], ['rajamouli', 'Chatrapathi'], ['bhairava', 'Kalki'], ['raja saab', 'RajaSaab'], ['salar', 'Salaar']]) {
    await search.fill(q);
    const rows = await p.locator('.filmrow .ti').allTextContents();
    ok(rows.some(r => r.includes(expect)), `search "${q}" finds ${expect} (${rows.length} rows)`);
  }
  await search.fill('zzzz');
  ok(await p.getByText('No films match these filters.').isVisible(), 'empty state');
  await p.locator('.empty button').click();
  ok((await p.locator('.filmrow').count()) === 33, 'clear filters restores 33');

  await p.getByRole('group', { name: 'Release' }).getByRole('button', { name: 'Upcoming' }).click();
  let n = await p.locator('.filmrow').count();
  ok(n === 4, `upcoming filter = ${n}`);
  ok(p.url().includes('release=upcoming'), 'filter in URL: ' + p.url());
  await p.getByRole('button', { name: /^Cameo/ }).click();
  ok(await p.getByText('No films match these filters.').isVisible(), 'upcoming+cameo -> empty');
  await p.getByRole('button', { name: 'Clear filters' }).first().click();
  await p.getByRole('button', { name: /^Voice credit/ }).click();
  n = await p.locator('.filmrow').count(); ok(n === 2, `voice filter = ${n}`);
  await p.getByRole('button', { name: /^Recut/ }).click();
  n = await p.locator('.filmrow').count(); ok(n === 3, `voice+recut = ${n}`);
  await p.screenshot({ path: OUT + 'filtered.png', timeout: 120000 });
  await p.getByRole('button', { name: 'Clear filters' }).first().click();

  await p.locator('.filmrow', { hasText: 'Baahubali: The Beginning' }).click();
  await p.waitForTimeout(2200);
  ok(p.url().includes('film=baahubali-the-beginning'), 'selection in URL');
  ok(await p.getByRole('heading', { name: 'Baahubali: The Beginning' }).isVisible(), 'detail heading');
  await p.screenshot({ path: OUT + 'selected.png', timeout: 120000 });
  await p.getByRole('button', { name: /Next: / }).click();
  ok(p.url().includes('film=baahubali-2'), 'next -> baahubali-2');
  await p.goBack();
  await p.waitForTimeout(300);
  ok(p.url().includes('film=baahubali-the-beginning') && await p.getByRole('heading', { name: 'Baahubali: The Beginning' }).isVisible(), 'back restores previous film');
  await p.goBack();
  await p.waitForTimeout(300);
  ok((await p.locator('.detail').count()) === 0, 'back again closes detail');
  await p.goForward();
  await p.waitForTimeout(300);
  ok(await p.locator('.detail').count() === 1, 'forward reopens');
  ok((await p.locator('.panel.films').count()) === 0, 'films panel closed while detail open');
  await p.keyboard.press('Escape');
  ok((await p.locator('.detail').count()) === 0, 'escape closes detail');

  // click on canvas strand: pick a visible label position
  await p.waitForTimeout(1600);
  const pos = await p.evaluate(() => {
    const els = [...document.querySelectorAll('.tlabel')].filter(e => e.style.visibility === 'visible' && +e.style.opacity > 0.5);
    const e = els[0]; if (!e) return null;
    const m = /translate3d\(([\d.]+)px, ([\d.]+)px/.exec(e.style.transform);
    return { x: +m[1], y: +m[2], title: e.querySelector('.tlabel-ti').textContent };
  });
  if (pos) {
    await p.mouse.click(pos.x, pos.y);
    await p.waitForTimeout(400);
    const h = await p.locator('#detail-title').textContent().catch(() => null);
    ok(!!h, `click strand tip "${pos.title}" opened "${h}"`);
  } else ok(false, 'no visible label to click');
  console.log('errors:', errs.slice(0, 5));

  await p.close();
  // deep link
  const d = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await d.goto(BASE + '?film=spirit', { waitUntil: 'networkidle' });
  await d.waitForTimeout(2500);
  ok(await d.getByRole('heading', { name: 'Spirit' }).isVisible(), 'deep link ?film=spirit');
  const txt = await d.locator('.detail').textContent();
  ok(txt.includes('29 Oct 2027 (announced)') && txt.includes('Not revealed'), 'spirit date + unknown character');
  await d.screenshot({ path: OUT + 'deeplink.png', timeout: 120000 });
  const bad = await b.newPage(); await bad.goto(BASE + '?film=nope&release=bogus', { waitUntil: 'networkidle' });
  ok((await bad.locator('.detail').count()) === 0, 'invalid deep link ignored');
  await bad.close(); await d.close();

  // mobile + touch
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const m = await ctx.newPage();
  await m.goto(BASE + '?introSpeed=40', { waitUntil: 'networkidle' });
  await m.waitForTimeout(3500);
  await m.screenshot({ path: OUT + 'mobile.png', timeout: 120000 });
  await m.getByRole('button', { name: 'Films', exact: true }).tap();
  await m.locator('.filmrow', { hasText: 'Salaar: Part 2' }).tap();
  await m.waitForTimeout(1800);
  await m.screenshot({ path: OUT + 'mobile-detail.png', timeout: 120000 });
  const box = await m.locator('.detail').boundingBox();
  ok(box && box.x >= 0 && box.x + box.width <= 390, 'mobile detail fits width');
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, 'no horizontal scroll ' + sw);

  await ctx.close();
  // reduced motion
  const rm = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const r = await rm.newPage();
  await r.goto(BASE, { waitUntil: 'networkidle' });
  await r.waitForTimeout(1500);
  ok(await r.getByRole('button', { name: 'Replay intro' }).isVisible(), 'reduced motion skips intro');
  await b.close();
})();
