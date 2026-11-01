// Original, procedurally modelled silhouette props. Every model is designed to
// read as a shape in fog, not as surface detail.
import { Mesh, box, cyl, gable, blob, gridXY, quad, hull } from './mesh.mjs';
import { T, S, Ry, Rx, Rz, chain, rng, quatYXZ } from './math.mjs';

// ---------------------------------------------------------------- castle
export const CASTLE = {
  round: [ // x, z, radius, height, roofHeight
    [45, -25, 7, 78, 22], [-40, -40, 6, 52, 16], [-70, 10, 5, 40, 14], [70, 15, 5.5, 44, 15],
    [20, 35, 4.5, 34, 12], [-20, 40, 4, 30, 11], [90, -40, 4.5, 38, 13], [-95, -20, 5, 36, 13],
    [5, -55, 5, 46, 15], [-55, 45, 3.5, 28, 10], [30, -70, 3.5, 32, 10], [-15, -72, 4, 36, 12],
  ],
  square: [ // x, z, width, height, roofHeight
    [60, -62, 12, 40, 12], [-75, -60, 11, 34, 10], [100, 0, 9, 30, 9],
  ],
  halls: [ // x, z, length, depth, height, roofHeight, yaw
    [0, 5, 70, 20, 24, 14, 0], [-58, -18, 40, 16, 20, 10, Math.PI / 2], [58, -18, 50, 18, 18, 9, Math.PI / 2],
    [0, -45, 60, 14, 28, 10, 0], [0, 42, 30, 12, 16, 8, 0], [-30, -65, 26, 12, 22, 8, 0.3],
  ],
  wall: [[-100, 55], [-60, 62], [0, 58], [60, 55], [105, 35], [112, -25], [95, -70], [40, -85], [-30, -88], [-90, -75], [-112, -30], [-100, 55]],
};

export function buildCastle() {
  const m = new Mesh(); const windows = []; const banners = []; const r = rng(42);
  const yawOut = (dx, dz) => Math.atan2(dx, dz);
  const win = (x, y, z, yaw, s) => windows.push({ p: [x, y, z], q: quatYXZ(yaw), s });

  for (const [x, z, rad, h, rh] of CASTLE.round) {
    m.add(cyl(rad, rad * 0.94, h, 14), T(x, 0, z));
    m.add(cyl(rad * 1.18, rad * 1.18, 2.2, 14), T(x, h - 2.2, z)); // machicolation ring
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; m.add(box(1.4, 1.6, 1.4), chain(T(x + Math.cos(a) * rad * 1.1, h, z + Math.sin(a) * rad * 1.1), Ry(-a))); }
    m.add(cyl(rad * 1.2, 0, rh, 14), T(x, h, z));
    m.add(cyl(0.12, 0.12, 6, 4, { top: false }), T(x, h + rh - 0.5, z)); // flag pole
    banners.push({ p: [x, h + rh + 5.2, z], q: quatYXZ(r() * 6.28), s: [5.5, 2.2, 1] });
    for (let y = 9; y < h - 5; y += 7.5) {
      const n = Math.max(3, Math.floor((Math.PI * 2 * rad) / 4.2));
      for (let k = 0; k < n; k++) {
        if (r() > 0.5) continue;
        const a = (k / n) * Math.PI * 2 + y * 0.3;
        const dx = Math.cos(a), dz = Math.sin(a);
        win(x + dx * (rad + 0.1), y, z + dz * (rad + 0.1), yawOut(dx, dz), [1.1, 2.1, 1]);
      }
    }
  }
  for (const [x, z, w, h, rh] of CASTLE.square) {
    m.add(box(w, h, w), T(x, 0, z));
    m.add(cyl(w * 0.78, 0, rh, 4), chain(T(x, h, z), Ry(Math.PI / 4)));
    for (let y = 8; y < h - 4; y += 8) for (let f = 0; f < 4; f++) {
      if (r() > 0.55) continue;
      const yaw = (f * Math.PI) / 2; const dx = Math.sin(yaw), dz = Math.cos(yaw);
      win(x + dx * (w / 2 + 0.1), y, z + dz * (w / 2 + 0.1), yaw, [1.3, 2.4, 1]);
    }
  }
  for (const [x, z, L, D, h, rh, yaw] of CASTLE.halls) {
    const M = chain(T(x, 0, z), Ry(yaw));
    m.add(box(L, h, D), M);
    m.add(gable(L, D * 1.08, rh), chain(M, T(0, h, 0)));
    // chimneys / pinnacles along the ridge
    for (let k = -L / 2 + 6; k < L / 2 - 4; k += 12) m.add(cyl(0.7, 0, 6, 4), chain(M, T(k, h + rh * 0.3, D * 0.35)));
    for (let k = -L / 2 + 5; k <= L / 2 - 5; k += 6) for (const side of [1, -1]) {
      if (r() > 0.75) continue;
      const lx = k, lz = (side * D) / 2 + side * 0.1;
      const wx = x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, wz = z - Math.sin(yaw) * lx + Math.cos(yaw) * lz;
      win(wx, h * 0.45, wz, yaw + (side > 0 ? 0 : Math.PI), [2.2, h * 0.45, 1]);
    }
  }
  // Curtain wall with crenellations
  for (let k = 0; k < CASTLE.wall.length - 1; k++) {
    const [x0, z0] = CASTLE.wall[k], [x1, z1] = CASTLE.wall[k + 1];
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0);
    const M = chain(T((x0 + x1) / 2, 0, (z0 + z1) / 2), Ry(yaw));
    m.add(box(len, 12, 3), M);
    for (let c = -len / 2 + 1; c < len / 2; c += 2.6) m.add(box(1.3, 1.5, 3), chain(M, T(c, 12, 0)));
    m.add(cyl(3, 3, 15, 8), T(x0, 0, z0));
  }
  return { mesh: m, windows, banners };
}

// ---------------------------------------------------------------- foliage
export function pine() {
  const m = new Mesh();
  m.add(cyl(0.28, 0.2, 2.2, 5, { top: false }));
  m.add(cyl(2.6, 0, 4.4, 7), T(0, 1.6, 0));
  m.add(cyl(2.0, 0, 3.8, 7), T(0, 3.6, 0));
  m.add(cyl(1.3, 0, 3.4, 7), T(0, 5.6, 0));
  return m;
}
export function roundTree() {
  const m = new Mesh();
  m.add(cyl(0.35, 0.25, 3, 5, { top: false }));
  m.add(blob(2.8, 1, 0.5, 9), chain(T(0, 5, 0), S(1, 0.85, 1)));
  return m;
}
export function deadTree() {
  const m = new Mesh(); const r = rng(5);
  m.add(cyl(0.35, 0.12, 9, 5, { top: false }));
  for (let k = 0; k < 6; k++) {
    const y = 3 + k * 1.0, yaw = r() * 6.28, tilt = 0.6 + r() * 0.5, len = 3.5 - k * 0.35;
    m.add(cyl(0.12, 0.03, len, 4, { top: false }), chain(T(0, y, 0), Ry(yaw), Rz(tilt)));
  }
  return m;
}
export function rock() { return blob(1, 1, 0.9, 11).displace((x, y, z) => [x, y * 0.6 + 0.2, z]); }
export function willow() {
  const m = new Mesh(); const r = rng(77);
  m.add(cyl(1.6, 0.9, 6, 7, { top: false }));
  for (let k = 0; k < 14; k++) {
    const yaw = (k / 14) * 6.28 + r() * 0.4, len = 6 + r() * 5, tilt = 0.5 + r() * 0.7;
    const M = chain(T(0, 5 + r() * 2, 0), Ry(yaw), Rz(tilt));
    m.add(cyl(0.45, 0.15, len, 5, { top: false }), M);
    m.add(cyl(0.15, 0.03, len * 0.8, 4, { top: false }), chain(M, T(0, len, 0), Rz(-tilt * 1.6)));
  }
  return m;
}

// ---------------------------------------------------------------- props
export const windowQuad = quad;
export const banner = () => gridXY(1, 1, 12, 4);
export function candle() { return cyl(0.06, 0.06, 0.5, 6); }
export function lantern() {
  const m = new Mesh();
  m.add(box(0.5, 0.7, 0.5)); m.add(cyl(0.45, 0, 0.35, 4), chain(T(0, 0.7, 0), Ry(Math.PI / 4)));
  m.add(cyl(0.03, 0.03, 1.6, 4), T(0, -1.6, 0));
  return m;
}
export function boat() {
  const m = hull([[-2.2, 0.15, 0.3], [-1.6, 0.7, 0.55], [-0.6, 0.95, 0.65], [0.6, 0.95, 0.65], [1.6, 0.7, 0.55], [2.4, 0.08, 0.35]]);
  m.add(cyl(0.04, 0.04, 2.2, 4, { top: false }), T(0, 0, 2.2)); // lantern pole at the prow
  m.add(box(1.7, 0.08, 0.3), T(0, 0.05, 0.4));
  return m;
}
export function hedge() { // unit-length hedge segment, scaled along X per instance
  const m = box(1, 1, 1);
  return m.displace((x, y, z) => [x, y * 4.5, z * 1.6 + (y > 0.5 ? Math.sin(x * 9) * 0.05 : 0)]);
}
export function brazier() {
  const m = new Mesh();
  m.add(cyl(0.7, 0.9, 0.6, 8), T(0, 1.4, 0));
  for (let k = 0; k < 3; k++) m.add(cyl(0.06, 0.06, 1.5, 4), chain(Ry((k / 3) * 6.28), T(0.6, 0, 0), Rz(0.15)));
  return m;
}
export function shelf() { // 1 unit = one 4 m bay, 9 m tall, 1.2 m deep
  const m = new Mesh();
  m.add(box(0.15, 9, 1.2), T(-2, 0, 0)); m.add(box(0.15, 9, 1.2), T(2, 0, 0));
  for (let y = 0.2; y < 9; y += 1.5) m.add(box(4.1, 0.08, 1.25), T(0, y, 0));
  return m;
}
export function orb() { return blob(0.18, 0, 0, 1); }
export function tent() {
  const m = new Mesh();
  const a = m.v(-1.8, 0, -2.2), b = m.v(1.8, 0, -2.2), c = m.v(1.8, 0, 2.2), d = m.v(-1.8, 0, 2.2), r0 = m.v(0, 2.4, -2.4), r1 = m.v(0, 2.4, 2.4);
  const ins = [0, 1, 0];
  m.quad(a, d, r1, r0, ins); m.quad(b, c, r1, r0, ins); m.tri(a, b, r0, ins);
  m.tri(d, m.v(-0.7, 0, 2.2), r1, ins); m.tri(c, m.v(0.7, 0, 2.2), r1, ins); // doorway left open
  for (const s of [-1, 1]) m.add(cyl(0.03, 0.03, 3.6, 3, { top: false }), chain(T(0, 0, s * 2.6), Rx(s * 0.15)));
  return m;
}
export function car() {
  const m = new Mesh();
  m.add(box(4.0, 0.75, 1.7), T(0, 0.45, 0));
  const cab = box(2.1, 0.75, 1.55).displace((x, y, z) => [y > 0.1 ? x * 0.8 - 0.12 : x, y, y > 0.1 ? z * 0.92 : z]);
  m.add(cab, T(-0.25, 1.2, 0));
  for (const [x, z] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) m.add(cyl(0.38, 0.38, 0.22, 10, { bottom: true }), chain(T(x, 0.38, z), Rx(Math.PI / 2), T(0, -0.11, 0)));
  return m;
}
export function cottage() {
  const m = new Mesh();
  m.add(box(8, 4.5, 6)); m.add(gable(8.4, 6.6, 3.2), T(0, 4.5, 0)); m.add(box(0.9, 3, 0.9), T(2.4, 5.2, 1));
  return m;
}
export function hut() { // a round stone hut with a steep conical thatch
  const m = new Mesh();
  m.add(cyl(4, 3.8, 4, 12)); m.add(cyl(5, 0, 5, 12), T(0, 4, 0)); m.add(box(1, 3.5, 1), T(1.8, 6, -1.2));
  return m;
}
export function clockTower() {
  const m = new Mesh();
  m.add(box(12, 46, 12)); m.add(box(14, 2, 14), T(0, 44, 0));
  m.add(cyl(10, 0, 14, 4), chain(T(0, 46, 0), Ry(Math.PI / 4)));
  m.add(cyl(0.15, 0.15, 6, 4, { top: false }), T(0, 59, 0));
  return m;
}
/** A colonnade: two rows of pillars with arches as stepped blocks and a pitched roof per bay. */
export function cloister(length = 60, width = 8, height = 7, bay = 4, { roof = true } = {}) {
  const m = new Mesh();
  for (let x = -length / 2; x <= length / 2 + 0.01; x += bay) for (const s of [-1, 1]) {
    m.add(box(0.9, height, 0.9), T(x, 0, (s * width) / 2));
    if (x < length / 2 - 0.01) {
      m.add(box(bay, 1.2, 1), T(x + bay / 2, height, (s * width) / 2));
      m.add(box(bay * 0.55, 0.7, 1), T(x + bay / 2, height - 0.7, (s * width) / 2));
    }
  }
  if (roof) m.add(gable(length + bay, width + 2, 3), T(0, height + 1.2, 0));
  return m;
}
