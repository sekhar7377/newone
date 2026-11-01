import type { SceneModule } from './types';
import { grounds } from './kit';

/** Film 3: clock tower and courtyard on the west spur, a misty hillside hut, frost in the air. */
const film3: SceneModule = {
  async build(b) {
    const { kit } = b;
    const stone = kit.silhouette({ heightMin: 30, heightRange: 70 });
    const [, , court, hut, , willow] = await Promise.all([
      grounds(b, { castleWindows: 0.8, water: { wave: 0.25, deep: '#152030' } }),
      b.mesh('kit/clocktower', stone).then((m) => { m.position.set(-165, 44, -255); m.updateMatrixWorld(); return m; }),
      b.mesh('film-3/courtyard', stone),
      b.mesh('kit/hut', kit.silhouette({ heightMin: 25, heightRange: 30 })),
      b.glows('film-3/clock_faces', kit.glow({ mode: 'window', color: '#e9f3ff', intensity: 0.8, inflate: 0.8, halo: 2.5 }), { fraction: 1 }),
      b.mesh('kit/willow', kit.silhouette({ sway: true, heightMin: 20, heightRange: 30 })),
      b.glows('film-3/hut_windows', kit.glow({ mode: 'window', color: '#ffc06a', flicker: true }), { fraction: 1 }),
      b.instanced('kit/rock', 'film-3/pumpkins', kit.silhouette({ low: '#5a2a08', high: '#c0641c', rim: '#ffb066', heightMin: 30, heightRange: 10 }), { fraction: 1 }),
    ]);
    court.position.set(-165, 44, -226);
    hut.position.set(240, 34.5, -140);
    willow.position.set(170, 31, -172); willow.scale.setScalar(1.6);
    b.particles('frost');
    b.particles('motes', { count: Math.round(b.quality.particles * 0.2), color: '#cfe2ff' });
    return {};
  },
};
export default film3;
