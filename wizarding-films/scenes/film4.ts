import type { SceneModule } from './types';
import { grounds } from './kit';

/** Film 4: a tournament maze of hedges, the black lake, and dragon-fire light beyond. */
const film4: SceneModule = {
  async build(b) {
    const { kit } = b;
    await Promise.all([
      grounds(b, { forest: 0.85, water: { wave: 0.7, deep: '#01100f', spec: 1.6 } }),
      b.instanced('kit/hedge', 'film-4/hedges', kit.silhouette({ low: '#020807', high: '#0f2a26', rim: '#3d8f86', heightMin: 4, heightRange: 12 }), { fraction: 1 }),
      b.instanced('kit/brazier', 'film-4/braziers', kit.silhouette({ heightMin: 5, heightRange: 4, rim: '#ff9a4a' }), { fraction: 1 }),
      b.glows('film-4/brazier_flames', kit.glow({ mode: 'flame', flicker: true, inflate: 3, intensity: 1.4, flickerSpeed: 9, flickerAmount: 0.4 }), { fraction: 1 }),
      b.glows('film-4/buoys', kit.glow({ mode: 'flame', color: '#7fe0d6', flicker: true, flickerSpeed: 1.2, inflate: 3, intensity: 0.8 }), { fraction: 1 }),
    ]);
    b.particles('embers');
    b.particles('embers', { columns: [[430, 20, 120], [445, 16, 105]], count: Math.round(b.quality.particles * 0.35) });
    const fire = b.kit.globals.uFire.value;
    return {
      update: (time) => {
        // dragon fire: irregular roaring bursts that tint fog and silhouettes
        const burst = Math.max(0, Math.sin(time * 0.45) * 1.4 - 0.4) + Math.max(0, Math.sin(time * 1.7 + 1.3)) * 0.2;
        fire.w = 0.5 + burst * (0.8 + 0.4 * Math.sin(time * 23.0) * Math.sin(time * 7.1));
      },
    };
  },
};
export default film4;
