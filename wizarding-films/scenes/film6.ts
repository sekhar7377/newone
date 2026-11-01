import type { SceneModule } from './types';
import { grounds } from './kit';

/** Film 6: the astronomy tower under a storm sky, with lightning and rain. */
const film6: SceneModule = {
  async build(b) {
    await grounds(b, { castleWindows: 0.7, water: { wave: 1.2, deep: '#0b120b' } });
    await b.glows('film-6/debris', b.kit.glow({ mode: 'flame', color: '#cfe9a0', flicker: true, flickerSpeed: 0.7, inflate: 2, intensity: 0.35 }), { fraction: 1 });
    b.particles('rain');
    const flash = b.kit.globals.uFlash;
    let next = 4, t0 = -10, thunder: ((s: number) => void) | null = null;
    return {
      events: { onThunder: (cb) => { thunder = cb; } },
      update: (time) => {
        if (time > next) { t0 = time; next = time + 5 + Math.random() * 9; thunder?.(0.6 + Math.random() * 0.4); }
        const e = time - t0;
        flash.value = e < 0 ? 0 : Math.max(0, Math.exp(-e * 9) * (e < 0.12 ? 1 : 0.6) + (e > 0.18 && e < 0.4 ? Math.exp(-(e - 0.18) * 14) * 0.7 : 0));
      },
    };
  },
};
export default film6;
