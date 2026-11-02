// Phone checks (390x844 @3x, touch): label clipping, pinch zoom, zoom buttons. Run after `npm run build && npm run preview`.
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto((process.env.BASE||'http://localhost:4173/')+'?introSpeed=40', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Skip intro' }).tap().catch(() => {});
  await p.waitForTimeout(4000);
  const clipped = await p.evaluate(() => [...document.querySelectorAll('.tlabel')].filter(e => e.style.visibility === 'visible').map(e => e.lastElementChild.getBoundingClientRect()).filter(r => r.left < 0 || r.right > innerWidth).length);
  console.log(await p.evaluate(() => [...document.querySelectorAll('.tlabel')].filter(e => e.style.visibility === 'visible').map(e => { const r = e.lastElementChild.getBoundingClientRect(); return [e.innerText.split('\n')[0], e.className, Math.round(r.left), Math.round(r.right), e.style.opacity, e.style.transform]; }).filter(a => a[2] < 0 || a[3] > innerWidth)));
  console.log((clipped === 0 ? 'PASS' : 'FAIL') + ' labels inside screen (' + clipped + ' clipped)');
  await p.screenshot({ path: (process.env.OUT||'docs/screenshots/')+'m-full.png', timeout: 180000 });
  const view = () => p.evaluate(() => { const { camera, controls } = window.__view; return camera.position.distanceTo(controls.target); });
  const cdp = await ctx.newCDPSession(p);
  if (process.env.ONLY_LABELS) { await b.close(); return; }
  const pinch = async (from, to) => {
    const c = { x: 195, y: 620 };
    const pts = (d) => [{ x: c.x - d, y: c.y, id: 1 }, { x: c.x + d, y: c.y, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + (to - from) * i / 12) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(4000);
  };
  const d0 = await view();
  await pinch(40, 140); const d1 = await view();
  ok(d1 < d0 * 0.8, `pinch out zooms in ${d0.toFixed(2)} -> ${d1.toFixed(2)}`);
  await pinch(140, 40); const d2 = await view();
  ok(d2 > d1 * 1.3, `pinch in zooms out ${d1.toFixed(2)} -> ${d2.toFixed(2)}`);
  const zin = p.getByRole('button', { name: 'Zoom in' });
  if (await zin.count()) {
    const a = await view(); await zin.tap(); await zin.tap(); await p.waitForTimeout(4000); const z = await view();
    ok(z < a * 0.85, `zoom-in button ${a.toFixed(2)} -> ${z.toFixed(2)}`);
    await p.getByRole('button', { name: 'Zoom out' }).tap(); await p.waitForTimeout(4000);
    ok(await view() > z, 'zoom-out button');
  } else ok(false, 'no zoom buttons');
  await p.screenshot({ path: (process.env.OUT||'docs/screenshots/')+'m-zoomed.png', timeout: 180000 });
  console.log('detail open?', await p.locator('.detail').count()); console.log('errors', errs);
  await b.close();
})();
