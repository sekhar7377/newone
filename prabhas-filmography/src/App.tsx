import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FILMS } from './data/films';
import { chronoSort, yearToken } from './data/derive';
import { actions, getState, useAppState, visibleIds } from './state/store';
import { fx, intro, pointer, replayIntro, skipIntro } from './scene/runtime';
import { Scene, scenePick, SPECS, type Quality } from './scene/Scene';
import { FilmsPanel } from './ui/FilmsPanel';
import { DetailPanel } from './ui/DetailPanel';
import { SettingsPanel } from './ui/SettingsPanel';

const FIRST = chronoSort(FILMS)[0];
const RELEASED = FILMS.filter((f) => f.status === 'released');
const lastYear = Math.max(...FILMS.map((f) => f.releaseYear ?? 0));
const SUMMARY = `${FILMS.length} credits · ${yearToken(FIRST)} – ${lastYear} · ${RELEASED.length} released, ${FILMS.length - RELEASED.length} upcoming`;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ children: ReactNode; onError: (m: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(`The 3D view could not start (${e.message}). The film list still works.`);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Counter that ticks through the years during the intro, written straight to the DOM. */
function useIntroCounter(ref: React.RefObject<HTMLParagraphElement>, idle: string) {
  const [running, setRunning] = useState(intro.running);
  useEffect(() => {
    let raf = 0;
    let last = '';
    const starts = SPECS.map((s) => ({ t: s.growStart, f: s.film })).sort((a, b) => a.t - b.t);
    const loop = () => {
      let text = idle;
      if (intro.running) {
        const grown = starts.filter((s) => s.t <= intro.t);
        const cur = grown[grown.length - 1];
        text = cur ? `${yearToken(cur.f)} · ${cur.f.title} · ${grown.length} ${grown.length === 1 ? 'credit' : 'credits'}` : ' ';
      }
      if (text !== last && ref.current) {
        ref.current.textContent = text;
        last = text;
      }
      setRunning((r) => (r === intro.running ? r : intro.running));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ref, idle]);
  return running;
}

export function App() {
  const quality: Quality = useMemo(() => (window.innerWidth < 700 ? 'low' : 'medium'), []);
  const [glOk] = useState(webglAvailable);
  const [error, setError] = useState<string | null>(glOk ? null : 'WebGL 2 is not available in this browser, so the 3D view is off. The film list below still works.');
  const panel = useAppState((s) => s.panel);
  const selectedId = useAppState((s) => s.selectedId);
  const vis = useAppState((s) => visibleIds(s));
  const selected = selectedId ? FILMS.find((f) => f.id === selectedId) ?? null : null;
  const counter = useRef<HTMLParagraphElement>(null);
  const idle = vis.size === FILMS.length ? SUMMARY : `${vis.size} of ${FILMS.length} credits shown`;
  const running = useIntroCounter(counter, idle);
  const stage = useRef<HTMLDivElement>(null);
  const downAt = useRef({ x: 0, y: 0 });
  const effectivePanel = error && panel === 'none' && !selected ? 'films' : panel;

  // Escape closes the detail first, then any open panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (getState().selectedId) actions.select(null);
      else if (getState().panel !== 'none') actions.setPanel('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Deep link straight to a film: skip the intro so it is visible immediately.
  useEffect(() => {
    if (getState().selectedId) skipIntro();
  }, []);

  return (
    <>
      <div
        ref={stage}
        className="stage"
        onPointerEnter={() => (pointer.inside = true)}
        onPointerLeave={() => {
          pointer.inside = false;
          pointer.down = false;
          fx.hoverIndex = -1;
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch' && !e.isPrimary) {
            pointer.dragDist = 999; // second finger: this is a pinch, not a tap
            return;
          }
          pointer.down = true;
          pointer.dragDist = 0;
          downAt.current = { x: e.clientX, y: e.clientY };
          if (e.pointerType !== 'mouse') pointer.inside = true;
        }}
        onPointerMove={(e) => {
          pointer.x = e.clientX;
          pointer.y = e.clientY;
          if (pointer.down) pointer.dragDist = Math.max(pointer.dragDist, Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y));
          else if (e.pointerType === 'mouse') {
            const i = scenePick.at(e.clientX, e.clientY);
            fx.hoverIndex = i;
            stage.current!.style.cursor = i >= 0 ? 'pointer' : '';
          }
        }}
        onPointerUp={(e) => {
          pointer.down = false;
          if (e.pointerType !== 'mouse') pointer.inside = false;
          if (pointer.dragDist > 5) return;
          const i = scenePick.at(e.clientX, e.clientY);
          if (i >= 0) actions.select(SPECS[i].film.id);
          else if (getState().selectedId) actions.select(null);
        }}
      >
        {glOk && !error && (
          <SceneBoundary onError={setError}>
            <Scene quality={quality} onError={setError} />
          </SceneBoundary>
        )}
      </div>
      <div id="labels" className="labels" aria-hidden="true" />

      <div className="overlay">
        <div className="title">
          <h1>
            Prabhas <em>on screen</em>
          </h1>
          <p ref={counter} aria-hidden="true">
            {SUMMARY}
          </p>
          <p className="sr-only">{idle}</p>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <p className="hint">
          <span className="hint-mouse">Scroll up to zoom in, down to zoom out · Hold and drag to rotate 360° · Click a strand to open a film · Touch the nucleus</span>
          <span className="hint-touch">Pinch or use + / − to zoom · Drag to rotate 360° · Tap a strand to open a film</span>
        </p>

        <div className="zoom" role="group" aria-label="Zoom">
          <button onClick={() => (fx.zoomBy *= 0.75)} aria-label="Zoom in">+</button>
          <button onClick={() => (fx.zoomBy *= 1.33)} aria-label="Zoom out">−</button>
        </div>

        <div className="actions">
          {running ? <button onClick={skipIntro}>Skip intro</button> : <button onClick={replayIntro}>Replay intro</button>}
          <button
            onClick={() => {
              actions.select(null);
              fx.resetCameraAt++;
            }}
          >
            Reset view
          </button>
          <button onClick={() => actions.setPanel(effectivePanel === 'films' ? 'none' : 'films')} aria-expanded={effectivePanel === 'films'}>
            Films
          </button>
          <button onClick={() => actions.setPanel(effectivePanel === 'settings' ? 'none' : 'settings')} aria-expanded={effectivePanel === 'settings'}>
            Settings
          </button>
        </div>

        {effectivePanel === 'films' && <FilmsPanel onClose={() => actions.setPanel('none')} />}
        {effectivePanel === 'settings' && <SettingsPanel onClose={() => actions.setPanel('none')} />}
        {selected && <DetailPanel film={selected} />}
      </div>
    </>
  );
}
