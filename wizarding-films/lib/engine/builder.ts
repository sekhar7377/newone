import {
  BufferAttribute, BufferGeometry, Group, InstancedMesh, Mesh, Object3D, PlaneGeometry, Points, SphereGeometry, type Material,
} from 'three';
import { loadSilhouette } from '@/lib/loaders/silhouette';
import { loadPlacements, instancedFromPlacements, type Placement } from '@/lib/loaders/placements';
import { forgetBinary } from '@/lib/loaders/fetchBinary';
import type { MaterialKit } from './materials';
import type { Quality } from '@/lib/quality';
import type { ParticleKind } from '@/scenes/palettes';

export type Updater = (time: number, dt: number) => void;

/**
 * Helper handed to every scene module. Loads geometry with progress tracking,
 * builds instanced sets in one call, and remembers every resource so the
 * whole scene disposes cleanly (geometry, materials, decoded buffers).
 */
export class SceneBuilder {
  root = new Group();
  updaters: Updater[] = [];
  files: string[] = [];
  private total = 0; private done = 0;
  private geoCache = new Map<string, Promise<BufferGeometry>>();
  private plcCache = new Map<string, Promise<Placement[]>>();

  constructor(public kit: MaterialKit, public quality: Quality, public signal: AbortSignal, private onProgress: (p: number) => void) {}

  private track<T>(p: Promise<T>): Promise<T> {
    this.total++;
    return p.then((v) => { this.done++; this.onProgress(this.done / this.total); return v; });
  }
  geo(name: string) {
    let p = this.geoCache.get(name);
    if (!p) { this.files.push(name + '.bin'); p = this.track(loadSilhouette(name, this.signal)); this.geoCache.set(name, p); }
    return p;
  }
  placements(name: string) {
    let p = this.plcCache.get(name);
    if (!p) { this.files.push(name + '.plc'); p = this.track(loadPlacements(name, this.signal)); this.plcCache.set(name, p); }
    return p;
  }

  async mesh(name: string, material: Material, parent: Object3D = this.root) {
    const m = new Mesh(await this.geo(name), material);
    m.userData.triangles = m.geometry.userData.triangles;
    parent.add(m); return m;
  }

  /** One draw call for the whole set. `fraction` defaults to the tier's instance share. */
  async instanced(meshName: string, plcName: string, material: Material, o: { fraction?: number; parent?: Object3D; filter?: (p: Placement) => boolean; map?: (p: Placement) => Placement } = {}) {
    const [g, list0] = await Promise.all([this.geo(meshName), this.placements(plcName)]);
    let list = o.filter ? list0.filter(o.filter) : list0;
    if (o.map) list = list.map(o.map);
    const m = instancedFromPlacements(g, material, list, o.fraction ?? this.quality.instanceFraction);
    (o.parent ?? this.root).add(m); return m;
  }

  /** Glow quads (windows, flames, beams) from a placement file. Never thinned below 60%. */
  async glows(plcName: string, material: Material, o: { fraction?: number; parent?: Object3D; map?: (p: Placement) => Placement } = {}) {
    return this.instanced('kit/window', plcName, material, { fraction: o.fraction ?? Math.max(0.6, this.quality.instanceFraction), parent: o.parent, map: o.map });
  }

  /** Glow quads from an in-code list (no placement file). */
  async glowList(list: Placement[], material: Material, parent: Object3D = this.root) {
    const m = instancedFromPlacements(await this.geo('kit/window'), material, list, 1);
    parent.add(m); return m;
  }

  sky() {
    const m = new Mesh(new SphereGeometry(4000, 32, 16), this.kit.sky());
    m.renderOrder = -10; m.frustumCulled = false;
    this.root.add(m);
    return m;
  }

  water(size: number, y: number, opts: Parameters<MaterialKit['water']>[0] = {}, at: [number, number] = [0, 0]) {
    const g = new PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2);
    const m = new Mesh(g, this.kit.water(opts)); m.position.set(at[0], y, at[1]);
    this.root.add(m); return m;
  }

  particles(kind: ParticleKind, o: { count?: number; color?: string; columns?: [number, number, number][] } = {}) {
    if (kind === 'none') return null;
    const base = this.quality.particles;
    const presets: Record<Exclude<ParticleKind, 'none'>, Parameters<MaterialKit['particles']>[0] & { share: number }> = {
      motes: { size: 1.1, velocity: [0.3, 0.1, 0.1], box: [140, 50, 140], turb: 1.5, additive: true, opacity: 0.6, share: 0.5 },
      fireflies: { size: 1.5, velocity: [0.1, 0.05, 0], box: [170, 40, 170], turb: 3, additive: true, flicker: true, share: 0.35 },
      snow: { size: 1.3, velocity: [0.8, -2.4, 0.4], box: [110, 60, 110], turb: 1.3, opacity: 0.85, soft: 0.8, share: 1 },
      embers: { size: 1.2, velocity: [0.8, 2.2, 0.3], box: [120, 60, 120], turb: 2.2, additive: true, flicker: true, share: 0.6 },
      rain: { size: 0.75, velocity: [2.0, -32, 0.6], box: [80, 60, 80], turb: 0.2, opacity: 0.45, soft: 0.6, share: 1 },
      dust: { size: 0.8, velocity: [0.1, 0.06, 0.1], box: [90, 40, 90], turb: 1, additive: true, opacity: 0.55, share: 0.5 },
      frost: { size: 1.0, velocity: [0.3, -0.5, 0.1], box: [100, 50, 100], turb: 2, additive: true, opacity: 0.5, share: 0.7 },
      ash: { size: 1.0, velocity: [0.5, -0.8, 0.2], box: [100, 50, 100], turb: 1.5, opacity: 0.6, share: 0.6 },
    };
    const pr = presets[kind];
    return this.addParticles({ ...pr, color: o.color, columns: o.columns }, o.count ?? Math.round(base * pr.share));
  }

  addParticles(opts: Parameters<MaterialKit['particles']>[0], count: number) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    const s = new Float32Array(count * 4); for (let i = 0; i < s.length; i++) s[i] = Math.random();
    g.setAttribute('aSeed4', new BufferAttribute(s, 4));
    const p = new Points(g, this.kit.particles(opts)); p.frustumCulled = false; p.renderOrder = 5;
    this.root.add(p); return p;
  }

  /** The castle prefab: silhouette + window glows + banners, positioned as a group. */
  async castle(pos: [number, number, number], o: { banners?: boolean; windows?: number; parent?: Object3D } = {}) {
    const g = new Group(); g.position.set(...pos); (o.parent ?? this.root).add(g);
    const sil = this.kit.silhouette({ heightMin: pos[1] - 20, heightRange: 140 });
    await Promise.all([
      this.mesh('kit/castle', sil, g),
      this.glows('kit/castle_windows', this.kit.glow({ mode: 'window', intensity: o.windows ?? 1, flicker: true, flickerSpeed: 0.6, flickerAmount: 0.12 }), { parent: g, fraction: 1 }),
      o.banners !== false ? this.instanced('kit/banner', 'kit/castle_banners', this.kit.silhouette({ flag: true, low: this.kit.palette.accent, high: this.kit.palette.accent, rim: this.kit.palette.rim, heightMin: 0, heightRange: 1e4 }), { parent: g, fraction: 1 }) : null,
    ]);
    return g;
  }

  onUpdate(fn: Updater) { this.updaters.push(fn); }

  triangles() {
    let t = 0;
    this.root.traverse((o) => { if ((o as Mesh).isMesh) t += (o as Mesh).userData.triangles ?? 0; });
    return t;
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as Mesh | InstancedMesh | Points;
      if ((m as Mesh).geometry) m.geometry.dispose();
      if ((m as InstancedMesh).isInstancedMesh) (m as InstancedMesh).dispose();
    });
    this.kit.dispose();
    this.root.removeFromParent();
    forgetBinary(this.files);
  }
}
