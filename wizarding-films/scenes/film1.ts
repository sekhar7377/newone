import type { SceneModule } from './types';
import { grounds } from './kit';

/**
 * Film 1: boats crossing the lake to the castle at night. The showcase scene:
 * every technique in the brief is exercised here (instanced forest, window
 * glow, flag sway, candle flicker, floating candles, water, height fog with
 * mist, GPU particles, hotspots and line illustrations).
 */
const film1: SceneModule = {
  async build(b) {
    const { kit } = b;
    const boatMat = kit.silhouette({ bob: true, heightMin: -1, heightRange: 4, rim: '#8a7a55', rimPower: 2 });
    const metal = kit.silhouette({ heightMin: 0, heightRange: 30, rim: '#9a8456' });
    await Promise.all([
      grounds(b, { water: { wave: 0.6, spec: 1.2 } }),
      b.instanced('kit/boat', 'film-1/boats', boatMat, { fraction: 1 }),
      b.glows('film-1/boat_flames', kit.glow({ mode: 'flame', flicker: true, inflate: 2.5, intensity: 1.3 }), { fraction: 1 }),
      b.instanced('kit/lantern', 'film-1/lanterns', metal, { fraction: 1 }),
      b.glows('film-1/lantern_flames', kit.glow({ mode: 'flame', flicker: true, inflate: 3, intensity: 1.1 }), { fraction: 1 }),
      // floating candles: bodies + flames, both drifting in the vertex shader
      b.instanced('kit/candle', 'film-1/candles', kit.silhouette({ float: true, low: '#cbb48a', high: '#efe0bd', rim: '#fff2cf', heightMin: 0, heightRange: 1e4 }), { fraction: Math.max(0.6, b.quality.instanceFraction) }),
      b.glows('film-1/candles', kit.glow({ mode: 'flame', flicker: true, float: true, inflate: 2, intensity: 1.2, flickerSpeed: 8 }), {
        map: (p) => ({ ...p, p: [p.p[0], p.p[1] + 0.62 * p.s[1], p.p[2]], s: [0.35, 0.55, 1] }),
      }),
    ]);
    b.particles('fireflies');
    b.particles('motes', { count: Math.round(b.quality.particles * 0.3) });
    return {};
  },
};
export default film1;
