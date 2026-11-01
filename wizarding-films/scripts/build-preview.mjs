// Static, server-less build of the 3D experience into preview-dist/ (relative
// paths only), e.g. for hosting as a single-folder preview.
// Usage: npm run geo && npm run benchmarks && node scripts/build-preview.mjs
import { build } from 'esbuild';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'preview-dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, 'preview/main.tsx')],
  bundle: true, splitting: true, format: 'esm', minify: true, target: 'es2020',
  outdir: join(out, 'js'), entryNames: '[name]', chunkNames: 'c-[hash]',
  jsx: 'automatic', alias: { '@': root }, loader: { '.json': 'json' },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_ASSET_BASE': '"./"', 'process.env.NEXT_PUBLIC_GZ_SUFFIX': '".gz.b64.txt"', 'process.env.NEXT_PUBLIC_GEO_VERSION': `"${Date.now().toString(36)}"` },
  logLevel: 'warning',
});

// geometry: only the gzipped files (the loader inflates them with DecompressionStream)
const geo = join(root, 'public/geo');
for (const d of readdirSync(geo)) {
  if (!statSync(join(geo, d)).isDirectory() || d === 'hub') continue;
  for (const f of readdirSync(join(geo, d))) if (f.endsWith('.gz')) { mkdirSync(join(out, 'geo', d), { recursive: true }); writeFileSync(join(out, 'geo', d, f + '.b64.txt'), readFileSync(join(geo, d, f)).toString('base64')); } // hosts that only serve text types
}
cpSync(join(root, 'public/benchmarks'), join(out, 'benchmarks'), { recursive: true });

const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
writeFileSync(join(out, 'index.html'), `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Wizarding Films: A Cinematic Journey</title>
<meta name="description" content="An unofficial fan tribute: eight original, stylised 3D scenes inspired by the eight Harry Potter films.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap">
<style>:root{--font-display:'Cormorant Garamond';--font-ui:'Inter'}
${css}</style>
</head>
<body>
<h1 class="sr-only">The Wizarding Films: an unofficial cinematic fan tribute to the eight Harry Potter films</h1>
<div id="root"></div>
<script type="module" src="js/main.js"></script>
</body>
</html>
`);
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(out);
const total = files.reduce((a, f) => a + statSync(f).size, 0);
console.log(`preview-dist: ${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MB`);
