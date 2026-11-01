// World layout shared by the geometry build and (by hand) the scene content.
// One continuous "grounds" world hosts the hub and films 1, 3, 4, 6 and 8;
// films 2, 5 and 7 have their own environments.
import { fbm, smoothstep, lerp } from './math.mjs';

export const CASTLE_POS = [0, 46, -300];
export const WATER_Y = 0;

export function groundsHeight(x, z) {
  const lakeD = Math.hypot(x / 300, (z - 20) / 240);
  const shore = smoothstep(0.82, 1.12, lakeD);
  let h = lerp(-14 * (1 - Math.min(1, lakeD * lakeD) * 0.6), 2 + fbm(x * 0.004 + 3, z * 0.004) * 22, shore);
  const r = Math.hypot(x, z + 50);
  h += smoothstep(480, 780, r) * (80 + fbm(x * 0.003 + 9, z * 0.003) * 140);
  // hill for the keeper's hut (film 3)
  h += 26 * Math.exp(-((x - 240) ** 2 + (z + 140) ** 2) / (2 * 70 ** 2)) * shore;
  // castle plateau
  const e = Math.hypot(x / 115, (z + 300) / 95);
  h = lerp(h, 46 + fbm(x * 0.05, z * 0.05) * 1.2, smoothstep(1.25, 0.9, e));
  // west spur holding the clock-tower courtyard (film 3)
  const w = Math.hypot((x + 165) / 55, (z + 255) / 50);
  h = lerp(h, 44 + fbm(x * 0.06, z * 0.06), smoothstep(1.3, 0.85, w));
  // east ridge that the long bridge spans to
  const er = Math.hypot((x - 250) / 60, (z + 300) / 70);
  h = lerp(h, 44 + fbm(x * 0.03, z * 0.03) * 4, smoothstep(1.2, 0.7, er));
  // flat field for the hedge maze (film 4)
  const mz = Math.hypot(x - 330, z - 230) / 150;
  h = lerp(h, 6, smoothstep(1.1, 0.85, mz));
  return h;
}

export function countrysideHeight(x, z) {
  let h = fbm(x * 0.0022, z * 0.0022, 5) * 120 - 30;
  h += Math.sin(x * 0.004) * 8;
  // the castle crag far to the north
  const e = Math.hypot(x / 150, (z + 930) / 150);
  h = lerp(h, 80, smoothstep(1.3, 0.85, e));
  // a river valley running the length of the map
  const river = Math.abs(x - Math.sin(z * 0.003) * 120);
  h -= smoothstep(90, 10, river) * 18;
  return h;
}

export function winterHeight(x, z) {
  let h = fbm(x * 0.006 + 40, z * 0.006, 4) * 26;
  // a curved limestone cove to the north, like a frozen amphitheatre
  const d = Math.hypot(x, z + 260);
  const ang = Math.atan2(z + 260, x);
  const cove = smoothstep(150, 175, d) * smoothstep(0.2, -0.6, Math.sin(ang)) * 70;
  h += cove;
  // the clearing where the tent stands
  h = lerp(h, 6, smoothstep(60, 25, Math.hypot(x, z)));
  // frozen pond
  h = lerp(h, -4, smoothstep(55, 35, Math.hypot(x + 90, z - 60)));
  return h;
}

export const SPECIAL_AREAS = [ // circles kept clear of grounds forest scatter
  [0, -300, 140], [-165, -255, 70], [250, -300, 80], [330, 230, 170], [240, -140, 40], [0, 250, 60],
];
