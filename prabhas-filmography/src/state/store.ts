import { useSyncExternalStore } from 'react';
import { FILMS } from '../data/films';
import { EMPTY_FILTERS, ERAS, matchesFilters, type Filters } from '../data/derive';
import type { CreditType, EraId } from '../data/types';

/**
 * App state that React UI needs (selection, filters, panel). Pointer and
 * animation state live outside React (see scene/runtime.ts) so moving the
 * mouse never re-renders components.
 */
export interface AppState {
  selectedId: string | null;
  filters: Filters;
  panel: 'none' | 'films' | 'settings';
}

const CREDITS: CreditType[] = ['lead', 'cameo', 'special-appearance', 'voice', 'recut'];
const ids = new Set(FILMS.map((f) => f.id));

function fromUrl(): Pick<AppState, 'selectedId' | 'filters'> {
  const p = new URLSearchParams(window.location.search);
  const film = p.get('film');
  const release = p.get('release');
  const era = p.get('era') as EraId | null;
  const credits = (p.get('credit') ?? '')
    .split(',')
    .filter((c): c is CreditType => (CREDITS as string[]).includes(c));
  return {
    selectedId: film && ids.has(film) ? film : null,
    filters: {
      query: p.get('q') ?? '',
      release: release === 'released' || release === 'upcoming' ? release : 'all',
      credits,
      era: era && ERAS.some((e) => e.id === era) ? era : 'all',
    },
  };
}

function toSearch(s: AppState): string {
  const p = new URLSearchParams();
  if (s.selectedId) p.set('film', s.selectedId);
  if (s.filters.query) p.set('q', s.filters.query);
  if (s.filters.release !== 'all') p.set('release', s.filters.release);
  if (s.filters.credits.length) p.set('credit', s.filters.credits.join(','));
  if (s.filters.era !== 'all') p.set('era', s.filters.era);
  // keep unrelated params such as ?introSpeed
  const cur = new URLSearchParams(window.location.search);
  for (const k of ['introSpeed']) {
    const v = cur.get(k);
    if (v) p.set(k, v);
  }
  const q = p.toString();
  return q ? `?${q}` : window.location.pathname;
}

let state: AppState = { ...fromUrl(), panel: 'none' };
if (state.selectedId == null && hasFilterParams()) state.panel = 'films';

function hasFilterParams() {
  const f = state.filters;
  return f.query !== '' || f.release !== 'all' || f.credits.length > 0 || f.era !== 'all';
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Selection changes push a history entry (so Back closes/changes the film);
 * filter edits replace the current entry so typing does not flood history.
 */
function set(patch: Partial<AppState>, history: 'push' | 'replace' | 'none' = 'none') {
  state = { ...state, ...patch };
  if (history !== 'none') {
    const url = toSearch(state);
    const current = window.location.search || window.location.pathname;
    if (url !== current) {
      try {
        window.history[history === 'push' ? 'pushState' : 'replaceState'](null, '', url);
      } catch {
        // sandboxed frames may refuse URL changes; state still updates in the page
      }
    }
  }
  emit();
}

window.addEventListener('popstate', () => {
  const u = fromUrl();
  set({ selectedId: u.selectedId, filters: u.filters });
});

export const actions = {
  select(id: string | null) {
    if (id === state.selectedId) return;
    // Opening a film gives it the stage: side panels close (the detail view has Prev/Next).
    set(id ? { selectedId: id, panel: 'none' } : { selectedId: id }, 'push');
  },
  setFilters(patch: Partial<Filters>) {
    set({ filters: { ...state.filters, ...patch } }, 'replace');
  },
  toggleCredit(c: CreditType) {
    const cs = state.filters.credits;
    actions.setFilters({ credits: cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c] });
  },
  clearFilters() {
    set({ filters: EMPTY_FILTERS }, 'replace');
  },
  setPanel(panel: AppState['panel']) {
    set({ panel });
  },
};

export const getState = () => state;
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAppState<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

/** Ids passing current filters. Cached by filters identity. */
let visCache: { f: Filters; set: Set<string> } | null = null;
export function visibleIds(s: AppState = state): Set<string> {
  if (visCache?.f === s.filters) return visCache.set;
  const v = new Set(FILMS.filter((f) => matchesFilters(f, s.filters)).map((f) => f.id));
  visCache = { f: s.filters, set: v };
  return v;
}
