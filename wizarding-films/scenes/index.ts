import type { SceneId } from '@/lib/content';
import type { SceneModule } from './types';

/** Each scene is its own chunk, fetched only when its waypoint is approached. */
export const SCENES: Record<SceneId, () => Promise<{ default: SceneModule }>> = {
  hub: () => import('./hub'),
  'film-1': () => import('./film1'),
  'film-2': () => import('./film2'),
  'film-3': () => import('./film3'),
  'film-4': () => import('./film4'),
  'film-5': () => import('./film5'),
  'film-6': () => import('./film6'),
  'film-7': () => import('./film7'),
  'film-8': () => import('./film8'),
};

export const FILM_ORDER: SceneId[] = ['film-1', 'film-2', 'film-3', 'film-4', 'film-5', 'film-6', 'film-7', 'film-8'];
export const nextFilm = (id: SceneId): SceneId | null => {
  const i = FILM_ORDER.indexOf(id);
  return i >= 0 && i < FILM_ORDER.length - 1 ? FILM_ORDER[i + 1] : null;
};
