import { BufferAttribute, BufferGeometry, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import type { IllustrationData, Stroke } from '@/lib/content';

/**
 * Stroke format: centreline points (centimetres, relative to the illustration
 * origin, flat [x,y,z,...] ints) plus one relative width per point (0..255).
 * Far smaller than SVG or PNG. This builds the ribbon: two vertices per
 * point; expansion and draw-in happen in shaders/line.glsl.ts.
 */
export function buildRibbonGeometry(strokes: Stroke[], unit = 0.01): BufferGeometry {
  let total = 0;
  const lens: number[][] = [];
  for (const s of strokes) {
    const l = [0];
    for (let i = 3; i < s.p.length; i += 3) total += Math.hypot(s.p[i] - s.p[i - 3], s.p[i + 1] - s.p[i - 2], s.p[i + 2] - s.p[i - 1]) * unit, l.push(total);
    lens.push(l);
    total += 0.0001;
  }
  total = Math.max(total, 1e-4);
  const pos: number[] = [], tan: number[] = [], side: number[] = [], width: number[] = [], dist: number[] = [], idx: number[] = [];
  let v = 0;
  strokes.forEach((s, si) => {
    const n = s.p.length / 3;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      const tx = s.p[b * 3] - s.p[a * 3], ty = s.p[b * 3 + 1] - s.p[a * 3 + 1], tz = s.p[b * 3 + 2] - s.p[a * 3 + 2];
      const w = (s.w[i] ?? 128) / 255, d = lens[si][i] / total;
      for (const sd of [-1, 1]) { pos.push(s.p[i * 3] * unit, s.p[i * 3 + 1] * unit, s.p[i * 3 + 2] * unit); tan.push(tx, ty, tz); side.push(sd); width.push(w); dist.push(d); }
      if (i < n - 1) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      v += 2;
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aTangent', new BufferAttribute(new Float32Array(tan), 3));
  g.setAttribute('aSide', new BufferAttribute(new Float32Array(side), 1));
  g.setAttribute('aWidth', new BufferAttribute(new Float32Array(width), 1));
  g.setAttribute('aDist', new BufferAttribute(new Float32Array(dist), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 1;
  g.userData.triangles = idx.length / 3;
  return g;
}

/** A drawing beside a hotspot. Yaw-faces the camera and draws itself in when near. */
export class LineIllustration {
  group = new Group();
  mesh: Mesh;
  progress = 0;
  target = 0;
  duration: number;
  constructor(public data: IllustrationData, material: ShaderMaterial, anchor: Vector3) {
    const g = buildRibbonGeometry(data.strokes);
    this.mesh = new Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.userData.triangles = g.userData.triangles;
    this.mesh.renderOrder = 8;
    this.group.add(this.mesh);
    this.group.position.copy(anchor).add(new Vector3(...data.offset));
    this.group.scale.setScalar(data.scale);
    this.duration = 1.6 + data.strokes.length * 0.12;
  }
  setVisible(on: boolean) { this.target = on ? 1 : 0; }
  update(dt: number, camPos: Vector3, reduced: boolean) {
    const speed = this.target > this.progress ? 1 / this.duration : 2;
    this.progress = reduced ? this.target : Math.max(0, Math.min(1, this.progress + Math.sign(this.target - this.progress) * speed * dt));
    const m = this.mesh.material as ShaderMaterial;
    m.uniforms.uProgress.value = this.progress;
    m.uniforms.uOpacity.value = this.target === 0 ? this.progress : 1;
    this.group.visible = this.progress > 0.001;
    if (this.group.visible) this.group.rotation.y = Math.atan2(camPos.x - this.group.position.x, camPos.z - this.group.position.z);
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as ShaderMaterial).dispose(); }
}
