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
    import(`@/content/scenes/${id}.json`).then((m) => m.default as SceneContent),
    import(`@/content/illustrations/${id}.json`).then((m) => m.default as IllustrationData[]).catch(() => [] as IllustrationData[]),
  ]);
  return { content: c, illustrations: i };
}
