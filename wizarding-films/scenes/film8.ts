import type { SceneModule } from './types';
import { grounds } from './kit';

/** Film 8: the grounds at dawn after the battle. Smoke, embers, the broken bridge. */
const film8: SceneModule = {
  async build(b) {
    const { kit } = b;
    await Promise.all([
      grounds(b, { bridge: 'broken', castleWindows: 0.5, water: { wave: 0.35, deep: '#24110f', spec: 1.8 } }),
      b.instanced('kit/rock', 'film-8/rubble', kit.silhouette({ heightMin: 30, heightRange: 30 }), { fraction: Math.max(0.6, b.quality.instanceFraction) }),
    ]);
    const smoke: [number, number, number][] = [[30, 90, -310], [-45, 70, -340], [70, 60, -280], [-80, 60, -300], [10, 60, -255], [150, 40, -300]];
    b.addParticles({ size: 14, velocity: [0, 0, 0], box: [1, 1, 1], columns: smoke, life: 26, rise: 150, opacity: 0.28, soft: 1.2, color: '#2a1714' }, Math.round(b.quality.particles * 0.25));
    b.particles('embers');
    return {
      outro: {
        // rise from the lake toward the low dawn sun
        points: [[0, 22, 190], [60, 60, 250], [210, 150, 330], [420, 240, 420]],
        look: [[60, 25, 160], [300, 60, 300], [620, 90, 500], [900, 100, 640]],
        duration: 9,
      },
    };
  },
};
export default film8;
