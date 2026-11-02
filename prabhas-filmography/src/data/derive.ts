import type { CreditType, EraId, Film, FilmStatus } from './types';

export interface Era {
  id: EraId;
  label: string;
  range: string;
}

/**
 * Eras are an editorial grouping by release year, documented here so the layout
 * rule is explicit. They decide which direction a film's strand leaves the nucleus.
 * Every unreleased project goes to "upcoming", whatever its reported date.
 */
export const ERAS: Era[] = [
  { id: 'beginnings', label: 'Beginnings', range: '2002–2008' },
  { id: 'ascent', label: 'Ascent', range: '2009–2014' },
  { id: 'baahubali', label: 'Baahubali', range: '2015–2017' },
  { id: 'spectacle', label: 'Pan-India', range: '2019–2024' },
  { id: 'recent', label: 'Recent', range: '2025–2026' },
  { id: 'upcoming', label: 'Upcoming', range: 'Unreleased' },
];

export function eraOf(f: Film): EraId {
  if (f.status !== 'released' || f.releaseYear == null) return 'upcoming';
  const y = f.releaseYear;
  if (y <= 2008) return 'beginnings';
  if (y <= 2014) return 'ascent';
  if (y <= 2017) return 'baahubali';
  if (y <= 2024) return 'spectacle';
  return 'recent';
}

export const STATUS_LABEL: Record<FilmStatus, string> = {
  released: 'Released',
  'post-production': 'Post-production',
  filming: 'Filming',
  announced: 'Announced',
};

export const CREDIT_LABEL: Record<CreditType, string> = {
  lead: 'Lead role',
  cameo: 'Cameo',
  'special-appearance': 'Special appearance',
  voice: 'Voice credit',
  recut: 'Recut / compilation',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Human-readable date line that never overstates certainty. */
export function dateLine(f: Film): string {
  switch (f.dateCertainty) {
    case 'exact':
      return f.releaseDate ? formatDate(f.releaseDate) : String(f.releaseYear);
    case 'year':
      return String(f.releaseYear);
    case 'announced':
      return f.releaseDate ? `${formatDate(f.releaseDate)} (announced)` : `${f.releaseYear} (announced)`;
    default:
      return 'TBA';
  }
}

/** Short year token for labels: "2015", "2027", "TBA". */
export function yearToken(f: Film): string {
  return f.releaseYear != null ? String(f.releaseYear) : 'TBA';
}

/** Third label line: status for unreleased work, credit type for non-lead credits. */
export function statusToken(f: Film): string {
  if (f.status !== 'released') return STATUS_LABEL[f.status];
  if (f.creditType !== 'lead') return CREDIT_LABEL[f.creditType];
  return 'Released';
}

/** Chronological order: released by chronology, then dated upcoming, then TBA. */
export function chronoSort(films: Film[]): Film[] {
  const key = (f: Film) =>
    f.chronology != null
      ? f.chronology
      : f.releaseDate
        ? 1000 + Date.parse(f.releaseDate) / 864e5 / 1e5
        : 2000 + (f.status === 'announced' ? 1 : 0);
  return [...films].sort((a, b) => key(a) - key(b) || a.title.localeCompare(b.title));
}

// ---------- Search & filters ----------

export type ReleaseFilter = 'all' | 'released' | 'upcoming';

export interface Filters {
  query: string;
  release: ReleaseFilter;
  credits: CreditType[]; // empty = all
  era: EraId | 'all';
}

export const EMPTY_FILTERS: Filters = { query: '', release: 'all', credits: [], era: 'all' };

export const isFiltering = (f: Filters) =>
  f.query.trim() !== '' || f.release !== 'all' || f.credits.length > 0 || f.era !== 'all';

/** Lowercase, strip accents and punctuation so "Baahubali", "bahubali" and "Bāhubali" meet. */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Collapse doubled vowels/consonants and common transliteration variants. */
function fold(s: string): string {
  return normalise(s)
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/sh/g, 's')
    .replace(/([bcdfghjklmnpqrstvwxyz])\1/g, '$1')
    .replace(/z/g, 'j')
    .replace(/w/g, 'v')
    .replace(/h/g, '');
}

function haystack(f: Film): string[] {
  return [f.title, ...f.alternateTitles, f.director ?? '', ...f.characters, f.franchise ?? '', String(f.releaseYear ?? '')];
}

export function matchesQuery(f: Film, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  const fields = haystack(f);
  const plain = fields.map(normalise).join(' | ');
  if (q.split(' ').every((t) => plain.includes(t))) return true;
  const folded = fields.map(fold).join(' | ');
  return fold(query)
    .split(' ')
    .every((t) => folded.includes(t));
}

export function matchesFilters(f: Film, flt: Filters): boolean {
  if (flt.release === 'released' && f.status !== 'released') return false;
  if (flt.release === 'upcoming' && f.status === 'released') return false;
  if (flt.credits.length && !flt.credits.includes(f.creditType)) return false;
  if (flt.era !== 'all' && eraOf(f) !== flt.era) return false;
  return matchesQuery(f, flt.query);
}

export function tally<T extends string>(films: Film[], key: (f: Film) => T): [T, number][] {
  const m = new Map<T, number>();
  for (const f of films) m.set(key(f), (m.get(key(f)) ?? 0) + 1);
  return [...m.entries()];
}
