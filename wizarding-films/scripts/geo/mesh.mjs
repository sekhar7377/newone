// Position-only mesh builder + primitives. No UVs, no normals: shading is
// derived in the shader from screen-space derivatives, height and fog.
import { apply, rng, fbm } from './math.mjs';

export class Mesh {
  constructor() { this.p = []; this.i = []; }
  get vertexCount() { return this.p.length / 3; }
  get triCount() { return this.i.length / 3; }
  v(x, y, z) { this.p.push(x, y, z); return this.vertexCount - 1; }
  pos(i) { return [this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]]; }
  // Add a triangle, flipping it if needed so its normal points away from `inside`.
  tri(a, b, c, inside) {
    if (inside) {
      const A = this.pos(a), B = this.pos(b), C = this.pos(c);
      const n = cross(sub(B, A), sub(C, A));
      const cen = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
      if (dot(n, sub(cen, inside)) < 0) { this.i.push(a, c, b); return; }
    }
    this.i.push(a, b, c);
  }
  quad(a, b, c, d, inside) { this.tri(a, b, c, inside); this.tri(a, c, d, inside); }
  add(other, m) {
    const base = this.vertexCount;
    for (let k = 0; k < other.p.length; k += 3) {
      const q = m ? apply(m, [other.p[k], other.p[k + 1], other.p[k + 2]]) : [other.p[k], other.p[k + 1], other.p[k + 2]];
      this.p.push(q[0], q[1], q[2]);
    }
    // A mirroring matrix flips winding; detect via determinant sign.
    const flip = m ? det3(m) < 0 : false;
    for (let k = 0; k < other.i.length; k += 3) {
      if (flip) this.i.push(other.i[k] + base, other.i[k + 2] + base, other.i[k + 1] + base);
      else this.i.push(other.i[k] + base, other.i[k + 1] + base, other.i[k + 2] + base);
    }
    return this;
  }
  displace(fn) { for (let k = 0; k < this.p.length; k += 3) { const q = fn(this.p[k], this.p[k + 1], this.p[k + 2]); this.p[k] = q[0]; this.p[k + 1] = q[1]; this.p[k + 2] = q[2]; } return this; }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const det3 = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);

/** Axis-aligned box centred on x/z, sitting on y=0. */
export function box(w, h, d) {
  const m = new Mesh(); const x = w / 2, z = d / 2;
  const c = [
    m.v(-x, 0, -z), m.v(x, 0, -z), m.v(x, 0, z), m.v(-x, 0, z),
    m.v(-x, h, -z), m.v(x, h, -z), m.v(x, h, z), m.v(-x, h, z),
  ];
  const ins = [0, h / 2, 0];
  m.quad(c[0], c[1], c[2], c[3], ins); m.quad(c[4], c[5], c[6], c[7], ins);
  m.quad(c[0], c[1], c[5], c[4], ins); m.quad(c[1], c[2], c[6], c[5], ins);
  m.quad(c[2], c[3], c[7], c[6], ins); m.quad(c[3], c[0], c[4], c[7], ins);
  return m;
}

/** Cylinder / frustum / cone from y=0 to y=h. rt = 0 gives a cone. */
export function cyl(rb, rt, h, seg = 8, { top = true, bottom = false, jitter = 0, seed = 1 } = {}) {
  const m = new Mesh(); const r = rng(seed);
  const b = [], t = [];
  for (let s = 0; s < seg; s++) {
    const a = (s / seg) * Math.PI * 2; const j = 1 + (r() - 0.5) * jitter;
    b.push(m.v(Math.cos(a) * rb * j, 0, Math.sin(a) * rb * j));
  }
  if (rt > 0) for (let s = 0; s < seg; s++) { const a = (s / seg) * Math.PI * 2; t.push(m.v(Math.cos(a) * rt, h, Math.sin(a) * rt)); }
  const apex = rt > 0 ? -1 : m.v(0, h, 0);
  for (let s = 0; s < seg; s++) {
    const n = (s + 1) % seg; const ins = [0, h * 0.5, 0];
    if (rt > 0) m.quad(b[s], b[n], t[n], t[s], ins); else m.tri(b[s], b[n], apex, [0, h * 0.3, 0]);
  }
  if (top && rt > 0) { const c = m.v(0, h, 0); for (let s = 0; s < seg; s++) m.tri(t[s], t[(s + 1) % seg], c, [0, -1, 0]); }
  if (bottom) { const c = m.v(0, 0, 0); for (let s = 0; s < seg; s++) m.tri(b[s], b[(s + 1) % seg], c, [0, 1, 0]); }
  return m;
}

/** Gable roof: ridge along X, width (z) d, length w, height h. Sits on y=0. */
export function gable(w, d, h) {
  const m = new Mesh(); const x = w / 2, z = d / 2;
  const a = m.v(-x, 0, -z), b = m.v(x, 0, -z), c = m.v(x, 0, z), e = m.v(-x, 0, z), r0 = m.v(-x, h, 0), r1 = m.v(x, h, 0);
  const ins = [0, h * 0.3, 0];
  m.quad(a, b, r1, r0, ins); m.quad(e, c, r1, r0, ins); m.tri(a, e, r0, ins); m.tri(b, c, r1, ins);
  return m;
}

/** Icosphere-ish blob (subdivided octahedron) with optional noise. */
export function blob(r = 1, sub = 1, noise = 0, seed = 3) {
  const m = new Mesh();
  let verts = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  let faces = [[0,2,4],[4,2,1],[1,2,5],[5,2,0],[0,4,3],[4,1,3],[1,5,3],[5,0,3]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map(); const nf = [];
    const mid = (i, j) => { const k = i < j ? `${i}_${j}` : `${j}_${i}`; if (cache.has(k)) return cache.get(k);
      const a = verts[i], b = verts[j]; const p = [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]; const l = Math.hypot(...p);
      verts.push(p.map((q) => q / l)); cache.set(k, verts.length - 1); return verts.length - 1; };
    for (const [a, b, c] of faces) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = nf;
  }
  const r2 = rng(seed); const off = r2() * 100;
  for (const v of verts) { const n = noise ? 1 + (fbm(v[0] * 2 + off, v[2] * 2 + v[1] * 1.7 + off, 2) - 0.5) * noise : 1; m.v(v[0] * r * n, v[1] * r * n, v[2] * r * n); }
  for (const [a, b, c] of faces) m.tri(a, b, c, [0, 0, 0]);
  return m;
}

/** Flat grid in the XY plane, x 0..w (pole at x=0), y 0..-h. For banners. */
export function gridXY(w, h, sx, sy) {
  const m = new Mesh();
  for (let j = 0; j <= sy; j++) for (let i = 0; i <= sx; i++) m.v((i / sx) * w, -(j / sy) * h, 0);
  for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
    const a = j * (sx + 1) + i, b = a + 1, c = a + sx + 2, d = a + sx + 1; m.i.push(a, d, b, b, d, c);
  }
  return m;
}

/** Unit quad in XY, centred, facing +Z. Used for window / flame glow instances. */
export function quad() {
  const m = new Mesh();
  m.v(-0.5, -0.5, 0); m.v(0.5, -0.5, 0); m.v(0.5, 0.5, 0); m.v(-0.5, 0.5, 0);
  m.i.push(0, 1, 2, 0, 2, 3); return m;
}

/** Heightfield terrain, `size` metres square centred on the origin. */
export function terrain(size, res, heightFn) {
  const m = new Mesh(); const h = size / 2;
  for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) {
    const x = -h + (i / res) * size, z = -h + (j / res) * size; m.v(x, heightFn(x, z), z);
  }
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const a = j * (res + 1) + i, b = a + 1, c = a + res + 2, d = a + res + 1;
    // CCW seen from +Y: a -> d -> c, a -> c -> b  (z grows "down" toward the viewer)
    m.i.push(a, d, c, a, c, b);
  }
  return m;
}

/** Lofted hull from cross-sections (array of [z, halfWidth, depth]). */
export function hull(sections, { deck = true } = {}) {
  const m = new Mesh(); const ring = [];
  for (const [z, w, d] of sections) {
    ring.push([m.v(-w, 0.15 * d, z), m.v(-w * 0.75, -d * 0.7, z), m.v(0, -d, z), m.v(w * 0.75, -d * 0.7, z), m.v(w, 0.15 * d, z)]);
  }
  for (let s = 0; s < ring.length - 1; s++) for (let k = 0; k < 4; k++) {
    const z = (sections[s][0] + sections[s + 1][0]) / 2; m.quad(ring[s][k], ring[s][k + 1], ring[s + 1][k + 1], ring[s + 1][k], [0, 2, z]);
  }
  if (deck) for (let s = 0; s < ring.length - 1; s++) { const z = (sections[s][0] + sections[s + 1][0]) / 2; m.quad(ring[s][0], ring[s][4], ring[s + 1][4], ring[s + 1][0], [0, -5, z]); }
  return m;
}
