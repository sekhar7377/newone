/**
 * Content model. The "CMS" is plain JSON in /content, edited by hand or by the
 * /studio tools. Every hotspot and illustration has a publishAt date so content
 * can be released in waves (anniversaries, 1 September...). Anything dated in
 * the future is filtered out at runtime and in the HTML archive.
 */
import films from '@/content/films.json';

export type SceneId = 'hub' | `film-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type HotspotKind = 'meta' | 'fact' | 'bts' | 'moment';

export interface Film {
  id: SceneId; number: number; slug: string; title: string; altTitle?: string;
  year: number; released: string; director: string; setting: string; tagline: string; summary: string;
}

export interface HotspotData {
  id: string; kind: HotspotKind; title: string; body: string;
  /** Absolute world position, or `at` (0..1 along the path) + `offset`. */
  position?: [number, number, number]; at?: number; offset?: [number, number, number];
  /** Camera view saved in the studio: path parameter + look offsets (radians). */
  view?: { t: number; yaw?: number; pitch?: number };
  publishAt: string; illustration?: string;
}
export interface CollectibleData { id: string; name: string; note: string; position?: [number, number, number]; at?: number; offset?: [number, number, number] }
export interface SceneContent {
  path: { points: [number, number, number][]; look: [number, number, number][] };
  startT?: number;
  hotspots: HotspotData[];
  collectibles: CollectibleData[];
}
export interface Stroke { p: number[]; w: number[] }
export interface IllustrationData {
  id: string; hotspot: string; alt: string; publishAt: string;
  offset: [number, number, number]; scale: number; color?: string; strokes: Stroke[];
}

export const FILMS = films as Film[];
export const filmById = (id: string) => FILMS.find((f) => f.id === id);
export const filmBySlug = (slug: string) => FILMS.find((f) => f.slug === slug);

export const KIND_LABEL: Record<HotspotKind, string> = { meta: 'Release', fact: 'Film fact', bts: 'Behind the scenes', moment: 'Key moment' };

/** `asOf` lets the studio preview a future content drop. */
export function isPublished(item: { publishAt: string }, asOf: number = Date.now()) {
  const t = Date.parse(item.publishAt);
  return Number.isNaN(t) || t <= asOf;
}
export function isNewSince(item: { publishAt: string }, lastVisit: number) {
  if (!lastVisit) return false; // first visit: nothing is "new", everything is
  const t = Date.parse(item.publishAt);
  return !Number.isNaN(t) && t > lastVisit;
}

export async function loadSceneContent(id: SceneId): Promise<{ content: SceneContent; illustrations: IllustrationData[] }> {
  // Dynamic imports keep each film's copy out of the initial bundle.
  const [c, i] = await Promise.all([
    SCENE_JSON[id]().then((m) => m.default as unknown as SceneContent),
    ILL_JSON[id]().then((m) => m.default as unknown as IllustrationData[]).catch(() => [] as IllustrationData[]),
  ]);
  return { content: c, illustrations: i };
}

// Explicit loaders (one chunk each) so any bundler can split them.
type J = () => Promise<{ default: unknown }>;
const SCENE_JSON: Record<SceneId, J> = {
  hub: () => import('@/content/scenes/hub.json'), 'film-1': () => import('@/content/scenes/film-1.json'), 'film-2': () => import('@/content/scenes/film-2.json'),
  'film-3': () => import('@/content/scenes/film-3.json'), 'film-4': () => import('@/content/scenes/film-4.json'), 'film-5': () => import('@/content/scenes/film-5.json'),
  'film-6': () => import('@/content/scenes/film-6.json'), 'film-7': () => import('@/content/scenes/film-7.json'), 'film-8': () => import('@/content/scenes/film-8.json'),
};
const ILL_JSON: Record<SceneId, J> = {
  hub: () => import('@/content/illustrations/hub.json'), 'film-1': () => import('@/content/illustrations/film-1.json'), 'film-2': () => import('@/content/illustrations/film-2.json'),
  'film-3': () => import('@/content/illustrations/film-3.json'), 'film-4': () => import('@/content/illustrations/film-4.json'), 'film-5': () => import('@/content/illustrations/film-5.json'),
  'film-6': () => import('@/content/illustrations/film-6.json'), 'film-7': () => import('@/content/illustrations/film-7.json'), 'film-8': () => import('@/content/illustrations/film-8.json'),
};
