'use client';
import { useApp } from '@/lib/store';

/**
 * The intro loader: a castle-and-moon line drawing that inks itself in.
 * Pure SVG + CSS so it paints before any WebGL or 3D code has loaded.
 */
const PATHS: { d: string; len: number; delay: number; thin?: boolean }[] = [
  { d: 'M10 200 Q110 188 210 196 T410 194', len: 420, delay: 0 },
  { d: 'M60 196 L60 120 L50 120 L70 70 L90 120 L80 120 L80 196', len: 330, delay: 0.25 },
  { d: 'M120 196 L120 96 L108 96 L134 30 L160 96 L148 96 L148 196', len: 400, delay: 0.45 },
  { d: 'M148 150 L230 150 L230 196 M190 150 L210 118 L230 150', len: 260, delay: 0.65 },
  { d: 'M240 196 L240 110 L230 110 L252 58 L274 110 L264 110 L264 196', len: 360, delay: 0.85 },
  { d: 'M264 160 L330 160 L330 196 M300 160 L300 126 L292 126 L306 96 L320 126 L312 126 L312 160', len: 300, delay: 1.05 },
  { d: 'M128 120 l0 10 M140 120 l0 10 M248 128 l0 10 M258 128 l0 10 M66 140 l0 9 M300 172 l0 8 M196 168 l0 9 M214 168 l0 9', len: 30, delay: 1.5, thin: true },
  { d: 'M372 52 A26 26 0 1 1 352 20 A20 20 0 1 0 372 52', len: 170, delay: 1.25 },
  { d: 'M30 226 Q120 216 210 224 T400 222 M70 240 Q170 232 260 238 T380 236', len: 420, delay: 1.6, thin: true },
];

export function Loader() {
  const loading = useApp((s) => s.loading);
  const faded = useApp((s) => s.faded);
  const phase = useApp((s) => s.phase);
  const done = phase !== 'boot' && !faded && !loading.active;
  return (
    <div className={`loader${done ? ' done' : ''}`} role="status" aria-live="polite" aria-hidden={done}>
      <div>
        <svg viewBox="0 0 420 250" aria-hidden="true">
          {PATHS.map((p, i) => (
            <path key={i} className={`ink${p.thin ? ' thin' : ''}`} d={p.d} style={{ ['--len' as string]: p.len, ['--d' as string]: `${p.delay}s` }} />
          ))}
        </svg>
        <div className="copy">
          <h1>The Wizarding Films</h1>
          <p>A cinematic journey · {loading.label || 'Preparing the grounds'}</p>
          <div className="bar"><i style={{ transform: `scaleX(${Math.max(0.04, loading.progress)})` }} /></div>
        </div>
      </div>
    </div>
  );
}
