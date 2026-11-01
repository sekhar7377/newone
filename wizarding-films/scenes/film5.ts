import type { SceneModule } from './types';

/** Film 5: a hall of endless glowing glass shelves. Ministry black, cold blue glass. */
const film5: SceneModule = {
  async build(b) {
    const { kit } = b;
    b.sky();
    await Promise.all([
      b.instanced('kit/shelf', 'film-5/shelves', kit.silhouette({ low: '#010205', high: '#0d1a33', rim: '#4f7fe0', heightMin: 0, heightRange: 12, rimPower: 2.2 })),
      b.instanced('kit/orb', 'film-5/orbs', kit.orb({ color: '#8cc4ff', intensity: 1.15 })),
      b.glows('film-5/lamps', kit.glow({ mode: 'flame', color: '#6aa3ff', flicker: true, flickerSpeed: 0.5, flickerAmount: 0.2, inflate: 5, intensity: 0.7 }), { fraction: 1 }),
    ]);
    // polished stone floor: the water shader with almost no waves
    b.water(400, 0, { wave: 0.04, deep: '#010206', spec: 0.4, scale: 3 });
    b.particles('dust', { color: '#9cc8ff' });
    return {};
  },
};
export default film5;
