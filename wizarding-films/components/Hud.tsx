'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp, appStore, frame } from '@/lib/store';
import { filmById } from '@/lib/content';
import { nextFilm } from '@/scenes';
import type { Engine } from '@/lib/engine/Engine';
import { Disclaimer } from './Disclaimer';

const Icon = {
  sound: (on: boolean) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" />{on ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16 9l5 6M21 9l-5 6" />}</svg>),
  map: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" /></svg>),
  share: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" /></svg>),
  gyro: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M3 9a9 9 0 0 1 0 6M21 9a9 9 0 0 1 0 6" /></svg>),
};

function Rail({ engine }: { engine: Engine | null }) {
  const hotspots = useApp((s) => s.hotspots);
  const near = useApp((s) => s.nearHotspot);
  const fill = useRef<HTMLDivElement>(null), head = useRef<HTMLDivElement>(null);
  useEffect(() => frame.on((p) => {
    if (fill.current) fill.current.style.width = `${p * 100}%`;
    if (head.current) head.current.style.left = `${p * 100}%`;
  }), []);
  return (
    <nav className="rail" aria-label="Journey progress and points of interest">
      <div className="track" /><div className="fill" ref={fill} /><div className="head" ref={head} aria-hidden="true" />
      {hotspots.map((h) => (
        <button key={h.id} className={`tick${h.isNew ? ' new' : ''}${near === h.id ? ' near' : ''}`} style={{ left: `${h.t * 100}%` }}
          onClick={() => { appStore.setState({ activeHotspot: h.id }); engine?.focusHotspot(h.id); }} aria-label={`Fly to: ${h.title}${h.isNew ? ' (new)' : ''}`} tabIndex={-1}>
          <span className="tip" aria-hidden="true">{h.title}</span>
        </button>
      ))}
    </nav>
  );
}

export function Hud({ engine }: { engine: Engine | null }) {
  const sceneId = useApp((s) => s.sceneId);
  const phase = useApp((s) => s.phase);
  const audioOn = useApp((s) => s.audioOn);
  const gyro = useApp((s) => s.gyro);
  const hint = useApp((s) => s.hint);
  const locked = useApp((s) => s.backwardLocked);
  const titleCard = useApp((s) => s.titleCard);
  const endCard = useApp((s) => s.endCard);
  const collectibles = useApp((s) => s.collectibles);
  const found = useApp((s) => s.found);
  const toast = useApp((s) => s.toast);
  const debug = useApp((s) => s.debug);
  const stats = useApp((s) => s.stats);
  const quality = useApp((s) => s.quality);
  const reduced = useApp((s) => s.reducedMotion);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(matchMedia('(pointer: coarse)').matches), []);
  useEffect(() => { if (!locked) return; const t = setTimeout(() => appStore.setState({ backwardLocked: false }), 1800); return () => clearTimeout(t); }, [locked]);

  const film = sceneId ? filmById(sceneId) : null;
  const n = sceneId ? nextFilm(sceneId) : null;
  const foundN = (found[sceneId ?? ''] ?? []).length;
  const share = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: document.title, url }); else { await navigator.clipboard.writeText(url); appStore.setState({ toast: 'Link copied' }); setTimeout(() => appStore.setState({ toast: null }), 2000); } } catch { /* cancelled */ }
  };

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="brand">
          {phase === 'film' && <button className="btn" onClick={() => engine?.go('hub')} aria-label="Back to the map">{Icon.map}<span>Map</span></button>}
          <div className="title display">
            {film ? <><small>Film {film.number} · {film.year}</small>{film.title.replace('Harry Potter and the ', '')}</> : <><small>A cinematic journey</small>The Wizarding Films</>}
          </div>
        </div>
        <div className="tools">
          {phase === 'intro' && <button className="btn" onClick={() => engine?.rig.skipCinematic()}>Skip intro</button>}
          <button className="btn" aria-pressed={audioOn} onClick={() => appStore.setState({ audioOn: !audioOn })} aria-label={audioOn ? 'Mute ambient sound' : 'Play ambient sound'}>{Icon.sound(audioOn)}<span>{audioOn ? 'Sound on' : 'Sound off'}</span></button>
          {touch && phase === 'film' && <button className="btn" aria-pressed={gyro} onClick={() => appStore.setState({ gyro: !gyro })} aria-label="Look around by tilting your phone">{Icon.gyro}<span>Tilt</span></button>}
          {phase === 'film' && <button className="btn" onClick={share} aria-label="Share a link to this scene">{Icon.share}<span>Share</span></button>}
        </div>
      </div>

      {phase === 'film' && <Rail engine={engine} />}
      {phase === 'film' && hint === 'scroll' && (
        <div className="hint" aria-live="polite">{touch ? 'Swipe up to travel · drag sideways to look' : 'Scroll or use the arrow keys to travel · drag to look around'}
          {locked && <span className="warn">Head forward a little first; you can turn back once you are on your way.</span>}
        </div>
      )}
      {phase === 'hub' && <div className="hint" style={{ animation: 'none' }}>Choose a film on the map</div>}
      {phase === 'film' && collectibles.length > 0 && <div className="counter" aria-live="polite">Hidden objects <strong>{foundN}/{collectibles.length}</strong></div>}

      {titleCard && <div className="titlecard" aria-live="polite"><div className="kicker">{titleCard.kicker}</div><h2>{titleCard.title}</h2><p>{titleCard.sub}</p></div>}

      {endCard && phase === 'film' && (
        <div className="endcard" role="dialog" aria-labelledby="end-title">
          <h2 id="end-title" className="display">You have come full circle</h2>
          <p>{foundN < collectibles.length ? `${collectibles.length - foundN} hidden objects are still out there.` : 'Every hidden object found. Well spotted.'}</p>
          <div className="row">
            {n && <button className="btn" onClick={() => engine?.go(n)}>Continue to {filmById(n)?.title.replace('Harry Potter and the ', '')}</button>}
            <button className="btn" onClick={() => engine?.go('hub')}>Back to the map</button>
            <button className="btn" onClick={() => appStore.setState({ endCard: false })}>Keep exploring</button>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
      {debug && <div className="stats">{`fps ${stats.fps}\ntris ${stats.triangles.toLocaleString()}\ncalls ${stats.calls}\nscene load ${stats.sceneLoadMs} ms\ntier ${quality?.tier} @${quality?.pixelRatio}x${quality?.gpu ? `\ngpu ${quality.gpu.slice(0, 40)}` : ''}${reduced ? '\nreduced motion' : ''}`}</div>}
      <Disclaimer className="footer-note" />
    </div>
  );
}
