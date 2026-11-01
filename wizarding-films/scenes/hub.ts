import { Vector3 } from 'three';
import type { SceneModule } from './types';
import { grounds } from './kit';
import { FILM_ORDER } from '.';

/** Map positions of the eight film waypoints on the grounds. */
export const WAYPOINTS: [number, number, number][] = [
  [0, 12, 60], [-250, 60, 70], [240, 50, -140], [250, 24, 110], [-120, 40, 150], [45, 170, -325], [-320, 44, -90], [160, 64, -300],
];

const hub: SceneModule = {
  async build(b) {
    await grounds(b, { forest: 0.7 });
    // Light shafts above each waypoint: one instanced draw call.
    await b.glowList(
      WAYPOINTS.map((p) => ({ p: [p[0], p[1] + 45, p[2]], q: [0, 0, 0, 1], s: [9, 90, 1] })),
      b.kit.glow({ mode: 'beam', color: b.kit.palette.ui.accent, intensity: 0.5, inflate: 0 }),
    );
    b.particles('motes');
    return {
      waypoints: FILM_ORDER.map((id, i) => ({ id, position: new Vector3(...WAYPOINTS[i]) })),
      intro: {
        // Fly in low over the misty lake toward the castle, then rise to the map view.
        points: [[0, 6, 560], [10, 7, 330], [0, 12, 90], [-30, 50, -130], [-70, 200, 110], [0, 360, 360]],
        look: [[0, 8, 300], [0, 18, 0], [0, 50, -280], [0, 70, -300], [0, 20, -200], [0, 0, -100]],
        duration: 11,
      },
    };
  },
};
export default hub;
