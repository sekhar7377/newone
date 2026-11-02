# Madeofnext portfolio

A cinematic, single-page studio portfolio. Plain HTML/CSS/JS, no build step.

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

- `index.html`: page structure and copy
- `assets/styles.css`: design tokens (colours, type scale) at the top
- `assets/main.js`: the `PROJECTS` array at the top holds the case studies. Edit it to add your real work.

Motion uses GSAP + ScrollTrigger + Lenis from jsDelivr. If they fail to load, or the visitor prefers reduced motion, the site falls back to a normal scrolling page.

## Also in this repo

- [`prabhas-filmography/`](prabhas-filmography/): an interactive Prabhas filmography (React, TypeScript, Vite, Three.js). See its README.
