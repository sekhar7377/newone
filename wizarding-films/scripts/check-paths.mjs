// Authoring aid: samples each scene's camera spline and reports the lowest
// clearance above terrain, and checks hotspots aren't buried.
// Usage: node scripts/check-paths.mjs [scene-id]
import { readFileSync } from 'node:fs';
import { groundsHeight, countrysideHeight, winterHeight } from './geo/layout.mjs';

const HEIGHT = { 'film-2': countrysideHeight, 'film-7': winterHeight, 'film-5': () => 0 };
const ids = process.argv[2] ? [process.argv[2]] : ['hub', ...Array.from({ length: 8 }, (_, i) => `film-${i + 1}`)];

function catmull(pts, t) { // uniform closed Catmull-Rom, good enough for a check
  const n = pts.length, f = t * n, i = Math.floor(f), u = f - i;
  const p = (k) => pts[((i + k) % n + n) % n];
  const [a, b, c, d] = [p(-1), p(0), p(1), p(2)];
  return [0, 1, 2].map((k) => 0.5 * (2 * b[k] + (-a[k] + c[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u * u + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * u * u * u));
}
for (const id of ids) {
  const c = JSON.parse(readFileSync(new URL(`../content/scenes/${id}.json`, import.meta.url)));
  const H = HEIGHT[id] ?? groundsHeight;
  if (c.path.points.length < 4) { console.log(id.padEnd(8), 'no path'); continue; }
  let min = Infinity, at = 0, len = 0, prev = null;
  for (let k = 0; k < 800; k++) {
    const q = catmull(c.path.points, k / 800);
    const cl = q[1] - Math.max(H(q[0], q[2]), id === 'film-5' ? 0 : -0.5);
    if (cl < min) { min = cl; at = k / 800; }
    if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); prev = q;
  }
  const bad = c.hotspots.filter((h) => h.position && h.position[1] < H(h.position[0], h.position[2]) + 0.5).map((h) => h.id);
  console.log(id.padEnd(8), `length ${len.toFixed(0)} m`, `min clearance ${min.toFixed(1)} m at t=${at.toFixed(3)}`, catmull(c.path.points, at).map((v) => v.toFixed(0)).join(','), `hotspots ${c.hotspots.length}`, bad.length ? `BURIED: ${bad}` : '');
}
