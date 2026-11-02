import { describe, expect, it } from 'vitest';
import { FILMS, LAST_VERIFIED } from '../data/films';
import { chronoSort, dateLine, EMPTY_FILTERS, eraOf, matchesFilters, matchesQuery } from '../data/derive';
import { buildStrands, CP } from '../layout/strands';

const byId = (id: string) => FILMS.find((f) => f.id === id)!;

describe('dataset integrity', () => {
  it('has unique ids and no duplicate titles', () => {
    expect(new Set(FILMS.map((f) => f.id)).size).toBe(FILMS.length);
    expect(new Set(FILMS.map((f) => f.title.toLowerCase())).size).toBe(FILMS.length);
  });

  it('every record has a source and the verification date', () => {
    for (const f of FILMS) {
      expect(f.sources.length, f.id).toBeGreaterThan(0);
      for (const s of f.sources) expect(s.url).toMatch(/^https:\/\//);
      expect(f.lastVerified).toBe(LAST_VERIFIED);
    }
  });

  it('starts with the 2002 debut and keeps chronology consistent with years', () => {
    const released = chronoSort(FILMS).filter((f) => f.status === 'released');
    expect(released[0].id).toBe('eeswar');
    released.forEach((f, i) => {
      expect(f.chronology).toBe(i + 1);
      if (i) expect(f.releaseYear!).toBeGreaterThanOrEqual(released[i - 1].releaseYear!);
    });
  });

  it('never invents dates', () => {
    for (const f of FILMS) {
      if (f.dateCertainty === 'tba') {
        expect(f.releaseDate, f.id).toBeNull();
        expect(dateLine(f)).toBe('TBA');
      }
      if (f.dateCertainty === 'year') expect(f.releaseDate, f.id).toBeNull();
      if (f.releaseDate) expect(f.releaseDate.startsWith(String(f.releaseYear))).toBe(true);
      if (f.status !== 'released') expect(f.chronology, f.id).toBeNull();
    }
  });

  it('counts match the verified research', () => {
    const released = FILMS.filter((f) => f.status === 'released');
    expect(released.filter((f) => f.creditType === 'lead')).toHaveLength(24);
    expect(FILMS.filter((f) => f.status !== 'released').map((f) => f.id).sort()).toEqual(
      ['fauzi', 'kalki-2898-ad-part-2', 'salaar-part-2', 'spirit'].sort(),
    );
    expect(byId('baahubali-the-epic').creditType).toBe('recut');
    expect(byId('kannappa').creditType).toBe('cameo');
    expect(byId('mirai').creditType).toBe('voice');
    expect(byId('denikaina-ready').creditType).toBe('voice');
    expect(byId('action-jackson').creditType).toBe('special-appearance');
  });

  it('records the November 2026 status of upcoming projects', () => {
    expect(byId('the-rajasaab').status).toBe('released');
    expect(byId('fauzi').releaseDate).toBeNull(); // 3 Dec 2026 date withdrawn
    expect(byId('spirit').releaseDate).toBe('2027-10-29');
    expect(byId('spirit').dateCertainty).toBe('announced');
    expect(byId('salaar-part-2').status).toBe('announced');
  });

  it('stores no metric-like fields', () => {
    for (const f of FILMS) for (const k of Object.keys(f)) expect(k).not.toMatch(/box|gross|budget|rating|popular/i);
  });
});

describe('search and filters', () => {
  it.each([
    ['bahubali', 'baahubali-the-beginning'],
    ['Baahubali 2', 'baahubali-2'],
    ['fauji', 'fauzi'],
    ['chhatrapati', 'chatrapathi'],
    ['Eeshwar', 'eeswar'],
    ['raja saab', 'the-rajasaab'],
    ['Sahoo', 'saaho'],
    ['sandeep reddy', 'spirit'],
    ['bhairava', 'kalki-2898-ad'],
    ['deva', 'salaar-part-1'],
    ['project k', 'kalki-2898-ad'],
  ])('"%s" finds %s', (q, id) => {
    expect(matchesQuery(byId(id), q)).toBe(true);
  });

  it('does not match unrelated films', () => {
    expect(matchesQuery(byId('mirchi'), 'baahubali')).toBe(false);
  });

  it('combines filters', () => {
    const n = (f: Partial<typeof EMPTY_FILTERS>) => FILMS.filter((x) => matchesFilters(x, { ...EMPTY_FILTERS, ...f })).length;
    expect(n({})).toBe(FILMS.length);
    expect(n({ release: 'upcoming' })).toBe(4);
    expect(n({ release: 'upcoming', credits: ['cameo'] })).toBe(0);
    expect(n({ credits: ['voice', 'recut'] })).toBe(3);
    expect(n({ era: 'beginnings' })).toBe(10);
    expect(n({ era: 'baahubali', query: 'conclusion' })).toBe(1);
  });

  it('puts every unreleased project in the upcoming era', () => {
    for (const f of FILMS) if (f.status !== 'released') expect(eraOf(f)).toBe('upcoming');
  });
});

describe('layout', () => {
  const specs = buildStrands(FILMS);
  it('creates one strand per credit, deterministic', () => {
    expect(specs).toHaveLength(FILMS.length);
    expect(Array.from(buildStrands(FILMS)[3].rest)).toEqual(Array.from(specs[3].rest));
    for (const s of specs) expect(s.rest).toHaveLength(CP * 3);
  });
  it('grows the debut first and undated projects last', () => {
    const order = [...specs].sort((a, b) => a.growStart - b.growStart).map((s) => s.film.id);
    expect(order[0]).toBe('eeswar');
    const last4 = order.slice(-4);
    expect(last4).toEqual(expect.arrayContaining(['kalki-2898-ad-part-2', 'salaar-part-2']));
  });
  it('draws the recut as a branch of its source film', () => {
    const epic = specs.find((s) => s.film.id === 'baahubali-the-epic')!;
    expect(specs[epic.parent].film.id).toBe('baahubali-2');
  });
});

describe('film photos', () => {
  it('every photo belongs to a real film, carries credit and licence, and its file exists', async () => {
    const { LOOKS } = await import('../data/looks');
    const fs = await import('node:fs');
    for (const [id, look] of Object.entries(LOOKS)) {
      expect(FILMS.some((f) => f.id === id), id).toBe(true);
      expect(look!.credit && look!.licence && look!.caption).toBeTruthy();
      expect(look!.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(fs.existsSync(`public/${look!.src}`), look!.src).toBe(true);
    }
  });
});
