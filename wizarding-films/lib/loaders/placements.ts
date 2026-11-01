import { InstancedMesh, Matrix4, Quaternion, Vector3, InstancedBufferAttribute, BufferGeometry, Material, Box3, Sphere } from 'three';
import { fetchBinary } from './fetchBinary';

/** One instance transform from a PLC1 placement file. */
export interface Placement { p: [number, number, number]; q: [number, number, number, number]; s: [number, number, number] }

export function parsePlacements(buf: ArrayBuffer): Placement[] {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'PLC1') throw new Error('Not a PLC1 file');
  const count = dv.getUint32(8, true), stride = dv.getUint32(12, true);
  const out: Placement[] = new Array(count);
  for (let i = 0, o = 16; i < count; i++, o += stride) {
    const f = (k: number) => dv.getFloat32(o + k, true), q = (k: number) => dv.getInt16(o + 12 + k, true) / 32767;
    out[i] = { p: [f(0), f(4), f(8)], q: [q(0), q(2), q(4), q(6)], s: [f(20), f(24), f(28)] };
  }
  return out;
}

export async function loadPlacements(path: string, signal?: AbortSignal) {
  return parsePlacements(await fetchBinary(path + '.plc', signal));
}

const _m = new Matrix4(), _p = new Vector3(), _q = new Quaternion(), _s = new Vector3();

/**
 * Build an InstancedMesh from placements: one draw call for the whole set.
 * `fraction` thins the set for lower quality tiers; the exporter shuffles the
 * order, so the first N are an even spread. Adds a per-instance `aSeed`
 * attribute (0..1) used by shaders for phase/flicker offsets.
 */
export function instancedFromPlacements(geometry: BufferGeometry, material: Material, list: Placement[], fraction = 1): InstancedMesh {
  const n = Math.max(1, Math.round(list.length * Math.min(1, fraction)));
  // Shallow copy: shares the position/index buffers but owns its aSeed
  // attribute, so one kit mesh can back several instanced sets.
  const g = new BufferGeometry();
  g.setAttribute('position', geometry.getAttribute('position'));
  g.setIndex(geometry.getIndex());
  g.boundingBox = geometry.boundingBox; g.boundingSphere = geometry.boundingSphere;
  g.userData = { ...geometry.userData };
  const mesh = new InstancedMesh(g, material, n);
  const seeds = new Float32Array(n);
  const box = new Box3();
  for (let i = 0; i < n; i++) {
    const it = list[i];
    _p.set(it.p[0], it.p[1], it.p[2]); _q.set(it.q[0], it.q[1], it.q[2], it.q[3]).normalize(); _s.set(it.s[0], it.s[1], it.s[2]);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    seeds[i] = fract(Math.sin(i * 12.9898 + it.p[0] * 0.13 + it.p[2] * 0.07) * 43758.5453);
    box.expandByPoint(_p);
  }
  g.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
  mesh.instanceMatrix.needsUpdate = true;
  // Frustum culling for the whole batch uses an expanded bounds of all instances.
  let maxS = 1; for (let i = 0; i < n; i++) maxS = Math.max(maxS, list[i].s[0], list[i].s[1], list[i].s[2]);
  const r = geometry.boundingSphere ? geometry.boundingSphere.radius * maxS : 10;
  mesh.boundingSphere = box.getBoundingSphere(new Sphere());
  mesh.boundingSphere.radius += r;
  mesh.userData.triangles = (geometry.userData.triangles ?? 0) * n;
  return mesh;
}

const fract = (v: number) => v - Math.floor(v);
