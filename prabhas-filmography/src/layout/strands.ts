import type { EraId, Film } from '../data/types';
import { chronoSort, eraOf } from '../data/derive';

/**
 * Layout: every film credit becomes one strand growing out of a central nucleus.
 *
 * Mapping rules (no invented metrics):
 * - Direction: the film's era picks a base direction; a seeded jitter spreads films
 *   within the era's cone. Same id → same shape on every load.
 * - Length: equal weight for all lead films (a seeded 3.2–5.2 range only to avoid a
 *   rigid sphere). Cameo, special-appearance and voice credits are drawn shorter and
 *   fainter. Length never encodes box office, ratings or popularity.
 * - Unreleased work pulses; announced-only work is dimmer than work being filmed.
 * - A recut is a branch from the film it was cut from.
 * - Intro growth order is release chronology, debut first; undated projects grow last.
 */

export const CP = 12; // control points per strand
export const NUCLEUS_R = 0.42;
export const MAX_REACH = 5.8;

export interface Look {
  brightness: number;
  energy: number; // drift amount
  reach: number;
  glint: number;
  pulse: number;
  width: number;
}

export interface StrandSpec {
  index: number;
  film: Film;
  parent: number; // -1 for root strands
  seed: number;
  rest: Float32Array; // CP * 3 rest positions
  length: number;
  phase: number;
  speed: number;
  look: Look;
  growStart: number; // seconds on the intro clock
  growDur: number;
}

export const ERA_DIRS: Record<EraId, { dir: [number, number, number]; spread: number }> = {
  beginnings: { dir: [-0.85, -0.2, 0.5], spread: 0.95 },
  ascent: { dir: [-0.45, 0.8, 0.4], spread: 0.95 },
  baahubali: { dir: [0.35, 0.75, -0.55], spread: 0.6 },
  spectacle: { dir: [0.95, 0.15, 0.3], spread: 0.8 },
  recent: { dir: [0.3, -0.85, 0.35], spread: 0.75 },
  upcoming: { dir: [-0.2, -0.35, -0.95], spread: 0.8 },
};

export const INTRO = { lead: 1.6, span: 22, grow: 5 };
export const introEnd = () => INTRO.lead + INTRO.span + INTRO.grow + 1;

export function lookFor(f: Film): Look {
  if (f.status === 'filming' || f.status === 'post-production')
    return { brightness: 1.25, energy: 1.2, reach: 1.02, glint: 2, pulse: 0.35, width: 1 };
  if (f.status === 'announced')
    return { brightness: 0.75, energy: 0.8, reach: 0.9, glint: 0.7, pulse: 0.2, width: 0.85 };
  switch (f.creditType) {
    case 'cameo':
    case 'special-appearance':
      return { brightness: 0.62, energy: 0.55, reach: 0.55, glint: 0.25, pulse: 0, width: 0.7 };
    case 'voice':
      return { brightness: 0.55, energy: 0.5, reach: 0.6, glint: 0.45, pulse: 0, width: 0.6 };
    case 'recut':
      return { brightness: 0.9, energy: 0.9, reach: 1, glint: 1.4, pulse: 0, width: 0.8 };
    default:
      return { brightness: 1.05, energy: 1, reach: 1, glint: 1, pulse: 0, width: 1 };
  }
}

// ---------- deterministic helpers ----------

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type V3 = [number, number, number];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Cheap smooth 3D field built from sines; enough to bend strands organically. */
function field(x: number, y: number, z: number, o: V3): V3 {
  return [
    Math.sin(y * 1.3 + o[0]) + Math.sin(z * 0.9 + o[1] * 0.7) * 0.6,
    Math.sin(z * 1.1 + o[1]) + Math.sin(x * 0.8 + o[2] * 0.5) * 0.6,
    Math.sin(x * 1.2 + o[2]) + Math.sin(y * 0.7 + o[0] * 0.3) * 0.6,
  ];
}

const UP: V3 = norm([0.18, 1, 0.12]);

function growPath(start: V3, dir: V3, length: number, r: () => number, firstStep: number, radialPull: number): Float32Array {
  const out = new Float32Array(CP * 3);
  const wobble = lerp(0.45, 1.05, r());
  const swirl = lerp(0.12, 0.42, r());
  const off: V3 = [r() * 100, r() * 100, r() * 100];
  let p: V3 = [...start];
  let d: V3 = [...dir];
  const step = length / (CP - 1);
  out.set(p, 0);
  for (let i = 1; i < CP; i++) {
    const u = i / (CP - 1);
    const n = field(p[0] * 0.45, p[1] * 0.45, p[2] * 0.45, off);
    const sw = norm(cross(UP, p));
    const k = wobble * 0.32 * Math.min(1, u * 2.5);
    d = norm([
      d[0] + n[0] * k + sw[0] * swirl * u + dir[0] * radialPull,
      d[1] + n[1] * k + sw[1] * swirl * u + dir[1] * radialPull,
      d[2] + n[2] * k + sw[2] * swirl * u + dir[2] * radialPull,
    ]);
    const s = step * (i === 1 ? firstStep : 1);
    p = [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];
    out.set(p, i * 3);
  }
  return out;
}

export function buildStrands(films: Film[]): StrandSpec[] {
  const ordered = chronoSort(films);
  const order = new Map(ordered.map((f, i) => [f.id, i]));
  const n = Math.max(1, ordered.length - 1);
  const specs: StrandSpec[] = [];
  const roots = films.filter((f) => !f.parentId);
  const children = films.filter((f) => f.parentId);

  for (const film of roots) {
    const seed = hash(film.id);
    const r = rng(seed);
    const era = ERA_DIRS[eraOf(film)];
    const look = lookFor(film);
    const jitter = norm([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]);
    const amt = era.spread * r() ** 0.6;
    const base = norm(era.dir);
    const dir = norm([base[0] + jitter[0] * amt, base[1] + jitter[1] * amt, base[2] + jitter[2] * amt]);
    const length = lerp(3.2, 5.2, r() ** 0.8) * look.reach;
    const start: V3 = [dir[0] * NUCLEUS_R * 0.92, dir[1] * NUCLEUS_R * 0.92, dir[2] * NUCLEUS_R * 0.92];
    const rest = growPath(start, dir, length, r, 0.6, 0.35);
    specs.push({
      index: specs.length,
      film,
      parent: -1,
      seed,
      rest,
      length,
      phase: r() * 1000,
      speed: lerp(0.7, 1.3, r()),
      look,
      growStart: INTRO.lead + ((order.get(film.id) ?? 0) / n) * INTRO.span + r() * 0.3,
      growDur: INTRO.grow * lerp(0.85, 1.15, r()),
    });
  }

  for (const film of children) {
    const parent = specs.find((s) => s.film.id === film.parentId);
    if (!parent) continue;
    const seed = hash(film.id);
    const r = rng(seed);
    const j = 6;
    const a: V3 = [parent.rest[j * 3], parent.rest[j * 3 + 1], parent.rest[j * 3 + 2]];
    const b: V3 = [parent.rest[j * 3 + 3], parent.rest[j * 3 + 4], parent.rest[j * 3 + 5]];
    const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const side = norm(cross(t, norm([r() - 0.5, r() - 0.5, r() - 0.5])));
    const dir = norm([t[0] * 0.55 + side[0] * 0.85, t[1] * 0.55 + side[1] * 0.85, t[2] * 0.55 + side[2] * 0.85]);
    const length = parent.length * lerp(0.42, 0.52, r());
    const look = lookFor(film);
    const ownStart = INTRO.lead + ((order.get(film.id) ?? 0) / n) * INTRO.span;
    specs.push({
      index: specs.length,
      film,
      parent: parent.index,
      seed,
      rest: growPath(a, dir, length, r, 1, 0.25),
      length,
      phase: r() * 1000,
      speed: parent.speed * 1.1,
      look,
      // a branch can only grow once its parent has reached the fork
      growStart: Math.max(ownStart, parent.growStart + parent.growDur * (j / (CP - 1)) + 0.3),
      growDur: parent.growDur * 0.7,
    });
  }
  return specs;
}
