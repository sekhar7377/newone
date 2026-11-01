import { Vector3, type Mesh } from 'three';
import type { SceneModule } from './types';
import { dim } from './kit';

/** Film 2: a flying car over the countryside, then into the castle's cloister corridor. */
const film2: SceneModule = {
  async build(b) {
    const { kit, quality } = b;
    b.sky();
    const ground = kit.silhouette({ heightMin: -40, heightRange: 180, rimPower: 5, rim: dim(kit.palette.rim, 0.45) });
    const green = kit.silhouette({ sway: true, heightMin: -30, heightRange: 160, low: '#08110d', high: '#1d3027' });
    const [, , , , , , car] = await Promise.all([
      b.mesh(`film-2/terrain_${quality.terrain}`, ground),
      b.instanced('kit/hedge', 'film-2/hedgerows', kit.silhouette({ heightMin: -30, heightRange: 160, low: '#07100c', high: '#1a2c22' })),
      b.instanced('kit/tree_round', 'film-2/trees', green),
      b.instanced('kit/cottage', 'film-2/cottages', kit.silhouette({ heightMin: -30, heightRange: 160 }), { fraction: 1 }),
      b.glows('film-2/cottage_windows', kit.glow({ mode: 'window', color: '#ffd38a', flicker: true, flickerSpeed: 0.8, flickerAmount: 0.15 }), { fraction: 1 }),
      b.mesh('film-2/corridor', kit.silhouette({ heightMin: 78, heightRange: 14, low: '#0b120f', high: '#2a3a33', rim: '#7fae96' })),
      b.mesh('kit/car', kit.silhouette({ heightMin: -1, heightRange: 3, low: '#1c3a5e', high: '#7fa7c9', rim: '#cde6ff', rimPower: 2 })),
      b.castle([0, 80, -960]),
      b.glows('film-2/torches', kit.glow({ mode: 'flame', color: '#ffb35c', flicker: true, inflate: 3, intensity: 1.2 }), { fraction: 1 }),
    ]);
    // headlamps: two small glows that ride with the car
    const lamps = await b.glowList([{ p: [2.05, 0.75, 0.55], q: [0, 0, 0, 1], s: [0.5, 0.5, 1] }, { p: [2.05, 0.75, -0.55], q: [0, 0, 0, 1], s: [0.5, 0.5, 1] }],
      kit.glow({ mode: 'flame', color: '#fff3c8', inflate: 5, intensity: 1.6 }), car as Mesh);
    void lamps;
    b.water(2400, -22, { wave: 0.4, deep: '#0c1714' });
    b.particles('dust');

    const pathPoint = new Vector3(), ahead = new Vector3();
    return {
      update: (time, _dt, camera) => {
        // The car flies just ahead of the camera over the countryside, then peels away
        // upward before the corridor so the camera enters alone.
        const c = car as Mesh;
        const cam = camera.position;
        const corridor = cam.z < -650 && cam.z > -980;
        pathPoint.copy(cam);
        camera.getWorldDirection(ahead);
        ahead.y = 0; ahead.normalize();
        const target = pathPoint.clone().addScaledVector(ahead, 18).add(new Vector3(Math.sin(time * 0.7) * 2, -2.5 + Math.sin(time * 1.3) * 0.6, 0));
        if (corridor) target.y += (Math.min(1, (-650 - cam.z) / 120)) * 80;
        c.position.lerp(target, 0.08);
        c.lookAt(c.position.clone().add(ahead));
        c.rotateY(-Math.PI / 2);
        c.rotation.z += Math.sin(time * 0.9) * 0.04;
        c.visible = cam.z > -900;
      },
    };
  },
};
export default film2;
