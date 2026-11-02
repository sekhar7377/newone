import * as THREE from 'three';
import { CP, rng, type StrandSpec } from '../layout/strands';
import { settings } from './runtime';

/**
 * Per-control-point spring simulation. Strands drift slowly, and a pointer ray
 * pushes nearby points aside; springs bring them back. Results go into a float
 * texture the shaders sample, so geometry is never rebuilt.
 */
export class StrandSim {
  readonly count: number;
  readonly pointsTex: THREE.DataTexture;
  readonly infoTex: THREE.DataTexture;
  readonly data: Float32Array; // CP*count RGBA
  readonly info: Float32Array; // 4*count RGBA
  private offset: Float32Array;
  private vel: Float32Array;
  private axis: Float32Array;

  constructor(readonly specs: StrandSpec[]) {
    this.count = specs.length;
    this.data = new Float32Array(this.count * CP * 4);
    this.offset = new Float32Array(this.count * CP * 3);
    this.vel = new Float32Array(this.count * CP * 3);
    this.axis = new Float32Array(this.count * 3);
    this.info = new Float32Array(this.count * 16);
    specs.forEach((s, i) => {
      const r = rng(s.seed ^ 0xabc);
      this.info.set([s.phase, s.look.brightness, r(), s.speed], i * 16);
      this.info.set([s.look.glint, s.look.pulse, s.parent >= 0 ? 1 : 0, s.look.energy], i * 16 + 4);
      this.info.set([s.growStart, s.growDur, s.look.width, 0], i * 16 + 8);
      this.info.set([1, 0, 0, 0], i * 16 + 12);
      const tip = new THREE.Vector3().fromArray(s.rest, (CP - 1) * 3).normalize();
      const a = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).cross(tip).normalize();
      this.axis.set([a.x, a.y, a.z], i * 3);
    });
    this.pointsTex = new THREE.DataTexture(this.data, CP, this.count, THREE.RGBAFormat, THREE.FloatType);
    this.infoTex = new THREE.DataTexture(this.info, 4, this.count, THREE.RGBAFormat, THREE.FloatType);
    this.infoTex.needsUpdate = true;
    this.update(0, 0, null, 0);
  }

  /** Smoothly move per-strand visibility/highlight toward targets. */
  setVisual(i: number, vis: number, hl: number, dt: number) {
    const o = i * 16 + 12;
    const k = 1 - Math.exp(-dt / 0.18);
    this.info[o] += (vis - this.info[o]) * k;
    this.info[o + 1] += (hl - this.info[o + 1]) * k;
  }
  commitInfo() {
    this.infoTex.needsUpdate = true;
  }
  visibility(i: number) {
    return this.info[i * 16 + 12];
  }

  update(dt: number, t: number, ray: THREE.Ray | null, presence: number) {
    const { motionAmount, interactionRadius, interactionForce, damping, spring } = settings;
    const h = Math.min(dt, 1 / 30);
    const o = ray?.origin;
    const d = ray?.direction;
    for (let s = 0; s < this.count; s++) {
      const sp = this.specs[s];
      const ph = sp.phase;
      const sway = Math.sin(t * 0.16 * sp.speed + ph) * 0.5 + Math.sin(t * 0.071 * sp.speed + ph * 1.7) * 0.5;
      const scale = (sp.length / 4.2) * sp.look.energy;
      const ax = this.axis[s * 3], ay = this.axis[s * 3 + 1], az = this.axis[s * 3 + 2];
      // branches ride on their parent's motion at the fork point
      let bx = 0, by = 0, bz = 0;
      if (sp.parent >= 0) {
        const pi = (sp.parent * CP + 6) * 4;
        const pr = this.specs[sp.parent].rest;
        bx = this.data[pi] - pr[18];
        by = this.data[pi + 1] - pr[19];
        bz = this.data[pi + 2] - pr[20];
      }
      for (let k = 0; k < CP; k++) {
        const c = s * CP + k;
        const w = k / (CP - 1);
        let x = sp.rest[k * 3] + bx, y = sp.rest[k * 3 + 1] + by, z = sp.rest[k * 3 + 2] + bz;
        if (k > 0) {
          const tt = t * 0.075 * sp.speed;
          const amp = motionAmount * 0.3 * w ** 1.45 * scale;
          x += amp * Math.sin(w * 1.15 * 2.1 + ph + tt * 1.3);
          y += amp * Math.sin(w * 1.15 * 1.7 + ph * 1.3 + 13.7 + tt);
          z += amp * Math.sin(w * 1.15 * 2.5 + ph * 0.7 + 27.1 + tt * 0.8);
          const sw = motionAmount * 0.32 * w ** 1.8 * scale * sway;
          x += ax * sw; y += ay * sw; z += az * sw;

          const i3 = c * 3;
          let ox = this.offset[i3], oy = this.offset[i3 + 1], oz = this.offset[i3 + 2];
          let fx = -spring * ox - damping * this.vel[i3];
          let fy = -spring * oy - damping * this.vel[i3 + 1];
          let fz = -spring * oz - damping * this.vel[i3 + 2];
          // keep neighbours together (string tension)
          const nx = k < CP - 1 ? this.offset[i3 + 3] : ox, ny = k < CP - 1 ? this.offset[i3 + 4] : oy, nz = k < CP - 1 ? this.offset[i3 + 5] : oz;
          const px = k > 1 ? this.offset[i3 - 3] : 0, py = k > 1 ? this.offset[i3 - 2] : 0, pz = k > 1 ? this.offset[i3 - 1] : 0;
          fx += 6 * (px + nx - 2 * ox); fy += 6 * (py + ny - 2 * oy); fz += 6 * (pz + nz - 2 * oz);
          if (o && d && presence > 0.001) {
            const ex = x + ox - o.x, ey = y + oy - o.y, ez = z + oz - o.z;
            const along = ex * d.x + ey * d.y + ez * d.z;
            const rx = ex - d.x * along, ry = ey - d.y * along, rz = ez - d.z * along;
            const dist = Math.hypot(rx, ry, rz);
            if (dist < interactionRadius && dist > 1e-4) {
              const f = 1 - dist / interactionRadius;
              const push = interactionForce * 9 * f * f * presence * w ** 0.7;
              fx += (rx / dist) * push; fy += (ry / dist) * push; fz += (rz / dist) * push;
            }
          }
          this.vel[i3] += fx * h; this.vel[i3 + 1] += fy * h; this.vel[i3 + 2] += fz * h;
          ox += this.vel[i3] * h; oy += this.vel[i3 + 1] * h; oz += this.vel[i3 + 2] * h;
          const len = Math.hypot(ox, oy, oz), max = 1.4 * w;
          if (len > max) { const m = max / len; ox *= m; oy *= m; oz *= m; }
          this.offset[i3] = ox; this.offset[i3 + 1] = oy; this.offset[i3 + 2] = oz;
          x += ox; y += oy; z += oz;
        }
        this.data.set([x, y, z, w], c * 4);
      }
    }
    this.pointsTex.needsUpdate = true;
  }

  /** World position of control point k on strand s. */
  point(s: number, k: number, out: THREE.Vector3) {
    const i = (s * CP + k) * 4;
    return out.set(this.data[i], this.data[i + 1], this.data[i + 2]);
  }

  dispose() {
    this.pointsTex.dispose();
    this.infoTex.dispose();
  }
}

/** Two-sided ribbons: one primary fibre plus `hairs` thinner fibres per strand. */
export function ribbonGeometry(specs: StrandSpec[], hairs: number, segments: number) {
  const nHairs = (s: StrandSpec) => (s.parent >= 0 ? Math.ceil(hairs / 2) : hairs);
  const fibres = specs.reduce((n, s) => n + 1 + nHairs(s), 0);
  const vpf = (segments + 1) * 2;
  const meta = new Float32Array(fibres * vpf * 4);
  const hair = new Float32Array(fibres * vpf * 4);
  const index = new Uint32Array(fibres * segments * 6);
  let v = 0, ii = 0;
  for (const s of specs) {
    const r = rng(s.seed ^ 0x9e3779b9);
    for (let f = 0; f <= nHairs(s); f++) {
      const kind = f === 0 ? 0 : 1;
      const hs = f === 0 ? [0, 0, 0, 1] : hairOffset(r);
      const base = v;
      for (let k = 0; k <= segments; k++) {
        for (const side of [-1, 1]) {
          meta.set([s.index, k / segments, side, kind], v * 4);
          hair.set(hs, v * 4);
          v++;
        }
      }
      for (let k = 0; k < segments; k++) {
        const a = base + k * 2;
        index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ii);
        ii += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v * 3), 3));
  g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4));
  g.setAttribute('aHair', new THREE.BufferAttribute(hair, 4));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  return g;
}

/** Tip dots for every fibre plus a few beads that travel outward. */
export function pointsGeometry(specs: StrandSpec[], hairs: number, beads = 2) {
  const meta: number[] = [];
  const hair: number[] = [];
  for (const s of specs) {
    const r = rng(s.seed ^ 0x9e3779b9);
    const n = s.parent >= 0 ? Math.ceil(hairs / 2) : hairs;
    for (let f = 0; f <= n; f++) {
      meta.push(s.index, 1, f === 0 ? 0.034 : 0.018, f === 0 ? 0 : 1);
      hair.push(...(f === 0 ? [0, 0, 0, 1] : hairOffset(r)));
    }
    const rb = rng(s.seed ^ 0x51ed27);
    for (let b = 0; b < beads; b++) {
      meta.push(s.index, -(rb() * 0.999 + 5e-4), 0.022, 0);
      hair.push(0, 0, 0, 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(meta.length / 4 * 3), 3));
  g.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 4));
  g.setAttribute('aHair', new THREE.Float32BufferAttribute(hair, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  return g;
}

function hairOffset(r: () => number): number[] {
  const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
  const m = r() ** 0.7;
  return [v.x * m, v.y * m, v.z * m, r()];
}
