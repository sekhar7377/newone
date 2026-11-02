import { useEffect, useReducer, useState } from 'react';
import { EXCLUDED, FILMS, LAST_VERIFIED } from '../data/films';
import { CREDIT_LABEL, eraOf, ERAS, formatDate, STATUS_LABEL, tally } from '../data/derive';
import { DEFAULT_SETTINGS, onSettings, resetSettings, setSetting, settings, type Settings } from '../scene/runtime';

const GROUPS: { title: string; items: { key: keyof Settings; label: string; min: number; max: number; step: number }[] }[] = [
  {
    title: 'Interaction',
    items: [
      { key: 'interactionRadius', label: 'Radius', min: 0.2, max: 2.5, step: 0.05 },
      { key: 'interactionForce', label: 'Force', min: 0, max: 8, step: 0.1 },
      { key: 'spring', label: 'Spring', min: 0.3, max: 12, step: 0.1 },
    ],
  },
  {
    title: 'Motion',
    items: [{ key: 'motionAmount', label: 'Drift', min: 0, max: 2.5, step: 0.05 }],
  },
  {
    title: 'Light',
    items: [
      { key: 'glow', label: 'Bloom', min: 0, max: 2, step: 0.05 },
      { key: 'filamentBrightness', label: 'Strands', min: 0.2, max: 2.5, step: 0.05 },
      { key: 'hairSpread', label: 'Spread', min: 0, max: 2.5, step: 0.05 },
      { key: 'grain', label: 'Film grain', min: 0, max: 2, step: 0.05 },
    ],
  },
];

function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let n = 0;
    let t0 = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      n++;
      if (t - t0 > 500) {
        setFps(Math.round((n * 1000) / (t - t0)));
        n = 0;
        t0 = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onSettings(force), []);
  const fps = useFps();
  const changed = JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS);

  return (
    <aside className="panel" aria-label="Settings">
      <header>
        <span>Settings</span>
        <button className="link" onClick={onClose} aria-label="Close settings">
          Close
        </button>
      </header>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3>{g.title}</h3>
          {g.items.map((it) => (
            <label className="slider" key={it.key}>
              <span>{it.label}</span>
              <input type="range" min={it.min} max={it.max} step={it.step} value={settings[it.key]} onChange={(e) => setSetting(it.key, parseFloat(e.target.value))} />
              <output>{settings[it.key].toFixed(2)}</output>
            </label>
          ))}
          {g.title === 'Motion' && (
            <label className="check">
              <input type="checkbox" checked={settings.autoRotate > 0} onChange={(e) => setSetting('autoRotate', e.target.checked ? 1 : 0)} />
              Slow auto-rotate
            </label>
          )}
        </section>
      ))}

      <section>
        <h3>Data · verified {formatDate(LAST_VERIFIED)}</h3>
        <dl className="tally">
          {tally(FILMS, (f) => f.status).map(([k, n]) => (
            <div key={k}>
              <dt>{STATUS_LABEL[k]}</dt>
              <dd>{n}</dd>
            </div>
          ))}
        </dl>
        <dl className="tally">
          {tally(FILMS, (f) => f.creditType).map(([k, n]) => (
            <div key={k}>
              <dt>{CREDIT_LABEL[k]}</dt>
              <dd>{n}</dd>
            </div>
          ))}
        </dl>
        <dl className="tally">
          {ERAS.map((e) => (
            <div key={e.id}>
              <dt>
                {e.label} <span className="dim">{e.range}</span>
              </dt>
              <dd>{FILMS.filter((f) => eraOf(f) === e.id).length}</dd>
            </div>
          ))}
        </dl>
        <p className="note">
          Every film gets the same visual weight. Strand direction is the film's era; length is seeded per title for an organic shape and does
          not encode box office, ratings or popularity. Cameo, special-appearance and voice credits are shorter and fainter. Unreleased work
          pulses. The recut grows as a branch of the film it came from.
        </p>
        <details className="flags">
          <summary>{EXCLUDED.length} researched items left out</summary>
          <ul>
            {EXCLUDED.map((x) => (
              <li key={x.title}>
                <span>{x.title}</span>
                <em>{x.reason}</em>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <footer>
        <button className="link" onClick={resetSettings} disabled={!changed}>
          Reset values
        </button>
        <span className="fps">{fps} fps</span>
      </footer>
    </aside>
  );
}
