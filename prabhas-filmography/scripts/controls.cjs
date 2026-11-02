// Zoom, 360° rotation and label checks. Run after `npm run build && npm run preview`.
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto((process.env.BASE || 'http://localhost:4173/') + '', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Skip intro' }).click();
  await p.getByRole('button', { name: 'Settings' }).click();
  await p.locator('label.check input').uncheck(); // stop auto-rotate so measurements are clean
  await p.getByRole('button', { name: 'Close settings' }).click();
  await p.waitForTimeout(1500);
  const view = () => p.evaluate(() => { const { camera, controls } = window.__view; return { d: camera.position.distanceTo(controls.target), az: controls.getAzimuthalAngle() }; });
  const v0 = await view();
  await p.mouse.move(900, 600);
  for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(80); }
  await p.waitForTimeout(1500);
  const v1 = await view();
  ok(v1.d < v0.d * 0.75, `scroll up zooms in: ${v0.d.toFixed(2)} -> ${v1.d.toFixed(2)}`);
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(80); }
  await p.waitForTimeout(1500);
  const v2 = await view();
  ok(v2.d > v1.d * 1.5, `scroll down zooms out: ${v1.d.toFixed(2)} -> ${v2.d.toFixed(2)}`);
  // hold and drag right across the screen several times: azimuth wraps all the way round
  let total = 0, prev = v2.az;
  for (let k = 0; k < 4; k++) {
    await p.mouse.move(1000, 700); await p.mouse.down();
    for (let x = 1000; x >= 200; x -= 40) { await p.mouse.move(x, 700); }
    await p.mouse.up(); await p.waitForTimeout(1200);
    const v = await view(); let d = v.az - prev; if (d > Math.PI) d -= 2*Math.PI; if (d < -Math.PI) d += 2*Math.PI; total += Math.abs(d); prev = v.az;
  }
  ok(total > 2 * Math.PI, `hold-and-drag rotated ${(total * 180 / Math.PI).toFixed(0)}° in 4 drags`);
  const labels = await p.locator('.tlabel').evaluateAll(els => els.map(e => e.innerText.replace(/\n/g, ' | ')));
  const eeswar = labels.find(t => t.startsWith('EESWAR') || t.toLowerCase().startsWith('eeswar'));
  console.log('  label:', eeswar, '|', labels.find(t => /kannappa/i.test(t)));
  ok(/eeswar 2002/i.test(eeswar), 'year beside title');
  ok(!labels.some(t => /\bRELEASED\b/i.test(t)), 'no "Released" in labels');
  await p.getByRole('button', { name: 'Films', exact: true }).click();
  const rows = await p.locator('.filmrow').allInnerTexts();
  ok(!rows.some(r => /Released/i.test(r)), 'no "Released" in list');
  await p.screenshot({ path: (process.env.OUT || 'docs/screenshots/') + 'labels.png', timeout: 120000 });
  await b.close();
})();
