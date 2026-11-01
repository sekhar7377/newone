'use client';
import { useEffect, useRef, useState } from 'react';
import { appStore, useApp } from '@/lib/store';
import { detectQuality, hasWebGL2 } from '@/lib/tier';
import { FILMS, type SceneId } from '@/lib/content';
import { PALETTES } from '@/scenes/palettes';
import type { Engine } from '@/lib/engine/Engine';
import { Loader } from './Loader';
import { Hud } from './Hud';
import { AnchorLayer } from './AnchorLayer';
import { HotspotPanel } from './HotspotPanel';
import { Disclaimer } from './Disclaimer';

const VALID = new Set<string>(['hub', ...FILMS.map((f) => f.id)]);

export default function Experience() {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const faded = useApp((s) => s.faded);
  const fadeColor = useApp((s) => s.fadeColor);
  const reduced = useApp((s) => s.reducedMotion);
  const phase = useApp((s) => s.phase);
  const sceneId = useApp((s) => s.sceneId);
  const contextLost = useApp((s) => s.contextLost);

  useEffect(() => {
    let disposed = false; let eng: Engine | null = null;
    const params = new URLSearchParams(location.search);
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = (e: MediaQueryListEvent) => appStore.setState({ reducedMotion: e.matches });
    appStore.setState({ reducedMotion: mq.matches || params.get('motion') === 'reduced', debug: params.has('debug') });
    mq.addEventListener('change', onMq);
    (async () => {
      if (!hasWebGL2() || params.get('fallback') === '1') { appStore.setState({ phase: 'fallback', loading: { active: false, progress: 1, label: '' }, faded: false }); return; }
      appStore.setState({ loading: { active: true, progress: 0.05, label: 'Preparing the grounds' } });
      const [quality, { Engine }] = await Promise.all([detectQuality(), import('@/lib/engine/Engine')]);
      if (disposed || !canvas.current || !container.current) return;
      appStore.setState({ quality });
      eng = new Engine(canvas.current, container.current, quality);
      if (params.has('debug')) (window as unknown as { __engine: Engine }).__engine = eng;
      setEngine(eng);
      eng.start();
      const scene = params.get('scene');
      const start = (scene && VALID.has(scene) ? scene : 'hub') as SceneId;
      await eng.go(start, { hotspot: params.get('spot') ?? undefined, intro: start === 'hub' && !params.has('nointro'), instant: true });
    })().catch((err) => { console.error(err); appStore.setState({ phase: 'fallback', loading: { active: false, progress: 1, label: '' }, faded: false }); });
    return () => { disposed = true; mq.removeEventListener('change', onMq); eng?.dispose(); };
  }, []);

  // Per-film UI accent
  useEffect(() => {
    const p = PALETTES[sceneId ?? 'hub'];
    document.documentElement.style.setProperty('--accent', p.ui.accent);
    document.documentElement.style.setProperty('--ink', p.ui.ink);
  }, [sceneId]);

  if (phase === 'fallback') return <Fallback />;

  return (
    <div className={`xp${reduced ? ' reduced' : ''}`} ref={container}>
      <canvas ref={canvas} aria-hidden="true" />
      <AnchorLayer engine={engine} />
      <Hud engine={engine} />
      <HotspotPanel />
      <div className={`fade${faded ? ' on' : ''}`} style={{ background: fadeColor }} aria-hidden="true" />
      <Loader />
      {contextLost && <div className="overlay-msg" role="alert"><div><h2 className="display">Restoring the view…</h2><p>The graphics context was lost. It should come back in a moment.</p></div></div>}
    </div>
  );
}

function Fallback() {
  return (
    <main className="archive">
      <header>
        <h1>The Wizarding Films</h1>
        <p>This device can&rsquo;t show the 3D journey (WebGL 2 is unavailable or switched off), so here is the full film archive instead: every note and fact from the eight scenes, as plain text.</p>
        <p><a href="/archive">Open the film archive →</a></p>
      </header>
      <nav aria-label="Films"><ol>{FILMS.map((f) => <li key={f.id}><a href={`/film/${f.slug}`}>{f.title}</a> ({f.year})</li>)}</ol></nav>
      <footer className="site-footer"><Disclaimer /></footer>
    </main>
  );
}
