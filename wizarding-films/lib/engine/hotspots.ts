import { InstancedBufferAttribute, InstancedMesh, Matrix4, PerspectiveCamera, PlaneGeometry, Vector3, type CatmullRomCurve3, type Material } from 'three';

export interface Anchor { id: string; position: Vector3; t: number; isNew?: boolean }

/** Resolve an authored position: absolute, or `at` + `offset` along the path. */
export function resolvePosition(item: { position?: number[]; at?: number; offset?: number[] }, curve: CatmullRomCurve3 | null): Vector3 {
  if (item.position) return new Vector3(item.position[0], item.position[1], item.position[2]);
  const v = curve ? curve.getPointAt(((item.at ?? 0) % 1 + 1) % 1) : new Vector3();
  if (item.offset) v.add(new Vector3(item.offset[0], item.offset[1], item.offset[2]));
  return v;
}

/** Path parameter nearest to a point (sampled). */
export function nearestT(curve: CatmullRomCurve3 | null, p: Vector3, samples = 500): number {
  if (!curve) return 0;
  let best = 0, bd = Infinity; const q = new Vector3();
  for (let i = 0; i < samples; i++) { curve.getPointAt(i / samples, q); const d = q.distanceToSquared(p); if (d < bd) { bd = d; best = i / samples; } }
  return best;
}

/**
 * Glowing runes in 3D (one instanced draw call) + DOM buttons projected on
 * top of them each frame. The buttons are what the visitor actually clicks or
 * tabs to, so keyboard and screen-reader access come for free and no
 * raycasting is needed.
 */
export class AnchorSet {
  mesh: InstancedMesh;
  private state: InstancedBufferAttribute;
  private els = new Map<string, HTMLElement>();
  private _v = new Vector3(); private _cam = new Vector3();
  hovered: string | null = null;
  nearId: string | null = null;

  constructor(public anchors: Anchor[], material: Material, private o: { maxDist: number; nearDist: number; minVisible?: number }) {
    const g = new PlaneGeometry(1, 1);
    const n = Math.max(1, anchors.length);
    this.mesh = new InstancedMesh(g, material, n);
    const m = new Matrix4(); const seeds = new Float32Array(n); const st = new Float32Array(n * 3);
    anchors.forEach((a, i) => { this.mesh.setMatrixAt(i, m.makeTranslation(a.position.x, a.position.y, a.position.z)); seeds[i] = (i * 0.618) % 1; st[i * 3 + 1] = a.isNew ? 1 : 0; st[i * 3 + 2] = 0; });
    if (!anchors.length) this.mesh.count = 0;
    g.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    this.state = new InstancedBufferAttribute(st, 3); g.setAttribute('aState', this.state);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
    this.mesh.userData.triangles = n * 2;
  }

  bind(els: Map<string, HTMLElement>) { this.els = els; }

  update(camera: PerspectiveCamera, width: number, height: number, focused: string | null) {
    this._cam.copy(camera.position);
    let near: string | null = null, nd = this.o.nearDist;
    const arr = this.state.array as Float32Array;
    let dirty = false;
    this.anchors.forEach((a, i) => {
      const d = a.position.distanceTo(this._cam);
      const vis = d < this.o.maxDist ? 1 : Math.max(0, 1 - (d - this.o.maxDist) / 30);
      const on = a.id === this.hovered || a.id === focused ? 1 : d < this.o.nearDist ? 0.5 : 0;
      if (d < nd) { this._v.copy(a.position).project(camera); if (Math.abs(this._v.x) < 0.9 && Math.abs(this._v.y) < 0.9 && this._v.z < 1) { nd = d; near = a.id; } }
      if (arr[i * 3] !== on || Math.abs(arr[i * 3 + 2] - vis) > 0.01) { arr[i * 3] = on; arr[i * 3 + 2] = vis; dirty = true; }
      const el = this.els.get(a.id);
      if (!el) return;
      this._v.copy(a.position).project(camera);
      const inFront = this._v.z < 1 && this._v.z > -1;
      const shown = inFront && vis > 0.05 && Math.abs(this._v.x) < 1.1 && Math.abs(this._v.y) < 1.1;
      const x = (this._v.x * 0.5 + 0.5) * width, y = (-this._v.y * 0.5 + 0.5) * height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (el.dataset.shown !== String(shown)) el.dataset.shown = String(shown);
      const isNear = String(a.id === near);
      if (el.dataset.near !== isNear) el.dataset.near = isNear;
    });
    if (dirty) this.state.needsUpdate = true;
    this.nearId = near;
    return near;
  }

  setNew(id: string, isNew: boolean) {
    const i = this.anchors.findIndex((a) => a.id === id); if (i < 0) return;
    (this.state.array as Float32Array)[i * 3 + 1] = isNew ? 1 : 0; this.state.needsUpdate = true;
  }
  setPosition(id: string, p: Vector3) {
    const i = this.anchors.findIndex((a) => a.id === id); if (i < 0) return;
    this.anchors[i].position.copy(p);
    this.mesh.setMatrixAt(i, new Matrix4().makeTranslation(p.x, p.y, p.z)); this.mesh.instanceMatrix.needsUpdate = true;
  }
  remove(id: string) {
    const i = this.anchors.findIndex((a) => a.id === id); if (i < 0) return;
    const m = new Matrix4().makeScale(0, 0, 0); this.mesh.setMatrixAt(i, m); this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this.mesh.dispose(); }
}
