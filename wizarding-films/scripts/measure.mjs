// Measures the performance budget against a running production server
// (npm run build && npm start). Usage: node scripts/measure.mjs [baseUrl]
//  - initial JS (compressed bytes actually transferred for /)
//  - per-scene geometry transferred, triangles, draw calls
//  - time until the scene is interactive (loader gone) on emulated 4G + 4x CPU slowdown
// Frame rate here comes from whatever GPU the machine has. In headless CI that's
// SwiftShader (a CPU rasteriser), so fps must be measured on real devices: open
// the site with ?debug and read the overlay.
import { createRequire } from 'node:module';
// Resolved via require so a globally installed Playwright also works (npm i -D playwright otherwise).
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3000';
const NETS = { 'decent 4G (9 Mbps, 70 ms)': { latency: 70, down: 9e6 / 8, up: 1.5e6 / 8 }, 'slow 4G (1.6 Mbps, 150 ms)': { latency: 150, down: 1.6e6 / 8, up: 0.75e6 / 8 } };
const SCENES = ['hub', ...Array.from({ length: 8 }, (_, i) => `film-${i + 1}`)];
const kb = (b) => (b / 1024).toFixed(1);

const manifest = JSON.parse((await import('node:fs')).readFileSync(new URL('../public/geo/manifest.json', import.meta.url)));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function run(path, net, tier = 'low', mobile = true) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (net) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const bytes = { js: 0, css: 0, font: 0, geo: 0, other: 0, jsInitial: 0 };
  let interactive = false;
  const startedBefore = new Set();
  page.on('request', (req) => { if (!interactive) startedBefore.add(req); });
  page.on('requestfinished', async (req) => {
    if (!startedBefore.has(req)) return; // ignore the next-scene prefetch that starts after load
    const s = await req.sizes().catch(() => null); if (!s) return;
    const b = s.responseBodySize + s.responseHeadersSize, u = req.url();
    const k = /\/geo\//.test(u) ? 'geo' : /\.js(\?|$)/.test(u) ? 'js' : /\.css/.test(u) ? 'css' : /woff2?/.test(u) ? 'font' : 'other';
    bytes[k] += b; if (k === 'js') bytes.jsInitial += b;
  });
  const t0 = Date.now();
  await page.goto(base + path + (path.includes('?') ? '&' : '?') + `quality=${tier}&debug&nointro`, { waitUntil: 'commit' });
  await page.waitForSelector('.loader.done', { state: 'attached', timeout: 120000 });
  const tti = Date.now() - t0; interactive = true;
  await page.waitForFunction(() => /tris [1-9]/.test(document.querySelector('.stats')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  const stats = await page.evaluate(() => document.querySelector('.stats')?.textContent || '');
  // Exact geometry files this scene's builder loaded (prefetches excluded), sized from the build manifest.
  const files = await page.evaluate(() => (window).__engine?.current?.builder.files ?? []);
  const geoGz = files.reduce((a, f) => { const k = f.replace(/\.(bin|plc)$/, ''); const e = manifest.meshes[k] ?? manifest.placements[k]; return a + (e ? e.gz : 0); }, 0);
  await ctx.close();
  const num = (re) => +(stats.match(re)?.[1] ?? '0').replace(/,/g, '');
  return { tti, bytes, geoGz, files: files.length, tris: num(/tris ([\d,]+)/), calls: num(/calls (\d+)/), fps: num(/fps (\d+)/) };
}

const lines = [`# Measurements (${new Date().toISOString().slice(0, 10)})`, '', `Server: ${base}. Mobile emulation: 412×915 @2.6x, 4× CPU slowdown. GPU: SwiftShader (software), so fps figures here are NOT representative.`, ''];
// 1) Initial JS on the landing page (no throttling needed for byte counts)
const home = await run('/?scene=hub', null, 'low', true);
// Shell = the scripts referenced by the HTML itself (React, Next runtime, UI, store).
// The engine + three.js chunk is a dynamic import fetched while the loader animates.
const html = await (await fetch(base + '/')).text();
let shell = 0;
for (const src of new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))) {
  const r = await fetch(new URL(src, base), { headers: { 'accept-encoding': 'gzip' } });
  shell += (await r.arrayBuffer()).byteLength; // fetch() decodes: re-gzip for the transferred size
}
const { gzipSync } = await import('node:zlib');
let shellGz = 0;
for (const src of new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))) shellGz += gzipSync(Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer()), { level: 9 }).length;
lines.push('## Initial load', '', `| Asset | Transferred |`, `|---|---|`, `| Initial JS: app shell referenced by the HTML (gzip) | ${kb(shellGz)} KB (${kb(shell)} KB raw) |`, `| All JS before the first scene is interactive (shell + lazy engine/three.js chunk) | ${kb(home.bytes.jsInitial)} KB |`, `| CSS | ${kb(home.bytes.css)} KB |`, `| Fonts | ${kb(home.bytes.font)} KB |`, `| Hub geometry (low tier, gzip) | ${kb(home.geoGz)} KB |`, '');
// 2) Each scene, both tiers
lines.push('## Per scene', '', '| Scene | Geometry (low tier) | Geometry (high tier) | Triangles low / high | Draw calls high |', '|---|---|---|---|---|');
for (const s of SCENES) {
  const p = s === 'hub' ? '/?scene=hub' : `/?scene=${s}`;
  const lo = await run(p, null, 'low', true), hi = await run(p, null, 'high', false);
  lines.push(`| ${s} | ${kb(lo.geoGz)} KB (${lo.files} files) | ${kb(hi.geoGz)} KB (${hi.files} files) | ${lo.tris.toLocaleString()} / ${hi.tris.toLocaleString()} | ${hi.calls} |`);
  console.log(s, 'done');
}
// 3) Time to interactive on 4G for the landing page and the Film 1 deep link
lines.push('', '## Time to interactive (loader dismissed), mobile, low tier', '', '| Network | Hub (landing) | Film 1 deep link |', '|---|---|---|');
for (const [name, net] of Object.entries(NETS)) {
  const a = await run('/?scene=hub', net), b = await run('/?scene=film-1', net);
  lines.push(`| ${name} | ${(a.tti / 1000).toFixed(2)} s | ${(b.tti / 1000).toFixed(2)} s |`);
  console.log(name, 'done');
}
await browser.close();
mkdirSync('measurements', { recursive: true });
writeFileSync('measurements/latest.md', lines.join('\n') + '\n');
console.log(lines.join('\n'));
