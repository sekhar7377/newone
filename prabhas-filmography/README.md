# Prabhas On Screen

An interactive filmography of Prabhas, from his 2002 debut *Eeswar* to the projects announced as of **2 November 2026**. Each film credit is a glowing strand growing out of a central nucleus. The interaction model comes from [jobhunt.asmcleod.com](https://jobhunt.asmcleod.com/), which shows a job search the same way, one strand per application.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ on http://localhost:4173
npm test           # dataset, search and layout tests
```

`dist/` is static and uses relative paths, so any static host works, including a GitHub Pages sub-path.

## 1. Reference analysis

I inspected the reference live at 1280×800 and 390×844, and read its public production bundle. "Observed" means I saw it on screen or in the shipped code. I don't know the original source or build setup beyond what the bundle shows (React, Three.js through @react-three/fiber, postprocessing).

**Observed**
- A full-screen dark navy WebGL scene (`#020610`). In the centre is a glowing orange nucleus, with about 76–158 hair-like strands radiating from it, one per job application.
- Strand colour depends on distance from the nucleus: orange, then cream, then cyan, then blue. Strands drift slowly. Each is a bundle of fine fibres that fans out toward the tip, with tip dots and small beads of light travelling outward.
- Data drives the shape. Job category sets the direction cone. Status sets brightness, glints and pulses: interviews get a branch and a faster pulse, rejections curl back and are shorter. Application date sets the order in which strands grow during the intro.
- Each tip has an uppercase mono label with three lines: company (bright), job title (dim), status (colour-coded). Labels flip to the left of the tip when it is left of the nucleus, and fade with depth.
- Intro: strands grow in date order over about 58 s, while the top-left counter ticks through the dates ("Sep 6, 2026 · 76 applications"). There are **Skip intro** and **Replay intro** buttons.
- Interactions: drag to orbit with a slow auto-rotate, scroll or pinch to zoom, and the cursor pushes nearby strands aside (spring physics). Clicking the nucleus sends a ripple along every strand. There is no per-record selection, search or filter.
- A **Settings** panel (right side; a bottom sheet on mobile) has sliders for interaction, motion and light, a data tally by status and category, data notes, *Reset values* and an fps counter.
- Bottom-left hint: "Drag to orbit · Scroll or pinch to zoom · Drift the cursor through the strands · Touch the nucleus". Fonts are Instrument Serif and JetBrains Mono. There is bloom, ACES tone mapping, a vignette and soft noise.
- Mobile at ≤700 px: lower quality, the camera pulled back for portrait, smaller labels, the hint moved up and the panel as a bottom sheet.
- Reduced motion skips the intro.

## 2. Reference → Prabhas mapping

| Reference element | Prabhas equivalent | Interaction | Data required |
|---|---|---|---|
| Nucleus (the job search) | Prabhas, the origin of every credit | Click or tap → ripple along all strands; hover flare | – |
| Strand per application | Strand per film credit (33) | Hover highlights it, click opens the film, cursor pushes strands aside | `id`, `title` |
| Category → direction cone | **Era** → direction cone (Beginnings 2002–08, Ascent 2009–14, Baahubali 2015–17, Pan-India 2019–24, Recent 2025–26, Upcoming) | Era filter | `releaseYear`, `status` |
| Status → brightness, glint, curl | Status/credit → look: released lead = full; **filming** = brighter with a fast pulse; **announced** = dimmer pulse; cameo, special appearance and voice = short and faint | Release and credit filters | `status`, `creditType` |
| Interview branch | **Recut** branches from its source film (*Baahubali: The Epic* grows out of *Baahubali 2*) | – | `parentId` |
| Application date → intro growth order | Release chronology, debut first; undated projects grow last | Skip/Replay intro; counter ticks "2005 · Chatrapathi · 6 credits" | `chronology`, `releaseDate` |
| Tip label: company / title / status | Film title / year · director / status or credit type | Click near a label to select | `title`, `releaseYear`, `director` |
| Counter "N applications · date range" | "33 credits · 2002 – 2027 · 29 released, 4 upcoming"; "N of 33 credits shown" when filtered | – | counts from the dataset |
| Settings panel + tally | Same sliders (adds a film-grain slider and auto-rotate toggle), tallies by status, credit and era, the list of excluded items, and the layout rule | Sliders, Reset values | dataset |
| *(not in reference)* | **Films** panel: search, filters and an accessible chronological list | Search, filter chips, Clear filters, list hover highlights its strand | all fields |
| *(not in reference)* | Film **detail** panel | Close / Esc, Prev/Next, Copy link; URL `?film=` with Back/Forward support | all fields |
| *(not in reference)* | **Reset view** | Flies the camera home and clears the selection | – |

**Layout rule.** All films have equal visual weight. Strand length is seeded per title, between 3.2 and 5.2 units, only so the shape looks organic. It does not encode box office, ratings, budget or popularity. None of those are stored.

## 3. Data

- [`src/data/films.ts`](src/data/films.ts) is the typed central dataset. Fields: `id, title, alternateTitles, releaseYear, releaseDate, dateCertainty, chronology, status, creditType, director, characters, genres, languages, franchise, synopsis, note, parentId, poster, backdrop, trailerUrl, sources, lastVerified`.
- 33 credits: 24 released lead films (Eeswar → The RajaSaab), 5 other credits (2 voice, 1 cameo, 1 special appearance, 1 recut) and 4 upcoming projects.
- Status as of 2 Nov 2026:
  - **The RajaSaab:** released 9 Jan 2026.
  - **Fauzi:** filming. Its announced 3 Dec 2026 date was withdrawn in Sept 2026 and the date is now TBA.
  - **Spirit:** filming, with 29 Oct 2027 announced.
  - **Kalki 2898 AD: Part 2:** filming has started, about 10 days shot. The 2028 target is only reported, so the date is TBA.
  - **Salaar: Part 2 – Shouryaanga Parvam:** announced, not yet filming, date TBA.
- Unknown values stay `null` and show as "Unknown", "TBA" or "Not revealed". Day-level dates are stored only where they are well documented; otherwise only the year is kept.
- Excluded, with reasons (also shown in Settings): *The RajaSaab 2: Circus 1935* (teased in the end credits, Prabhas's involvement unconfirmed), the *Bujji & Bhairava* series, and the *Modern Masters* documentary.
- [`ASSETS.md`](ASSETS.md) is the asset and source manifest.

## 4. Code map

```
src/data/       films.ts (dataset), derive.ts (eras, labels, search, filters), types.ts
src/layout/     strands.ts: pure, deterministic film → strand geometry and intro timing
src/scene/      Scene.tsx (canvas, nucleus, dust, camera rig, effects), sim.ts (spring physics),
                shaders.ts, labels.ts (imperative DOM labels), runtime.ts (non-React mutable state)
src/state/      store.ts: selection, filters and panel, synced to the URL and history
src/ui/         FilmsPanel, DetailPanel, SettingsPanel
```

One render loop drives everything. Pointer movement and animation write to plain mutable objects, never React state, so moving the mouse doesn't re-render components. Labels are updated through `transform` and `opacity` only. All listeners and GPU resources are cleaned up on unmount.

## 5. Validation (2 Nov 2026)

- `npm test`: 24 tests pass. They cover unique ids, sources on every record, chronology starting at the debut, no invented dates, counts, alternate-spelling search, combined filters and deterministic layout.
- `npm run build` passes, including the type check.
- Playwright (headless Chromium, software WebGL; [`scripts/e2e.cjs`](scripts/e2e.cjs)) passes 31 checks:
  - skip and replay intro
  - search for bahubali, Fauji, chhatrapati, eeshwar, rajamouli, bhairava, raja saab and salar
  - the empty state and Clear filters
  - Upcoming = 4, Upcoming + Cameo = empty, Voice + Recut = 3, with filters written to the URL
  - selecting from the list (the Films panel closes), Next, Back/Forward through selections, Esc to close
  - clicking a strand tip on the canvas opens that film
  - the `?film=spirit` deep link shows the announced date and "Not revealed"
  - an invalid deep link is ignored
  - mobile 390×844 with touch: the detail sheet fits and there is no horizontal scroll
  - reduced motion skips the intro
  - no console errors
- Side-by-side with the reference at 1280×800 and 390×844, the composition matches: nucleus, radial strands, tip labels, counter, hint and pill buttons.

Screenshots from that run are in [`docs/screenshots/`](docs/screenshots/).

## 6. Known differences and limitations

- **Palette:** ember and gold fading to steel and midnight, instead of the reference's orange-to-cyan. The h1 title uses Cinzel. Both are deliberate art-direction changes.
- **Intro length:** about 30 s instead of 58 s. It is skippable, and skipped automatically under reduced motion or when opened from a deep link.
- **Additions beyond the reference:** search, filters, selection, the detail panel, the Films panel and Reset view. The reference has none of these.
- **No posters or trailers.** No artwork with a clear licence for reuse was found, and no official trailer URL was verified, so the detail view uses a typographic title card and says no trailer link is verified.
- **Synopses:** some early films have no synopsis (`null`) rather than a guessed one.
- **Labels:** like the reference, labels can overlap where strands cluster. Hover or select a strand to bring its label forward. The Films list gives a complete, readable alternative.
- **Performance:** WebGL 2 is required. Without it, an error message appears and the Films list opens instead. I tested only under software rendering, so real GPU frame rates were not measured.
- **Upcoming statuses** change quickly. Re-check `films.ts` and update `LAST_VERIFIED` before publishing.
