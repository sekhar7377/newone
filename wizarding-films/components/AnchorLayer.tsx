'use client';
import { useEffect, useRef } from 'react';
import { useApp, appStore } from '@/lib/store';
import { FILMS } from '@/lib/content';
import type { Engine } from '@/lib/engine/Engine';

/**
 * Real, focusable buttons positioned over the 3D runes each frame by the
 * engine (it writes transforms directly; React never re-renders per frame).
 * Tab moves through hotspots, Enter opens them.
 */
export function AnchorLayer({ engine }: { engine: Engine | null }) {
  const hotspots = useApp((s) => s.hotspots);
  const collectibles = useApp((s) => s.collectibles);
  const found = useApp((s) => s.found);
  const sceneId = useApp((s) => s.sceneId);
  const phase = useApp((s) => s.phase);
  const hs = useRef(new Map<string, HTMLElement>());
  const cs = useRef(new Map<string, HTMLElement>());
  const ws = useRef(new Map<string, HTMLElement>());

  useEffect(() => { engine?.bindElements('hotspots', hs.current); }, [engine, hotspots]);
  useEffect(() => { engine?.bindElements('collectibles', cs.current); }, [engine, collectibles, found]);
  useEffect(() => { engine?.bindElements('waypoints', ws.current); }, [engine, sceneId]);

  const ref = (m: Map<string, HTMLElement>, id: string) => (el: HTMLElement | null) => { if (el) m.set(id, el); else m.delete(id); };
  const foundHere = new Set(found[sceneId ?? ''] ?? []);
  const isHub = sceneId === 'hub';

  return (
    <div className="anchors" aria-label={isHub ? 'Film waypoints' : 'Points of interest'} role="group">
      {isHub && phase === 'hub' && FILMS.map((f) => (
        <button key={f.id} ref={ref(ws.current, f.id)} className="anchor waypoint" data-shown="false"
          onMouseEnter={() => { appStore.setState({ hubHover: f.id }); engine?.prefetch(f.id); }}
          onFocus={() => { appStore.setState({ hubHover: f.id }); engine?.prefetch(f.id); }}
          onMouseLeave={() => appStore.setState({ hubHover: null })}
          onClick={() => engine?.go(f.id)}>
          <span className="label"><small>Film {f.number} · {f.year}</small>{f.title.replace('Harry Potter and the ', '')}</span>
          <span className="sr-only">Enter film {f.number}: {f.title}, {f.year}</span>
        </button>
      ))}
      {!isHub && hotspots.map((h) => (
        <button key={h.id} ref={ref(hs.current, h.id)} className="anchor" data-shown="false"
          onMouseEnter={() => engine?.setHovered('hotspots', h.id)} onMouseLeave={() => engine?.setHovered('hotspots', null)}
          onClick={() => appStore.setState({ activeHotspot: h.id })} aria-haspopup="dialog">
          <span className="label">{h.title}</span>
          {h.isNew && <span className="new" aria-hidden="true">New</span>}
          <span className="sr-only">{h.isNew ? 'New: ' : ''}{h.title}</span>
        </button>
      ))}
      {!isHub && collectibles.filter((c) => !foundHere.has(c.id)).map((c) => (
        <button key={c.id} ref={ref(cs.current, c.id)} className="anchor collectible" data-shown="false"
          onClick={() => { engine?.collect(c.id); appStore.setState({ toast: `Found: ${c.name}. ${c.note}` }); setTimeout(() => appStore.setState({ toast: null }), 3800); }}>
          <span className="sr-only">Hidden object</span>
        </button>
      ))}
    </div>
  );
}
