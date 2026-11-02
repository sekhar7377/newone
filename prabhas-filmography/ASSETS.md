# Asset and source manifest

Verified 2 November 2026.

## Visual assets

| Asset | Source | Licence / status |
|---|---|---|
| Film posters, backdrops, stills | **None bundled** | No artwork found with a clear licence for reuse. `poster`/`backdrop` are `null`; the detail view renders a typographic title card instead. To add one, put a permitted file in `public/posters/`, set `poster: 'posters/<file>'` on the film, and add a row here. A broken image falls back to the title card. |
| Trailers | **None linked** | `trailerUrl` is `null` for every film because no official channel URL was verified. |
| Strands, nucleus, dust, film grain | Generated in code (`src/scene/`) | Original |
| Favicon | Inline SVG in `index.html` | Original |
| Fonts: Cinzel, Instrument Serif, JetBrains Mono | Google Fonts | SIL Open Font License 1.1 |
| Audio | None | The site has no sound |

## Data sources

Every film record in `src/data/films.ts` stores its own `sources` (shown in the detail view). The main references:

- Wikipedia, [Prabhas filmography](https://en.wikipedia.org/wiki/Prabhas_filmography): credit list, character names, credit types (voice, cameo, recut) and years. Each film also links its own Wikipedia article.
- *Baahubali: The Epic* release date: [IANS](https://ianslive.in/baahubali-the-epic-to-release-on-october-31-says-director-s-s-rajamouli--20250710135724)
- *The RajaSaab* release: [WION](https://www.wionews.com/entertainment/the-raja-saab-box-office-collection-day-1-prabhas-horror-comedy-opens-with-this-much-despite-mixed-reviews-1768029860841/amp)
- *Fauzi* postponement: [Pinkvilla](https://www.pinkvilla.com/entertainment/south/fauzi-prabhas-starrer-producer-confirms-film-to-be-delayed-from-december-3-calls-it-grand-like-baahubali-1405535), [Hollywood Reporter India](https://www.hollywoodreporterindia.com/features/insight/fauzi-delayed-prabhas-led-period-epic-pushed-past-december-release), [Outlook India (original date)](https://www.outlookindia.com/art-entertainment/south-cinema/prabhass-fauzi-release-date-announced-hanu-raghavapudi-film-out-in-dec-2026)
- *Spirit*: [Bollywood Hungama (29 Oct 2027)](https://www.bollywoodhungama.com/news/bollywood/sandeep-reddy-vanga-prabhas-spirit-postponed-to-diwali-2027-set-to-release-on-october-29/), [Great Andhra (shoot progress)](https://www.greatandhra.com/movies/movie-news/sandeep-reddy-shares-exciting-update-on-prabhas-spirit/)
- *Kalki 2898 AD: Part 2*: [Hollywood Reporter India](https://www.hollywoodreporterindia.com/features/insight/nag-ashwin-confirms-kalki-2898-ad-part-2-progress-team-completes-10-day-shoot-amid-delays), [Pinkvilla](https://www.pinkvilla.com/entertainment/south/kalki-2-nag-ashwin-confirms-shoot-for-prabhas-starrer-to-resume-from-mid-october-2026-aims-to-release-sequel-in-2028-1405619)
- *Salaar: Part 2*: [The Week](https://www.theweek.in/news/entertainment/2026/10/25/prabhas-prashanth-neel-confirms-salaar-2-updates.html)
- Excluded *The RajaSaab 2: Circus 1935*: [Koimoi](https://www.koimoi.com/south-indian-cinema/rajasaab-2-prabhas-sequel-gets-an-official-title-heres-what-we-know/)

Directors of the early films and the short synopses are written from general film knowledge and should be spot-checked against each film's linked article before publishing. Box office, budgets, ratings and audience metrics are deliberately not stored.

## Interaction reference

[jobhunt.asmcleod.com](https://jobhunt.asmcleod.com/). Its interaction model and visual grammar were reproduced independently. No code or data from it is included.
