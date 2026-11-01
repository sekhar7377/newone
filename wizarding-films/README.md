# The Wizarding Films: A Cinematic Journey

An unofficial, immersive fan tribute to the eight Harry Potter films. You glide
through eight stylised, fog-heavy 3D scenes (one per film) along hand-authored
camera paths, with glowing hotspots that open original notes, release details
and behind-the-scenes facts, plus line illustrations that ink themselves into
the air.

> **Fan project.** Not affiliated with Warner Bros., J.K. Rowling or Wizarding
> World. Every model, illustration, sound and line of copy here is original: no
> film stills, posters, logos, trademarked fonts, likenesses or quoted script or
> book text.

```bash
npm install
npm run dev          # http://localhost:3000   (geometry is generated on first build; run `npm run geo` once for dev)
npm run build && npm start
```

Useful URL flags: `?debug` (fps / triangles / draw calls overlay),
`?quality=low|medium|high`, `?scene=film-3&spot=f3-clock` (deep link),
`?nointro`, `?motion=reduced`, `?fallback=1` (force the HTML archive).

## Contents

- [What's here](#whats-here)
- [Architecture](#architecture)
- [Performance](#performance)
- [Geometry pipeline](#geometry-pipeline)
- [Shaders](#shaders)
- [Navigation](#navigation)
- [Content, studio and scheduling](#content-studio-and-scheduling)
- [Accessibility and resilience](#accessibility-and-resilience)
- [Adding a new scene](#adding-a-new-scene)
- [Known gaps](#known-gaps)

## What's here

| Brief deliverable | Where |
|---|---|
| Scaffold: `/scenes`, `/shaders`, `/content`, `/studio`, `/lib/loaders` | as named |
| Performance-tiered renderer + loader | `lib/tier.ts`, `lib/quality.ts`, `lib/engine/Engine.ts`, `lib/loaders/*` |
| Intro loader that inks itself in, lake fly-in, hub map with 8 waypoints | `components/Loader.tsx`, `scenes/hub.ts` |
| Film 1, every technique | `scenes/film1.ts`, `content/scenes/film-1.json` |
| Films 2–8 | `scenes/film2.ts` … `scenes/film8.ts` |
| Blender export script + binary loaders | `tools/blender/export_silhouette.py`, `lib/loaders/silhouette.ts`, `lib/loaders/placements.ts` |
| Shaders: fog, window glow, flag sway, candle flicker, particles, line illustration (+ water, sky, orbs, runes, post) | `shaders/*.glsl.ts` |
| `/studio`: hotspot placer, illustration tool, content scheduler | `studio/StudioApp.tsx`, `app/api/studio/save/route.ts` |
| HTML fallback archive (no-WebGL, SEO) | `app/archive`, `app/film/[slug]` |
| Measurements | `scripts/measure.mjs` → `measurements/latest.md` |

## Architecture

```
app/                 Next.js App Router: / (experience), /archive, /film/[slug], /studio, /api/studio/save
components/          React UI: loader, HUD + progress rail, hotspot buttons, parchment panel
lib/
  engine/            Engine (loop, streaming, context loss), CameraRig (spline nav + look),
                     SceneBuilder, MaterialKit, hotspots, line illustrations, post pass
  loaders/           SIL1 / PLC1 binary loaders, gzip fetch with DecompressionStream
  store.ts           Zustand store (scene, phase, hotspots, audio, quality, stats)
  tier.ts            detect-gpu + heuristics → quality settings
  audio.ts           procedural Web Audio ambience (no audio files)
scenes/              one module per scene + palettes (fog, sky, light, particles per film)
shaders/             GLSL as TS template strings
content/             the "CMS": films.json, scenes/*.json (paths, hotspots, collectibles), illustrations/*.json
studio/              /studio authoring app
scripts/             procedural geometry build, illustration build, path checker, measurement
tools/blender/       Blender exporter for the same binary formats
```

**Stack choices.** Next.js 16 (App Router) + TypeScript + **vanilla three.js**
rather than React Three Fiber: the brief allows "vanilla Three.js if leaner",
and it is. R3F + drei would add roughly 40–60 KB gzipped and a React
reconciliation layer per frame. React drives only the DOM UI; the engine runs its
own loop and writes per-frame DOM transforms directly. Scroll-to-progress
mapping is a ~40-line damped integrator in `CameraRig` instead of GSAP or Lenis
(no page scroll exists to hijack). Zustand holds global state.

**Loading strategy.** The landing page ships React, the UI and Zustand. Three.js,
the engine and the shaders form a separate chunk, fetched in parallel with GPU
tier detection while the SVG loader inks itself in. Each scene is its own chunk
(`scenes/index.ts`) with its own content JSON. It is fetched when its waypoint
is hovered or focused, or 2.5 s after the previous scene settles. Only the
current and next scenes stay in memory; everything else is disposed
(geometries, materials, decoded buffers).

## Performance

Run `npm run build && npm start`, then `node scripts/measure.mjs http://localhost:3000`
(Playwright needs to be installed). The table in `measurements/latest.md` is
regenerated each time.

### Measured in this repo's CI-style container (headless Chromium, software GPU)

See [`measurements/latest.md`](measurements/latest.md) for the full output. Summary:

| Budget (brief) | Target | Measured | Status |
|---|---|---|---|
| Initial JS (app shell in the HTML, gzip) | < 250 KB | **180.6 KB** | ✅ |
| All JS before the first scene is interactive (shell + lazy three.js/engine chunk) | n/a | 309.9 KB | ⚠️ three.js core is ~155 KB of this; it loads while the loader animates |
| Geometry per scene (gzip) | < 2.5 MB | **94–583 KB** (high tier), 94–277 KB (low) | ✅ |
| Triangles per scene, desktop / high | ~200k | **120k–189k** | ✅ |
| Triangles per scene, low tier | ~80k | **43k–71k** | ✅ |
| Draw calls per scene | n/a | 8–20 | ✅ |
| Interactive on decent 4G (9 Mbps, 70 ms RTT, 4× CPU slowdown) | < 5 s | **2.3 s** hub · **2.9 s** Film 1 deep link | ✅ |
| Interactive on Lighthouse "slow 4G" (1.6 Mbps, 150 ms) | n/a | 5.9 s hub · 6.0 s Film 1 | stricter than the brief's "decent 4G" |
| 60 fps desktop / ≥ 30 fps mid-range Android | 60 / 30 | **not measured**: no real GPU here (SwiftShader) | ⏳ see below |

Per-scene detail (low / high tier geometry, triangles, draw calls) is in
`measurements/latest.md`. Gzip sizes come from `next start`; Vercel serves
Brotli, which is typically 10–15% smaller for JS.

### Not yet measured: real phone and Lighthouse

The brief asks for Lighthouse and frame-rate numbers **measured on a real phone**.
This build was produced in a headless cloud container with no physical device
and no GPU (WebGL runs on SwiftShader, a CPU rasteriser). Those numbers do not
exist yet, and none are invented here. To fill them in:

1. Deploy (Vercel) or expose `npm start` on your LAN.
2. **Frame rate:** open `/?debug` on the phone, fly through each film and note the
   `fps` line (it is a 0.5 s rolling average), plus the auto-selected `tier`.
3. **Lighthouse:** Chrome DevTools → Lighthouse → Mobile, or remote-debug the
   phone over USB (`chrome://inspect`) and record a Performance trace.
4. Paste the results into the table below.

| Device | Tier chosen | Lighthouse perf | LCP | TBT | Interactive (4G) | fps hub | fps Film 1 | fps worst film |
|---|---|---|---|---|---|---|---|---|
| _mid-range Android_ | | | | | | | | |
| _iPhone_ | | | | | | | | |
| _desktop GPU_ | | | | | | | | |

### Budget mechanics

- **Tiers** (`lib/quality.ts`): high = all instances, 3 mist octaves, post pass,
  3,000 particles, hi-res terrain, pixel ratio ≤ 2. Medium = 60% of instances,
  2 octaves, no post. Low = 35% of instances, 1 octave, 500 particles, low-res
  terrain, pixel ratio ≤ 1.25. Mobile is always capped at 1.5. detect-gpu
  benchmarks are self-hosted under `/benchmarks`, and software renderers are
  forced to low.
- **Instancing:** every repeated object (2,600 pines, 6,976 prophecy orbs, 6,207
  hedgerow segments, 280 floating candles…) is one `InstancedMesh`. A typical
  scene draws in 8–20 calls.
- **No dynamic shadows, no real-time reflections, no textures** on the silhouette
  path. Lighting is height gradient + derivative normals + rim + fog.
- **Caching:** geometry URLs carry a content hash (`?v=` from the manifest),
  served `Cache-Control: public, max-age=31536000, immutable`.

## Geometry pipeline

Two tiny binary formats, documented byte-for-byte in `scripts/geo/formats.mjs`:

- **SIL1** silhouette mesh: positions only, rounded to 4 decimals, int16-quantised
  to the bounding box (float32 if the step would exceed the tolerance), uint16 or
  uint32 indices. **No UVs and no normals:** the fragment shader derives a face
  normal from `dFdx/dFdy` of world position.
- **PLC1** placements: per instance `[pos f32×3 | quat int16×4 | scale f32×3]`,
  32 bytes, shuffled at export so the first N instances are always an even spread
  (that is how tiers thin instances).

Every file is written twice: raw and `.gz`. The loader fetches the `.gz` and
inflates it with `DecompressionStream`, so transfers are compressed no matter how
the host treats `application/octet-stream`. It falls back to the raw file only
on browsers without `DecompressionStream`.

**Blender:** `tools/blender/export_silhouette.py`. Put meshes in a `SIL`
collection and scatter sets in child collections of `SCATTER` (paint them with
Scatter / Geometry Nodes on a low-poly proxy; only transforms export). Then run:

```bash
blender grounds.blend --background --python tools/blender/export_silhouette.py -- --out public/geo/film-1 --decimate 0.4 --cull-below -12
```

`--cull-below` drops triangles hidden under water or fog. The Python writer is
byte-identical to the JS writer (verified by writing the same mesh with both).

**Procedural build (what ships today):** with no Blender files in the repo,
`scripts/build-geometry.mjs` models every asset procedurally (castle, trees,
boats, hedges, shelves, tent, car, terrain heightfields, scatter) and writes the
same formats. It runs automatically in `prebuild`. `scripts/check-paths.mjs`
samples every camera spline against the terrain and reports the minimum
clearance.

**Hero glTF:** not used. The brief allows glTF + Draco/meshopt + KTX2 for
detailed hero objects, but the silhouette style didn't need any, so no glTF
loader ships in the bundle.

## Shaders

| File | Technique |
|---|---|
| `fog.glsl.ts` | Analytic exponential height fog, vertical colour gradient, glow toward the key light, animated fbm mist (octaves = tier), local fire tint, lightning flash |
| `silhouette.glsl.ts` | Derivative normals, height gradient, rim light, snow on up-facing surfaces; `SWAY`, `BOB`, `FLOAT` vertex variants |
| `windowGlow.glsl.ts` | Window glow without bloom: inflated instance quad, rounded/arched core + exponential halo, additive, fades as the view turns edge-on; `FLAME` and `BEAM` billboards |
| `flagSway.glsl.ts` | Vertex sine waves growing with x² toward the free edge, phase from instance world position |
| `candleFlicker.glsl.ts` | Per-instance two-octave noise of (time, instance seed) |
| `water.glsl.ts` | Scrolling noise-derivative normals, fog/sky gradient sampled along the reflected ray, specular streak (also ice and polished floors) |
| `particles.glsl.ts` | Fully GPU particles: camera-wrapped boxes (snow, rain, embers, fireflies, motes) and rising smoke columns |
| `line.glsl.ts` | Ribbon expansion, draw-in by `uProgress` along total stroke length with a pen-tip taper, sinusoidal wobble |
| `orb.glsl.ts`, `rune.glsl.ts`, `sky.glsl.ts`, `post.glsl.ts` | Prophecy glass, hotspot runes, sky dome, high-tier vignette + grain + chromatic edge |

## Navigation

Implemented in `lib/engine/CameraRig.ts`, exactly as the case study describes:

- No free roam. Each scene has a looping centripetal Catmull-Rom spline
  (`content/scenes/*.json → path.points`) plus a parallel look-target spline.
- Scroll, swipe or arrow keys travel with damped easing. PageUp/PageDown and
  Space jump between hotspots. The camera banks slightly into turns.
- On a first visit to a scene, backward travel is blocked until you have moved
  25 m forward, with a gentle on-screen explanation. Returning visitors and deep
  links are unlocked.
- Hover look is clamped to ±35° yaw and ±15° pitch. Click-drag gives a full look
  that springs back on release. Touch: horizontal drag looks, vertical swipe
  travels with fling. Gyroscope is an opt-in "Tilt" button (it requests iOS
  permission).
- The pointer is never locked.
- The progress rail shows position and hotspot ticks. Clicking a tick flies there
  the short way round the loop.

## Content, studio and scheduling

- `content/films.json`: film metadata. `content/scenes/<id>.json`: camera path,
  hotspots and collectibles. A hotspot position is absolute or `at` (path
  parameter) + `offset`. `content/illustrations/<id>.json`: drawings.
- **Stroke format:** `{ p: [x,y,z,…] centimetres (ints), w: [0–255 per point] }`.
  The 20 starter drawings total about 50 KB of JSON across all films (before gzip).
- **Scheduling:** every hotspot and illustration has `publishAt`. Future items are
  hidden in 3D and in the archive (which revalidates hourly). Two examples are
  live: a Film 1 anniversary note (16 Nov 2026) and a back-to-school note
  (1 Sep 2027).
- **"New" markers:** items published since your last visit (localStorage,
  try/catch-wrapped) get a white "New" badge on the rune, button and rail.
- **Collectibles:** three hidden glints per film with a found/total counter,
  persisted locally.
- **Deep links:** `/?scene=film-4&spot=f4-maze`. The URL updates as you open
  hotspots; the Share button uses the Web Share API or copies the link.

### `/studio` (noindex, its own chunk)

1. **Hotspot placer.** Pick a scene, fly the real path or orbit freely, select or
   add a hotspot, then **Place by click**: it raycasts the actual geometry
   (instanced meshes included) and snaps the hotspot 2 m above the hit. Fine-tune
   with the translate gizmo. **Use current camera view** stores `view: {t, yaw, pitch}`.
2. **Illustration tool.** Select a hotspot → **Start/Edit drawing** frames a plane
   beside it. Draw with mouse, touch or pen; `PointerEvent.pressure` (Apple
   Pencil, Wacom) sets the width, and coalesced events keep strokes smooth. The
   preview is the live `LineIllustration` renderer. **Keep**, then **Save
   illustrations**.
3. **Content scheduler.** Edit publish dates for every hotspot and drawing, and
   preview the site **as of** any date.

**Save** writes to `/content` through `POST /api/studio/save`. This only works
under `npm run dev`; production returns 403 and the studio downloads the JSON
instead. Commit the JSON to publish. Swapping in Sanity or Contentful means
replacing `loadSceneContent()` and that one API route.

## Accessibility and resilience

- `prefers-reduced-motion` (or `?motion=reduced`): travel jumps between hotspots
  with a short crossfade instead of flying, the intro flight is skipped, line
  wobble is off, and title and panel animations are reduced.
- Keyboard: Tab reaches every hotspot (real `<button>`s projected over the 3D
  runes), Enter opens, Esc closes and returns focus, arrows travel, PageUp/Down
  step between hotspots. Focus rings are visible throughout.
- The parchment panel content is mirrored into an `aria-live` region.
  Illustrations have alt text (shown in the panel and the archive).
- **HTML fallback:** with no WebGL 2 (or JS) visitors get `/archive` and
  `/film/[slug]`: statically generated, semantic headings, every note, and the
  illustrations drawn as inline SVG from the same stroke data. This is also the
  SEO surface.
- **Resilience:** the render loop stops when the tab is hidden (audio suspends
  too). WebGL context loss shows a notice and resumes on restore. All
  localStorage access is guarded.
- **Sound:** off by default; the toggle is labelled and `aria-pressed`. All
  ambience is synthesised with Web Audio (wind, lapping water, bells, crackle,
  drone, storm with thunder synced to lightning), so there are zero audio files.

## Adding a new scene

1. **Geometry:** export from Blender into `public/geo/<id>/`, or add a block to
   `scripts/build-geometry.mjs`. Reuse `kit/*` meshes and add placement files.
2. **Palette:** add an entry to `scenes/palettes.ts` (sky, fog, light, rim, glow,
   particles, ambience).
3. **Scene module:** create `scenes/<id>.ts` exporting `{ build(b) }`. Use
   `b.sky()`, `b.mesh()`, `b.instanced()`, `b.glows()`, `b.water()`,
   `b.particles()`, `b.castle()`, or `grounds(b)` for the shared castle grounds.
   Return optional `update`, `outro` and `events` hooks.
4. Register it in `scenes/index.ts`, and in `lib/content.ts` (`SceneId`) and
   `content/films.json` if it is a film.
5. **Content:** create `content/scenes/<id>.json` with a path (8–15 points that
   pass every point of interest from a flattering angle) and 10–15 hotspots. Run
   `node scripts/check-paths.mjs <id>` until clearance is positive. Then refine
   in `/studio`.
6. Add a waypoint to `WAYPOINTS` in `scenes/hub.ts`.

## Known gaps

- Real-device Lighthouse and fps numbers are still to be collected (see above).
- No physical Blender source files: geometry is procedural (same formats and
  loader). The exporter is tested only at the binary-writer level, not inside
  Blender.
- The studio saves to local JSON (no hosted CMS).
- Facts in hotspot copy were written from general knowledge of the films'
  production history. Items that are widely reported rather than documented
  are worded that way. Give them a fact-check pass before launch.
