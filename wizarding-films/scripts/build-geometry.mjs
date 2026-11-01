// Builds every silhouette mesh (SIL1) and instance placement file (PLC1)
// into public/geo. This stands in for the Blender export step
// (tools/blender/export_silhouette.py writes the same formats) so the repo
// builds with no DCC tool installed. All shapes are original.
import { writeFileSync, mkdirSync } from 'node:fs';
import { writeSil, writePlc } from './geo/formats.mjs';
import * as M from './geo/models.mjs';
import { Mesh, box, cyl, terrain } from './geo/mesh.mjs';
import { rng, quatYXZ, T, Ry, Rz, Rx, chain, smoothstep, fbm } from './geo/math.mjs';
import { groundsHeight, countrysideHeight, winterHeight, CASTLE_POS, SPECIAL_AREAS } from './geo/layout.mjs';

const OUT = new URL('../public/geo/', import.meta.url).pathname;
const manifest = { meshes: {}, placements: {} };
const mesh = (name, m, opts) => { manifest.meshes[name] = writeSil(m, `${OUT}${name}.bin`, opts); };
const plc = (name, list, seed) => { manifest.placements[name] = writePlc(list, `${OUT}${name}.plc`, seed); };
const yaw = (a) => quatYXZ(a);

// ------------------------------------------------------------- kit meshes
const castle = M.buildCastle();
mesh('kit/castle', castle.mesh);
plc('kit/castle_windows', castle.windows);
plc('kit/castle_banners', castle.banners);
mesh('kit/window', M.windowQuad());
mesh('kit/banner', M.banner());
mesh('kit/pine', M.pine());
mesh('kit/tree_round', M.roundTree());
mesh('kit/tree_dead', M.deadTree());
mesh('kit/rock', M.rock());
mesh('kit/willow', M.willow());
mesh('kit/candle', M.candle());
mesh('kit/lantern', M.lantern());
mesh('kit/boat', M.boat());
mesh('kit/hedge', M.hedge());
mesh('kit/brazier', M.brazier());
mesh('kit/shelf', M.shelf());
mesh('kit/orb', M.orb());
mesh('kit/tent', M.tent());
mesh('kit/car', M.car());
mesh('kit/cottage', M.cottage());
mesh('kit/hut', M.hut());
mesh('kit/clocktower', M.clockTower());

// ------------------------------------------------------------- terrains
const T_TOL = { tolerance: 0.05 };
mesh('grounds/terrain_hi', terrain(1800, 170, groundsHeight), T_TOL);
mesh('grounds/terrain_lo', terrain(1800, 90, groundsHeight), T_TOL);
mesh('film-2/terrain_hi', terrain(2400, 150, countrysideHeight), T_TOL);
mesh('film-2/terrain_lo', terrain(2400, 80, countrysideHeight), T_TOL);
mesh('film-7/terrain_hi', terrain(1200, 140, winterHeight), T_TOL);
mesh('film-7/terrain_lo', terrain(1200, 76, winterHeight), T_TOL);

// ------------------------------------------------------------- grounds scatter
function scatter(n, seed, heightFn, accept, { size = 1700, scale = [0.8, 1.6] } = {}) {
  const r = rng(seed); const out = []; let guard = 0;
  while (out.length < n && guard++ < n * 60) {
    const x = (r() - 0.5) * size, z = (r() - 0.5) * size; const y = heightFn(x, z);
    if (!accept(x, y, z, r)) continue;
    const s = scale[0] + r() * (scale[1] - scale[0]);
    out.push({ p: [x, y - 0.3, z], q: yaw(r() * 6.28), s: [s, s * (0.85 + r() * 0.3), s] });
  }
  return out;
}
const clearOfSpecial = (x, z, pad = 0) => SPECIAL_AREAS.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + pad);
const slope = (fn, x, z) => Math.hypot(fn(x + 2, z) - fn(x - 2, z), fn(x, z + 2) - fn(x, z - 2)) / 4;

plc('grounds/pines', scatter(2600, 11, groundsHeight, (x, y, z, r) =>
  y > 3 && y < 150 && clearOfSpecial(x, z) && slope(groundsHeight, x, z) < 0.9 && fbm(x * 0.006, z * 0.006) > 0.42 - r() * 0.05));
plc('grounds/trees_round', scatter(420, 12, groundsHeight, (x, y, z) => y > 3 && y < 40 && clearOfSpecial(x, z) && fbm(x * 0.01 + 5, z * 0.01) > 0.55));
plc('grounds/rocks', scatter(260, 13, groundsHeight, (x, y, z) => y > -1 && y < 90 && slope(groundsHeight, x, z) > 0.35 && clearOfSpecial(x, z, -20), { scale: [1.5, 6] }));

// Long bridge from the castle's east wall to the ridge (whole and broken).
function bridge(broken) {
  const m = new Mesh(); const z = CASTLE_POS[2], deckY = 47.5;
  for (let x = 112; x <= 206; x += 13.5) {
    const g = groundsHeight(x, z) - 2;
    const isGap = broken && x > 140 && x < 172;
    m.add(box(4, deckY - g + (isGap ? -12 : 0), 6), T(x, g, z));
  }
  for (let x = 112; x < 206; x += 3) {
    if (broken && x > 141 && x < 168) continue;
    const tilt = broken && (x >= 168 && x < 174) ? 0.25 : broken && x > 135 && x <= 141 ? -0.2 : 0;
    m.add(box(3.1, 1.2, 6.5), chain(T(x + 1.5, deckY, z), Rz(tilt)));
    for (const s of [-1, 1]) m.add(box(3, 1.3, 0.35), chain(T(x + 1.5, deckY + 1.2, z + s * 3.1), Rz(tilt)));
    if (Math.round(x) % 9 === 1) for (const s of [-1, 1]) m.add(box(0.4, 4, 0.4), T(x + 1.5, deckY + 1.2, z + s * 3.1));
  }
  if (broken) { const r = rng(4); for (let k = 0; k < 18; k++) m.add(box(1 + r() * 3, 0.8 + r() * 1.5, 1 + r() * 3), chain(T(145 + r() * 25, groundsHeight(156, z) - 1, z + (r() - 0.5) * 20), Ry(r() * 3), Rz(r() - 0.5))); }
  return m;
}
mesh('grounds/bridge', bridge(false));
mesh('grounds/bridge_broken', bridge(true));

// ------------------------------------------------------------- film 1: boats crossing the lake
{
  const r = rng(101); const boats = []; const flames = []; const candles = []; const lanterns = [];
  for (let k = 0; k < 18; k++) {
    const row = Math.floor(k / 3), col = (k % 3) - 1;
    const x = col * 9 + (r() - 0.5) * 4 + Math.sin(row) * 6, z = 200 - row * 55 + (r() - 0.5) * 10;
    const a = Math.PI + (r() - 0.5) * 0.25; // heading north (-Z)
    boats.push({ p: [x, 0.2, z], q: yaw(a), s: 1 });
    flames.push({ p: [x + Math.sin(a) * 2.2, 2.35, z + Math.cos(a) * 2.2], s: 1 });
  }
  for (let k = 0; k < 280; k++) { // floating candles drifting over the landing
    const x = (r() - 0.5) * 70, z = -150 - r() * 50, y = 6 + r() * 26;
    candles.push({ p: [x, y, z], s: 0.9 + r() * 0.4 });
  }
  for (let k = 0; k < 14; k++) { // jetty lanterns on the south shore
    const x = -30 + k * 4.5, z = 262 + Math.sin(k) * 2; lanterns.push({ p: [x, groundsHeight(x, z) + 1.6, z], q: yaw(r() * 6), s: 1 });
  }
  plc('film-1/boats', boats); plc('film-1/boat_flames', flames); plc('film-1/candles', candles); plc('film-1/lanterns', lanterns);
  plc('film-1/lantern_flames', lanterns.map((l) => ({ p: [l.p[0], l.p[1] + 0.35, l.p[2]], s: 1.3 })));
}

// ------------------------------------------------------------- film 2: flying car over countryside
{
  const r = rng(202); const H = countrysideHeight;
  const hedges = [];
  for (let gx = -1000; gx < 1000; gx += 90) for (let gz = -600; gz < 1100; gz += 70) {
    if (Math.abs(gx - Math.sin(gz * 0.003) * 120) < 100) continue; // keep the river clear
    for (const [dx, dz, len, ang] of [[45, 0, 90, 0], [0, 35, 70, Math.PI / 2]]) {
      if (r() < 0.25) continue;
      const x = gx + dx, z = gz + dz; const segs = Math.ceil(len / 10);
      for (let s = 0; s < segs; s++) {
        const t = (s + 0.5) / segs - 0.5; const px = x + (ang ? 0 : t * len), pz = z + (ang ? t * len : 0);
        hedges.push({ p: [px, H(px, pz) - 0.5, pz], q: yaw(ang), s: [len / segs + 0.4, 0.55 + r() * 0.2, 1] });
      }
    }
  }
  plc('film-2/hedgerows', hedges);
  plc('film-2/trees', scatter(1400, 21, H, (x, y, z) => fbm(x * 0.008, z * 0.008 + 2) > 0.52 && Math.hypot(x / 150, (z + 930) / 150) > 1.35, { size: 2300, scale: [0.9, 1.7] }));
  const cottages = scatter(36, 22, H, (x, y, z) => fbm(x * 0.004 + 7, z * 0.004) > 0.55 && z > -500 && slope(H, x, z) < 0.25, { size: 1800, scale: [0.9, 1.2] });
  plc('film-2/cottages', cottages);
  plc('film-2/cottage_windows', cottages.flatMap((c) => { const out = []; for (const s of [-1, 1]) {
    const [qx, qy, qz, qw] = c.q; const ang = 2 * Math.atan2(qy, qw); const lx = s * 2, lz = 3.05;
    out.push({ p: [c.p[0] + Math.cos(ang) * lx + Math.sin(ang) * lz * c.s[0], c.p[1] + 2.2 * c.s[1], c.p[2] - Math.sin(ang) * lx + Math.cos(ang) * lz * c.s[0]], q: yaw(ang), s: [1, 1.2, 1] }); } return out; }));
  // the cloister corridor on the castle crag
  // runs north-south, from z=-806 to z=-866, just south of the castle wall
  mesh('film-2/corridor', new Mesh().add(M.cloister(60, 9, 8, 6), chain(T(0, 80, -836), Ry(Math.PI / 2))));
  const torches = []; for (let z = -863; z <= -809; z += 6) for (const s of [-1, 1]) torches.push({ p: [s * 3.9, 85.5, z], s: 1.4 });
  plc('film-2/torches', torches);
}

// ------------------------------------------------------------- film 3: clock tower, courtyard, hillside hut
{
  const r = rng(303);
  mesh('film-3/courtyard', (() => { const m = new Mesh();
    for (const [x, z, a] of [[0, -18, 0], [0, 18, 0], [-18, 0, Math.PI / 2], [18, 0, Math.PI / 2]]) m.add(M.cloister(36, 6, 6, 4), chain(T(x, 0, z), Ry(a)));
    m.add(cyl(2.4, 2.6, 1.2, 10), T(0, 0, 0)); // fountain basin
    return m; })());
  // clock tower stands at (-165, 44, -255); courtyard just south of it
  const clock = [{ p: [-165, 44 + 36, -255 + 6.15], q: yaw(0), s: [7, 7, 1] }, { p: [-165 + 6.15, 44 + 36, -255], q: yaw(Math.PI / 2), s: [7, 7, 1] }];
  plc('film-3/clock_faces', clock);
  const hutY = groundsHeight(240, -140);
  plc('film-3/hut_windows', [{ p: [240 + 0.6, hutY + 2, -140 + 3.95], q: yaw(0.15), s: [1.1, 1.3, 1] }, { p: [240 - 3.9, hutY + 2.2, -140], q: yaw(-Math.PI / 2), s: [1, 1.2, 1] }]);
  plc('film-3/pumpkins', Array.from({ length: 22 }, () => { const x = 225 + r() * 18, z = -118 + r() * 14; return { p: [x, groundsHeight(x, z) + 0.2, z], q: yaw(r() * 6), s: 0.5 + r() * 0.5 }; }));
}

// ------------------------------------------------------------- film 4: maze, lake, dragon fire
{
  const N = 17, CELL = 12, ox = 330 - (N * CELL) / 2, oz = 230 - (N * CELL) / 2, r = rng(404);
  // recursive-backtracker maze, then carve a straight avenue down the middle row
  const walls = { h: [], v: [] }; // h[y][x]: wall below cell, v[y][x]: wall right of cell
  for (let y = 0; y <= N; y++) { walls.h[y] = Array(N).fill(true); walls.v[y] = Array(N + 1).fill(true); }
  const seen = Array.from({ length: N }, () => Array(N).fill(false)); const stack = [[0, 0]]; seen[0][0] = true;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && !seen[y][x]);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(r() * nb.length)];
    if (dx === 1) walls.v[cy][cx + 1] = false; if (dx === -1) walls.v[cy][cx] = false;
    if (dy === 1) walls.h[cy + 1][cx] = false; if (dy === -1) walls.h[cy][cx] = false;
    seen[ny][nx] = true; stack.push([nx, ny]);
  }
  const mid = Math.floor(N / 2); for (let y = 0; y <= N; y++) walls.h[y][mid] = false; // avenue (north-south)
  walls.v[mid][0] = false; walls.v[mid][N] = false;
  const hedges = [];
  for (let y = 0; y <= N; y++) for (let x = 0; x < N; x++) if (walls.h[y][x]) hedges.push({ p: [ox + x * CELL + CELL / 2, 5.5, oz + y * CELL], q: yaw(0), s: [CELL + 1, 1.9, 1.3] });
  for (let y = 0; y < N; y++) for (let x = 0; x <= N; x++) if (walls.v[y][x]) hedges.push({ p: [ox + x * CELL, 5.5, oz + y * CELL + CELL / 2], q: yaw(Math.PI / 2), s: [CELL + 1, 1.9, 1.3] });
  plc('film-4/hedges', hedges);
  const braziers = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.28; const x = 330 + Math.cos(a) * 118, z = 230 + Math.sin(a) * 118; braziers.push({ p: [x, 6, z], s: 1.2 }); }
  plc('film-4/braziers', braziers); plc('film-4/brazier_flames', braziers.map((b) => ({ p: [b.p[0], 8.4, b.p[2]], s: 2.2 })));
  // floating buoys on the lake marking the second task
  plc('film-4/buoys', Array.from({ length: 30 }, (_, k) => ({ p: [Math.cos(k * 0.7) * (60 + k * 3), 0.6, 40 + Math.sin(k * 0.7) * (40 + k * 2)], s: 1.5 })));
}

// ------------------------------------------------------------- film 5: hall of glass shelves
{
  const shelves = [], orbs = [], r = rng(505);
  for (let row = -7; row <= 7; row++) for (let bay = -22; bay < 22; bay++) {
    const x = row * 7, z = bay * 4.1 + 2;
    shelves.push({ p: [x, 0, z], q: yaw(Math.PI / 2), s: 1 });
    for (let lvl = 0; lvl < 6; lvl++) for (let k = 0; k < 2; k++) if (r() > 0.12) orbs.push({ p: [x + (r() - 0.5) * 0.5, 0.2 + lvl * 1.5 + 0.26, z - 1.4 + k * 1.4 + (r() - 0.5) * 0.6], s: 0.8 + r() * 0.45 });
  }
  plc('film-5/shelves', shelves); plc('film-5/orbs', orbs);
  const lamps = []; for (let row = -7; row <= 7; row += 2) for (let z = -88; z <= 88; z += 22) lamps.push({ p: [row * 7 + 3.5, 11 + r() * 2, z], s: 2 });
  plc('film-5/lamps', lamps);
}

// ------------------------------------------------------------- film 6: astronomy tower (uses grounds)
{
  const r = rng(606); const crows = [];
  for (let k = 0; k < 40; k++) crows.push({ p: [45 + (r() - 0.5) * 120, 110 + r() * 60, -325 + (r() - 0.5) * 120], s: 1 });
  plc('film-6/debris', crows);
}

// ------------------------------------------------------------- film 7: frozen forest + tent
{
  const H = winterHeight;
  plc('film-7/pines', scatter(2200, 71, H, (x, y, z) => Math.hypot(x, z) > 45 && Math.hypot(x + 90, z - 60) > 60 && slope(H, x, z) < 1.2 && fbm(x * 0.01, z * 0.01) > 0.38, { size: 1150, scale: [0.9, 1.9] }));
  plc('film-7/dead', scatter(900, 72, H, (x, y, z) => Math.hypot(x, z) > 30 && Math.hypot(x + 90, z - 60) > 50, { size: 1100, scale: [0.8, 1.5] }));
  plc('film-7/rocks', scatter(220, 73, H, (x, y, z) => slope(H, x, z) > 0.4, { size: 1100, scale: [2, 7] }));
  plc('film-7/tent', [{ p: [4, H(4, -6), -6], q: yaw(0.5), s: 1.2 }]);
  plc('film-7/tent_glow', [{ p: [4 + Math.sin(0.5) * 2.75, H(4, -6) + 1.0, -6 + Math.cos(0.5) * 2.75], q: yaw(0.5), s: [1.6, 2.0, 1] }]);
}

// ------------------------------------------------------------- film 8: dawn after the battle (grounds)
{
  const r = rng(808);
  plc('film-8/rubble', Array.from({ length: 160 }, () => { const x = (r() - 0.5) * 220, z = -300 + (r() - 0.5) * 180 + 60; return { p: [x, groundsHeight(x, z), z], q: quatYXZ(r() * 6, r(), r()), s: 0.6 + r() * 2.2 }; }));
  plc('film-8/smoke_sources', [[30, 90, -310], [-45, 70, -340], [70, 60, -280], [-80, 60, -300], [10, 60, -255]].map((p) => ({ p, s: 1 })));
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 1));
let tot = 0, totGz = 0;
for (const [k, v] of Object.entries({ ...manifest.meshes, ...manifest.placements })) { tot += v.bytes; totGz += v.gz; }
console.log(`geometry: ${Object.keys(manifest.meshes).length} meshes, ${Object.keys(manifest.placements).length} placement files, ${(tot / 1024).toFixed(0)} KB raw, ${(totGz / 1024).toFixed(0)} KB gzipped`);
