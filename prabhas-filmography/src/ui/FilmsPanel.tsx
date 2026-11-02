import { useMemo } from 'react';
import { FILMS } from '../data/films';
import { chronoSort, CREDIT_LABEL, eraOf, ERAS, isFiltering, statusToken, yearToken, type ReleaseFilter } from '../data/derive';
import type { CreditType } from '../data/types';
import { actions, useAppState, visibleIds } from '../state/store';
import { fx } from '../scene/runtime';
import { SPECS } from '../scene/Scene';

const ORDERED = chronoSort(FILMS);
const indexOf = new Map(SPECS.map((s) => [s.film.id, s.index]));
const CREDIT_ORDER: CreditType[] = ['lead', 'cameo', 'special-appearance', 'voice', 'recut'];
const RELEASE: { id: ReleaseFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'released', label: 'Released' },
  { id: 'upcoming', label: 'Upcoming' },
];

/** Search, filters and the accessible film list, kept in sync with the strands. */
export function FilmsPanel({ onClose }: { onClose: () => void }) {
  const filters = useAppState((s) => s.filters);
  const selectedId = useAppState((s) => s.selectedId);
  const vis = useAppState((s) => visibleIds(s));
  const shown = useMemo(() => ORDERED.filter((f) => vis.has(f.id)), [vis]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of FILMS) m.set(f.creditType, (m.get(f.creditType) ?? 0) + 1);
    return m;
  }, []);

  // group the list: dated films by era, undated upcoming last
  const groups = ERAS.map((e) => ({ era: e, films: shown.filter((f) => eraOf(f) === e.id) })).filter((g) => g.films.length);

  return (
    <aside className="panel films" aria-label="Films">
      <header>
        <span>Films</span>
        <button className="link" onClick={onClose} aria-label="Close films panel">
          Close
        </button>
      </header>

      <label className="search">
        <span className="sr-only">Search films</span>
        <input
          type="search"
          placeholder="Search title, director, character…"
          value={filters.query}
          onChange={(e) => actions.setFilters({ query: e.target.value })}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <h3 id="flt-release">Release</h3>
      <div className="seg" role="group" aria-labelledby="flt-release">
        {RELEASE.map((r) => (
          <button key={r.id} className={filters.release === r.id ? 'on' : ''} aria-pressed={filters.release === r.id} onClick={() => actions.setFilters({ release: r.id })}>
            {r.label}
          </button>
        ))}
      </div>

      <h3 id="flt-credit">Credit</h3>
      <div className="seg" role="group" aria-labelledby="flt-credit">
        {CREDIT_ORDER.map((c) => (
          <button key={c} className={filters.credits.includes(c) ? 'on' : ''} aria-pressed={filters.credits.includes(c)} onClick={() => actions.toggleCredit(c)}>
            {CREDIT_LABEL[c]} <small>{counts.get(c) ?? 0}</small>
          </button>
        ))}
      </div>

      <h3 id="flt-era">Era</h3>
      <div className="seg" role="group" aria-labelledby="flt-era">
        <button className={filters.era === 'all' ? 'on' : ''} aria-pressed={filters.era === 'all'} onClick={() => actions.setFilters({ era: 'all' })}>
          All
        </button>
        {ERAS.map((e) => (
          <button key={e.id} className={filters.era === e.id ? 'on' : ''} aria-pressed={filters.era === e.id} onClick={() => actions.setFilters({ era: e.id })} title={e.range}>
            {e.label}
          </button>
        ))}
      </div>

      <div className="listhead">
        <p className="note" role="status" aria-live="polite">
          {shown.length === FILMS.length ? `${FILMS.length} credits` : `${shown.length} of ${FILMS.length} credits`}
        </p>
        <button className="link" onClick={actions.clearFilters} disabled={!isFiltering(filters)}>
          Clear filters
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>No films match these filters.</p>
          <button onClick={actions.clearFilters}>Clear filters</button>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.era.id} className="filmgroup">
            <h3>
              {g.era.label} <span>{g.era.range}</span>
            </h3>
            <ul>
              {g.films.map((f) => (
                <li key={f.id}>
                  <button
                    className={`filmrow${selectedId === f.id ? ' sel' : ''}`}
                    aria-current={selectedId === f.id ? 'true' : undefined}
                    onClick={() => actions.select(f.id)}
                    onMouseEnter={() => (fx.hoverIndex = indexOf.get(f.id) ?? -1)}
                    onMouseLeave={() => (fx.hoverIndex = -1)}
                    onFocus={() => (fx.hoverIndex = indexOf.get(f.id) ?? -1)}
                    onBlur={() => (fx.hoverIndex = -1)}
                  >
                    <span className="yr">{yearToken(f)}</span>
                    <span className="ti">{f.title}</span>
                    {statusToken(f) !== 'Released' && (
                      <span className={`st st-${f.status !== 'released' ? f.status : f.creditType}`}>{statusToken(f)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </aside>
  );
}
