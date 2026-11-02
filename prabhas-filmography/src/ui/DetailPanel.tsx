import { useEffect, useRef, useState } from 'react';
import { FILMS } from '../data/films';
import { chronoSort, CREDIT_LABEL, dateLine, eraOf, ERAS, formatDate, STATUS_LABEL } from '../data/derive';
import type { Film } from '../data/types';
import { actions } from '../state/store';

const ORDERED = chronoSort(FILMS);

/** Typographic stand-in used whenever no permitted poster is available. */
function TitleCard({ film }: { film: Film }) {
  const [broken, setBroken] = useState(false);
  if (film.poster && !broken) {
    return <img className="poster" src={film.poster} alt={`${film.title} poster`} onError={() => setBroken(true)} />;
  }
  return (
    <div className={`titlecard tc-${film.status}`} aria-hidden="true">
      <span className="tc-year">{film.releaseYear ?? 'TBA'}</span>
      <span className="tc-title">{film.title}</span>
      <span className="tc-dir">{film.director ? `A film by ${film.director}` : ''}</span>
    </div>
  );
}

export function DetailPanel({ film }: { film: Film }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  const i = ORDERED.findIndex((f) => f.id === film.id);
  const prev = ORDERED[i - 1];
  const next = ORDERED[i + 1];
  const era = ERAS.find((e) => e.id === eraOf(film));

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    setCopied(false);
  }, [film.id]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt('Copy this link', window.location.href);
    }
  };

  const rows: [string, string | null][] = [
    ['Release', dateLine(film)],
    ['Status', STATUS_LABEL[film.status]],
    ['Credit', CREDIT_LABEL[film.creditType]],
    ['Director', film.director],
    [film.characters.length > 1 ? 'Characters' : 'Character', film.characters.join(', ') || 'Not revealed'],
    ['Genres', film.genres.join(', ') || null],
    ['Languages', film.languages.join(', ') || null],
    ['Franchise', film.franchise],
    ['Era', era ? `${era.label} (${era.range})` : null],
  ];

  return (
    <aside className="panel detail" role="dialog" aria-labelledby="detail-title" aria-modal="false">
      <header>
        <span className="eyebrow">
          {film.chronology ? `Credit ${film.chronology} of ${FILMS.filter((f) => f.chronology).length} released` : 'Upcoming'}
        </span>
        <button className="link" onClick={() => actions.select(null)} aria-label="Close film details">
          Close
        </button>
      </header>
      <TitleCard film={film} />
      <h2 id="detail-title" ref={heading} tabIndex={-1}>
        {film.title}
      </h2>
      {film.alternateTitles.length > 0 && <p className="alt">Also: {film.alternateTitles.join(' · ')}</p>}

      <p className={`synopsis${film.synopsis ? '' : ' unknown'}`}>{film.synopsis ?? 'No verified synopsis yet. See the sources below.'}</p>
      {film.note && <p className="note filmnote">{film.note}</p>}

      <dl className="facts">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={v ? '' : 'unknown'}>{v ?? 'Unknown'}</dd>
          </div>
        ))}
      </dl>

      <h3>Trailer</h3>
      {film.trailerUrl ? (
        <a href={film.trailerUrl} target="_blank" rel="noreferrer">
          Watch the official trailer ↗
        </a>
      ) : (
        <p className="note">No verified official trailer link.</p>
      )}

      <h3>Sources</h3>
      <ul className="sources">
        {film.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label} ↗
            </a>
          </li>
        ))}
      </ul>
      <p className="note">Verified {formatDate(film.lastVerified)}</p>

      <footer>
        <button className="link" disabled={!prev} onClick={() => prev && actions.select(prev.id)} aria-label={prev ? `Previous: ${prev.title}` : 'No previous film'}>
          ← Prev
        </button>
        <button className="link" onClick={share}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <button className="link" disabled={!next} onClick={() => next && actions.select(next.id)} aria-label={next ? `Next: ${next.title}` : 'No next film'}>
          Next →
        </button>
      </footer>
    </aside>
  );
}
