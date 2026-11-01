import { Vector3 } from 'three';
import type { SceneBuilder } from '@/lib/engine/builder';
import { Color } from 'three';

/** A darker shade of a palette colour (terrain gets a softer rim than props). */
export const dim = (hex: string, k: number) => '#' + new Color(hex).multiplyScalar(k).getHexString();

export const CASTLE_POS: [number, number, number] = [0, 46, -300];
export const ASTRONOMY_TOWER = new Vector3(45, 46, -325);

/**
 * The shared castle grounds: terrain, lake, castle, forest scatter. Used by
 * the hub and films 1, 3, 4, 6 and 8, each with its own palette and extras.
 */
export async function grounds(b: SceneBuilder, o: { forest?: number; bridge?: 'whole' | 'broken' | 'none'; castleWindows?: number; banners?: boolean; water?: Parameters<SceneBuilder['water']>[2] } = {}) {
  const { kit, quality } = b;
  b.sky();
  const terrainMat = kit.silhouette({ heightMin: -15, heightRange: 260, rimPower: 5, rim: dim(kit.palette.rim, 0.45) });
  const treeMat = kit.silhouette({ sway: true, heightMin: 0, heightRange: 200 });
  const rockMat = kit.silhouette({ heightMin: -10, heightRange: 200 });
  const f = (o.forest ?? 1) * quality.instanceFraction;
  const jobs: Promise<unknown>[] = [
    b.mesh(`grounds/terrain_${quality.terrain}`, terrainMat),
    b.castle(CASTLE_POS, { windows: o.castleWindows, banners: o.banners }),
    b.instanced('kit/pine', 'grounds/pines', treeMat, { fraction: f }),
    b.instanced('kit/tree_round', 'grounds/trees_round', treeMat, { fraction: f }),
    b.instanced('kit/rock', 'grounds/rocks', rockMat, { fraction: Math.max(0.5, f) }),
  ];
  if (o.bridge !== 'none') jobs.push(b.mesh(o.bridge === 'broken' ? 'grounds/bridge_broken' : 'grounds/bridge', kit.silhouette({ heightMin: 0, heightRange: 120 })));
  b.water(1700, 0, o.water);
  await Promise.all(jobs);
}
