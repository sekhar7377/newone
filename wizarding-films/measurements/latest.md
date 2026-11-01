# Measurements (2026-11-01)

Server: http://localhost:3100. Mobile emulation: 412×915 @2.6x, 4× CPU slowdown. GPU: SwiftShader (software), so fps figures here are NOT representative.

## Initial load

| Asset | Transferred |
|---|---|
| Initial JS: app shell referenced by the HTML (gzip) | 180.6 KB (585.0 KB raw) |
| All JS before the first scene is interactive (shell + lazy engine/three.js chunk) | 309.9 KB |
| CSS | 4.9 KB |
| Fonts | 123.4 KB |
| Hub geometry (low tier, gzip) | 257.8 KB |

## Per scene

| Scene | Geometry (low tier) | Geometry (high tier) | Triangles low / high | Draw calls high |
|---|---|---|---|---|
| hub | 257.8 KB (13 files) | 563.8 KB (13 files) | 54,897 / 142,856 | 13 |
| film-1 | 264.2 KB (21 files) | 570.2 KB (21 files) | 68,810 / 182,142 | 20 |
| film-2 | 249.3 KB (16 files) | 491.1 KB (16 files) | 70,630 / 189,470 | 17 |
| film-3 | 277.1 KB (20 files) | 583.1 KB (20 files) | 64,840 / 176,126 | 16 |
| film-4 | 260.4 KB (19 files) | 566.4 KB (19 files) | 64,156 / 164,140 | 18 |
| film-5 | 93.5 KB (6 files) | 93.5 KB (6 files) | 42,846 / 120,302 | 8 |
| film-6 | 258.4 KB (14 files) | 564.4 KB (14 files) | 63,806 / 174,898 | 14 |
| film-7 | 169.0 KB (11 files) | 372.9 KB (11 files) | 58,221 / 167,649 | 11 |
| film-8 | 261.3 KB (14 files) | 567.3 KB (14 files) | 68,094 / 179,758 | 15 |

## Time to interactive (loader dismissed), mobile, low tier

| Network | Hub (landing) | Film 1 deep link |
|---|---|---|
| decent 4G (9 Mbps, 70 ms) | 2.27 s | 2.94 s |
| slow 4G (1.6 Mbps, 150 ms) | 5.88 s | 6.04 s |
