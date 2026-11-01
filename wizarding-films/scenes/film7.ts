import type { SceneModule } from './types';
import { dim } from './kit';

/** Film 7: a lonely tent in a frozen forest. Desaturated, ash and snow. */
const film7: SceneModule = {
  async build(b) {
    const { kit, quality } = b;
    b.sky();
    const tree = kit.silhouette({ sway: true, heightMin: 0, heightRange: 90, snow: 0.7 });
    await Promise.all([
      b.mesh(`film-7/terrain_${quality.terrain}`, kit.silhouette({ heightMin: -5, heightRange: 100, snow: 1, rimPower: 5, rim: dim(kit.palette.rim, 0.5) })),
      b.instanced('kit/pine', 'film-7/pines', tree),
      b.instanced('kit/tree_dead', 'film-7/dead', kit.silhouette({ heightMin: 0, heightRange: 90, snow: 0.4 })),
      b.instanced('kit/rock', 'film-7/rocks', kit.silhouette({ heightMin: 0, heightRange: 90, snow: 0.9 }), { fraction: Math.max(0.5, quality.instanceFraction) }),
      b.instanced('kit/tent', 'film-7/tent', kit.silhouette({ heightMin: 5, heightRange: 6, low: '#3a3426', high: '#6e6550', rim: '#ffd9a0', snow: 0.5, doubleSide: true }), { fraction: 1 }),
      b.glows('film-7/tent_glow', kit.glow({ mode: 'window', color: '#ffb766', flicker: true, flickerSpeed: 3, flickerAmount: 0.25, intensity: 1.2 }), { fraction: 1 }),
    ]);
    b.water(130, -1.5, { wave: 0.05, deep: '#6b757c', spec: 0.3, cracks: 0.25 }, [-90, 60]);
    b.particles('snow');
    return {};
  },
};
export default film7;
