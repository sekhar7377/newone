// Generates the starter line illustrations (original drawings, built from
// simple pen strokes) in the compact stroke format used by the live line
// renderer and the /studio illustration tool:
//   { p: [x,y,z, ...] centimetres (ints), w: [0..255 relative width per point] }
// Drawings are ~4–6 m tall, centred on x=0 with their base at y=0.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const OUT = new URL('../content/illustrations/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** pts in metres [[x,y],...]; pressure profile tapers at both ends like a pen. */
function stroke(pts, { w = 1, taper = true, jitter = 0.015 } = {}) {
  const p = [], ww = [];
  pts.forEach(([x, y, z = 0], i) => {
    const t = pts.length > 1 ? i / (pts.length - 1) : 0.5;
    const press = taper ? 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.02)) ** 0.6 : 1;
    p.push(Math.round((x + (rnd() - 0.5) * jitter) * 100), Math.round((y + (rnd() - 0.5) * jitter) * 100), Math.round(z * 100));
    ww.push(Math.max(20, Math.min(255, Math.round(press * w * 200))));
  });
  return { p, w: ww };
}
const line = (a, b, n = 8) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * (i / n), a[1] + (b[1] - a[1]) * (i / n)]);
const arc = (cx, cy, rx, ry, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const circle = (cx, cy, r, n = 40) => arc(cx, cy, r, r, 0, Math.PI * 2 * 1.02, n);
/** Smooth a few control points into a curve (Catmull-Rom). */
function curve(ctrl, n = 10) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  out.push(ctrl[ctrl.length - 1]); return out;
}
const S = (...a) => stroke(...a);

const D = {
  boat: () => [
    S(curve([[-2.4, 1.2], [-1.6, 0.35], [0, 0.1], [1.7, 0.35], [2.5, 1.3]])),
    S(line([-2.4, 1.2], [2.5, 1.3]), { w: 0.7 }),
    S(line([2.1, 1.25], [2.2, 3.4]), { w: 0.6 }),
    S(curve([[2.2, 3.4], [2.6, 3.5], [2.7, 3.1]]), { w: 0.6 }),
    S(circle(2.7, 2.85, 0.25, 20), { w: 0.8 }),
    ...[0, 1, 2].map((k) => S(curve([[-3 + k * 0.3, -0.2 - k * 0.3], [-1.5, -0.05 - k * 0.3], [0, -0.25 - k * 0.3], [1.5, -0.05 - k * 0.3], [3 - k * 0.3, -0.2 - k * 0.3]]), { w: 0.45 })),
  ],
  notes: () => [
    ...[0, 1, 2, 3, 4].map((k) => S(curve([[-3, 1 + k * 0.32], [-1, 1.1 + k * 0.32], [1, 0.95 + k * 0.32], [3, 1.05 + k * 0.32]]), { w: 0.35, taper: false })),
    S(circle(-1.6, 1.32, 0.2, 18), { w: 1.1 }), S(line([-1.42, 1.35], [-1.42, 3.1]), { w: 0.6 }),
    S(circle(0.2, 1.65, 0.2, 18), { w: 1.1 }), S(line([0.38, 1.7], [0.38, 3.4]), { w: 0.6 }), S(line([-1.42, 3.1], [0.38, 3.4]), { w: 1.2 }),
    S(circle(1.8, 2.3, 0.2, 18), { w: 1.1 }), S(line([1.98, 2.35], [1.98, 4]), { w: 0.6 }), S(curve([[1.98, 4], [2.5, 3.6], [2.4, 3.1]]), { w: 0.6 }),
    ...[[-2.6, 4], [2.9, 4.4], [-0.6, 4.6]].map(([x, y]) => S([[x - 0.15, y], [x + 0.15, y], [x, y], [x, y + 0.15], [x, y - 0.15]], { w: 0.5 })),
  ],
  candle: () => [
    S(line([-0.4, 0], [-0.4, 2.6])), S(line([0.4, 0], [0.4, 2.6])), S(curve([[-0.4, 2.6], [-0.1, 2.5], [0.1, 2.75], [0.4, 2.6]]), { w: 0.7 }),
    S(curve([[-0.4, 2.2], [-0.5, 1.8], [-0.45, 1.5]]), { w: 0.6 }),
    S(curve([[0, 2.75], [-0.35, 3.3], [0, 4.3], [0.35, 3.3], [0, 2.75]]), { w: 0.9 }),
    ...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return S(line([Math.cos(a) * 0.9, 3.4 + Math.sin(a) * 0.9], [Math.cos(a) * 1.4, 3.4 + Math.sin(a) * 1.4], 3), { w: 0.4 }); }),
  ],
  car: () => [
    S(curve([[-2.4, 0.6], [-2.5, 1.2], [-1.4, 1.35], [-0.9, 2.1], [0.9, 2.1], [1.3, 1.35], [2.4, 1.2], [2.5, 0.6]]), { w: 0.9 }),
    S(line([-2.4, 0.6], [2.5, 0.6]), { w: 0.6 }), S(circle(-1.4, 0.55, 0.42, 26)), S(circle(1.4, 0.55, 0.42, 26)),
    S(line([-0.8, 1.4], [-0.6, 1.95], 3), { w: 0.4 }), S(line([0.1, 1.4], [0.1, 2.05], 3), { w: 0.4 }),
    ...[0, 1, 2].map((k) => S(line([-3.6 - k * 0.2, 0.9 + k * 0.45], [-2.8, 0.9 + k * 0.45], 4), { w: 0.4 })),
    S(curve([[2.6, 2.6], [3.1, 3.0], [2.8, 3.3], [3.3, 3.6]]), { w: 0.4 }),
  ],
  clock: () => [
    S(circle(0, 2.6, 2.2, 60), { w: 1.1 }), S(circle(0, 2.6, 1.95, 60), { w: 0.4 }),
    ...Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return S(line([Math.cos(a) * 1.6, 2.6 + Math.sin(a) * 1.6], [Math.cos(a) * 1.85, 2.6 + Math.sin(a) * 1.85], 2), { w: 0.6 }); }),
    S(line([0, 2.6], [0.75, 3.7], 4), { w: 1 }), S(line([0, 2.6], [-0.2, 4.1], 5), { w: 0.7 }),
    S(curve([[0, 0.4], [0.12, -0.6], [0, -1.6]]), { w: 0.5 }), S(circle(0, -1.9, 0.32, 20), { w: 0.8 }),
  ],
  hut: () => [
    S(curve([[-2, 0], [-2.1, 1.2], [-1.95, 2]])), S(curve([[2, 0], [2.1, 1.2], [1.95, 2]])), S(line([-2.2, 0], [2.2, 0])),
    S(curve([[-2.6, 2], [-1.2, 3.5], [0, 5], [1.2, 3.5], [2.6, 2]]), { w: 0.9 }),
    S(curve([[-0.5, 0], [-0.5, 1.2], [0, 1.5], [0.5, 1.2], [0.5, 0]]), { w: 0.7 }),
    S(line([1.2, 3.4], [1.2, 4.6])), S(line([1.6, 3.0], [1.6, 4.6])),
    S(curve([[1.4, 4.8], [1.0, 5.4], [1.6, 5.9], [1.1, 6.5], [1.5, 7]]), { w: 0.4 }),
    ...[[-3, 0.2], [-3.5, 0.15], [3.2, 0.25]].map(([x, y]) => S(circle(x, y + 0.2, 0.25, 14), { w: 0.6 })),
  ],
  maze: () => {
    const pts = []; let x = 0, y = 2.5, d = 0.4, dir = 0;
    for (let k = 0; k < 13; k++) { pts.push([x, y]); const L = d * (1 + Math.floor(k / 2)); if (dir === 0) x += L; if (dir === 1) y += L; if (dir === 2) x -= L; if (dir === 3) y -= L; dir = (dir + 1) % 4; }
    pts.push([x, y]);
    return [S(pts.flatMap((p, i) => (i ? line(pts[i - 1], p, 3).slice(1) : [p])), { w: 0.7, taper: false }), S(line([-3, 0], [3, 0]), { w: 0.5 }), S(circle(0.2, 2.7, 0.18, 14), { w: 1 })];
  },
  wave: () => [0, 1, 2, 3].map((k) => S(Array.from({ length: 41 }, (_, i) => { const x = -3 + i * 0.15; return [x, 0.8 + k * 0.9 + Math.sin(x * 2 + k) * 0.25]; }), { w: 0.8 - k * 0.1 })),
  flame: () => [
    S(curve([[0, 0], [-1.4, 1.2], [-1, 2.6], [-0.3, 3.2], [-0.5, 4.4], [0.3, 3.6], [0.9, 2.6], [1.3, 1.2], [0, 0]]), { w: 1 }),
    S(curve([[0, 0.4], [-0.6, 1.2], [-0.2, 2.2], [0.1, 1.6], [0.5, 1.1], [0, 0.4]]), { w: 0.6 }),
  ],
  orb: () => [
    S(circle(0, 2.4, 1.6, 50), { w: 1 }),
    S(curve([[-0.9, 2.6], [-0.3, 3.2], [0.4, 2.8], [0.1, 2.1], [-0.5, 2.3], [-0.2, 2.7]]), { w: 0.5 }),
    S(curve([[0.6, 1.6], [1.0, 2.2], [0.8, 3.0]]), { w: 0.4 }),
    S(curve([[-1.2, 0.95], [-0.6, 0.6], [0, 0.55], [0.6, 0.6], [1.2, 0.95]]), { w: 0.8 }), S(line([-0.8, 0.3], [0.8, 0.3]), { w: 0.8 }),
  ],
  stag: () => [
    S(curve([[-1.8, 2], [-1, 2.4], [0.6, 2.3], [1.4, 2.2]]), { w: 0.9 }), S(curve([[-1.8, 2], [-1.4, 1.6], [0.6, 1.6], [1.3, 1.8]]), { w: 0.7 }),
    S(line([-1.5, 1.7], [-1.6, 0], 4)), S(line([-1.0, 1.65], [-0.9, 0], 4)), S(line([0.7, 1.65], [0.8, 0], 4)), S(line([1.2, 1.8], [1.35, 0], 4)),
    S(curve([[1.3, 2.2], [1.7, 3.0], [1.9, 3.5]]), { w: 0.9 }), S(curve([[1.9, 3.5], [2.5, 3.3], [2.4, 3.1], [1.9, 3.2]]), { w: 0.7 }),
    S(curve([[1.8, 3.6], [1.4, 4.4], [1.0, 5.0]]), { w: 0.5 }), S(curve([[1.55, 4.1], [1.9, 4.6]]), { w: 0.4 }), S(curve([[1.25, 4.6], [1.0, 5.3]]), { w: 0.4 }),
    S(curve([[2.0, 3.6], [2.3, 4.4], [2.7, 5.0]]), { w: 0.5 }), S(curve([[2.2, 4.1], [2.6, 4.4]]), { w: 0.4 }), S(curve([[2.45, 4.7], [2.5, 5.3]]), { w: 0.4 }),
  ],
  doe: () => [
    S(curve([[-1.6, 2], [-0.8, 2.3], [0.6, 2.2], [1.3, 2.1]]), { w: 0.9 }), S(curve([[-1.6, 2], [-1.3, 1.6], [0.6, 1.6], [1.2, 1.75]]), { w: 0.7 }),
    S(line([-1.3, 1.7], [-1.35, 0], 4)), S(line([-0.8, 1.65], [-0.7, 0], 4)), S(line([0.6, 1.65], [0.75, 0], 4)), S(line([1.1, 1.75], [1.25, 0], 4)),
    S(curve([[1.2, 2.1], [1.5, 2.9], [1.7, 3.3]]), { w: 0.9 }), S(curve([[1.7, 3.3], [2.3, 3.0], [2.2, 2.9], [1.75, 3.0]]), { w: 0.7 }),
    S(curve([[1.65, 3.4], [1.5, 3.8], [1.7, 3.7]]), { w: 0.5 }), S(curve([[1.85, 3.4], [2.0, 3.85], [2.1, 3.6]]), { w: 0.5 }),
  ],
  moon: () => [
    S(arc(0, 3, 1.6, 1.6, -Math.PI * 0.6, Math.PI * 0.6, 30), { w: 1 }), S(curve([[0.94, 1.71], [0.3, 2.6], [0.3, 3.4], [0.94, 4.29]]), { w: 0.7 }),
    ...[[-2.2, 4.3], [-1.6, 1.8], [2.4, 4.6], [-2.6, 2.8], [2.6, 1.6]].map(([x, y]) => S([[x - 0.2, y], [x + 0.2, y], [x, y], [x, y + 0.2], [x, y - 0.2]], { w: 0.45 })),
  ],
  tower: () => [
    S(line([-0.7, 0], [-0.6, 4], 6)), S(line([0.7, 0], [0.6, 4], 6)), S(line([-0.9, 4], [0.9, 4], 4)),
    S(curve([[-0.9, 4], [0, 6], [0.9, 4]]), { w: 0.9 }), S(line([-0.15, 2.4], [-0.15, 3.0], 2), { w: 0.6 }), S(line([0.15, 2.4], [0.15, 3.0], 2), { w: 0.6 }),
    S(curve([[-3, 5.4], [-2.2, 5.9], [-1.4, 5.5], [-0.6, 6.2]]), { w: 0.5 }), S(curve([[1.0, 6.4], [1.8, 6.0], [2.6, 6.5], [3.2, 6.1]]), { w: 0.5 }),
    S([[2.2, 6.0], [1.8, 5.2], [2.2, 5.2], [1.7, 4.2]], { w: 0.6, taper: false }),
  ],
  tent: () => [
    S(line([-2.5, 0], [0, 2.8], 8)), S(line([0, 2.8], [2.5, 0], 8)), S(line([-2.8, 0], [2.8, 0], 6), { w: 0.6 }),
    S(line([0, 2.8], [-0.5, 0], 6), { w: 0.6 }), S(line([0, 2.8], [0.6, 0], 6), { w: 0.6 }), S(line([0, 2.8], [0, 3.3], 2), { w: 0.6 }),
    ...[[-2, 4], [1.6, 4.4], [2.8, 3.2], [-3, 2.6], [0.4, 5]].map(([x, y]) => S([[x - 0.18, y], [x + 0.18, y], [x, y], [x, y + 0.18], [x, y - 0.18]], { w: 0.45 })),
  ],
  brothers: () => [-1.8, 0, 1.8].flatMap((x, k) => {
    const h = 3.6 + (k === 1 ? 0.4 : 0) - k * 0.15;
    return [S([[x - 0.75, 0], [x - 0.2, h - 0.6], [x, h - 0.4], [x + 0.2, h - 0.6], [x + 0.75, 0]], { w: 0.8 }), S(circle(x, h - 0.1, 0.28, 18), { w: 0.7 }),
      S(line([x + 0.5, 0.9 + k * 0.4], [x + 0.95, 2 + k * 0.4], 3), { w: 0.5 })];
  }),
  bridge: () => [
    S(line([-3.2, 2.2], [-0.5, 2.25], 8)), S(line([0.7, 2.25], [3.2, 2.2], 8)),
    S(line([-0.5, 2.25], [-0.25, 1.7], 2), { w: 0.6 }), S(line([0.7, 2.25], [0.5, 1.6], 2), { w: 0.6 }),
    ...[-2.6, -1.4, 1.6, 2.8].map((x) => S(line([x, 2.2], [x + 0.05, 0], 5), { w: 0.8 })),
    ...[[-0.2, 0.8], [0.3, 0.5], [0.1, 1.2]].map(([x, y]) => S([[x - 0.15, y - 0.1], [x + 0.15, y - 0.1], [x, y + 0.15], [x - 0.15, y - 0.1]], { w: 0.5, taper: false })),
    S(curve([[-3.6, 3.6], [-2, 3.9], [-0.5, 3.5], [1, 3.9], [2.5, 3.6], [3.6, 3.8]]), { w: 0.35 }),
  ],
};

const ILL = {
  'film-1': [['f1-boat', 'f1-crossing', 'boat', 'A pen sketch of a small rowing boat with a lantern on a pole at the prow, ripples beneath it.'],
             ['f1-notes', 'f1-score', 'notes', 'A few musical notes dancing across a hand-drawn stave, with tiny stars.'],
             ['f1-candle', 'f1-candles', 'candle', 'A single candle drawn in ink, its flame radiating short strokes of light.']],
  'film-2': [['f2-car', 'f2-car', 'car', 'A rounded little car with speed lines trailing behind it.'], ['f2-notes', 'f2-score', 'notes', 'Musical notes on a wavering stave.']],
  'film-3': [['f3-clock', 'f3-cuaron', 'clock', 'A large clock face with a pendulum swinging beneath it.'], ['f3-hut', 'f3-hut', 'hut', 'A round stone hut with a steep roof, smoke curling from the chimney and pumpkins beside it.']],
  'film-4': [['f4-maze', 'f4-maze', 'maze', 'A square spiral maze with a dot at its centre.'], ['f4-wave', 'f4-lake', 'wave', 'Four rolling lines of water.'], ['f4-flame', 'f4-dragon', 'flame', 'A tall tongue of fire drawn in two strokes.']],
  'film-5': [['f5-orb', 'f5-orbs', 'orb', 'A glass sphere on a small stand, a swirl of mist inside.'], ['f5-stag', 'f5-army', 'stag', 'A stag drawn in a few quick lines, antlers raised.']],
  'film-6': [['f6-moon', 'f6-delbonnel', 'moon', 'A crescent moon among small stars.'], ['f6-tower', 'f6-tower', 'tower', 'A slender tower with a pointed roof under storm clouds and a fork of lightning.']],
  'film-7': [['f7-notes', 'f7-desplat', 'notes', 'Musical notes on a stave.'], ['f7-stag', 'f7-pond', 'stag', 'A stag standing still, drawn in silver line.'], ['f7-tent', 'f7-tent', 'tent', 'A simple A-frame tent under stars.'], ['f7-brothers', 'f7-tale', 'brothers', 'Three tall cloaked figures in a row, each holding something different.']],
  'film-8': [['f8-bridge', 'f8-bridge', 'bridge', 'A long bridge on tall piers with its middle span broken away and falling stones.'], ['f8-doe', 'f8-snape', 'doe', 'A doe drawn in a few soft lines, head turned.']],
};

const summary = [];
for (const [scene, list] of Object.entries(ILL)) {
  const out = list.map(([id, hotspot, kind, alt]) => { seed = id.length * 977 + 13; return { id, hotspot, alt, publishAt: '2026-01-01', offset: [0, 2.6, 0], scale: 1, strokes: D[kind]() }; });
  writeFileSync(`${OUT}${scene}.json`, JSON.stringify(out));
  const bytes = readFileSync(`${OUT}${scene}.json`).length;
  summary.push(`${scene}: ${out.length} drawings, ${out.reduce((a, d) => a + d.strokes.length, 0)} strokes, ${(bytes / 1024).toFixed(1)} KB`);
}
writeFileSync(`${OUT}hub.json`, '[]');
console.log(summary.join('\n'));
