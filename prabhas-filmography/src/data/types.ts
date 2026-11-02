/** Production status as of `lastVerified`. */
export type FilmStatus = 'released' | 'post-production' | 'filming' | 'announced';

/** What kind of screen credit Prabhas has on the film. */
export type CreditType = 'lead' | 'cameo' | 'special-appearance' | 'voice' | 'recut';

/**
 * How sure we are about the date.
 * - exact: day-level date published by the makers or widely reported at release
 * - year: only the release year is verified
 * - announced: the makers officially announced this future date
 * - tba: no verified date
 */
export type DateCertainty = 'exact' | 'year' | 'announced' | 'tba';

export type EraId = 'beginnings' | 'ascent' | 'baahubali' | 'spectacle' | 'recent' | 'upcoming';

export interface LookImage {
  /** Path under public/, e.g. "looks/baahubali-the-beginning.jpg", or an https URL. */
  src: string;
  alt: string;
  /** What the photo shows and where it was taken. */
  caption: string;
  credit: string;
  licence: string;
  sourceUrl: string;
}

export interface Source {
  label: string;
  url: string;
}

export interface Film {
  id: string;
  title: string;
  /** Alternate spellings and common short names, used by search. */
  alternateTitles: string[];
  /** Null when no year is verified. */
  releaseYear: number | null;
  /** ISO date (YYYY-MM-DD), only when dateCertainty is exact or announced. */
  releaseDate: string | null;
  dateCertainty: DateCertainty;
  /**
   * Order of release among all credits (1 = debut). Lets same-year films keep
   * their real order without inventing a day-level date. Null for undated upcoming.
   */
  chronology: number | null;
  status: FilmStatus;
  creditType: CreditType;
  director: string | null;
  /** Prabhas's character name(s). Empty when not yet revealed. */
  characters: string[];
  genres: string[];
  languages: string[];
  franchise: string | null;
  /** Short original synopsis. Null when we have not written a verified one. */
  synopsis: string | null;
  /** Free-text note shown in the detail view (status caveats, credit details). */
  note: string | null;
  /** For a recut: the id of the film it is cut from. Drawn as a branch. */
  parentId: string | null;
  poster: string | null;
  /**
   * A still of Prabhas's look in this film. Only images you have the right to use:
   * your own, licensed, or freely licensed (e.g. CC BY-SA on Wikimedia Commons).
   * Null until such an image is supplied; the UI then shows the typographic card.
   */
  look: LookImage | null;
  backdrop: string | null;
  trailerUrl: string | null;
  sources: Source[];
  lastVerified: string;
}
