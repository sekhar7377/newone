'use client';
import { useEffect, useRef } from 'react';
import { useApp, appStore } from '@/lib/store';
import { KIND_LABEL, filmById } from '@/lib/content';

/** Parchment panel. Focus moves in on open and back to the rune on close; Esc closes. */
export function HotspotPanel() {
  const id = useApp((s) => s.activeHotspot);
  const hotspots = useApp((s) => s.hotspots);
  const sceneId = useApp((s) => s.sceneId);
  const h = hotspots.find((x) => x.id === id) ?? null;
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!h) return;
    opener.current = document.activeElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    appStore.setState({ activeHotspot: null });
    const o = opener.current as HTMLElement | null;
    if (o && document.contains(o)) o.focus();
  };
  const sorted = [...hotspots].sort((a, b) => a.t - b.t);
  const idx = h ? sorted.findIndex((x) => x.id === h.id) : -1;
  const go = (d: number) => { const n = sorted[(idx + d + sorted.length) % sorted.length]; if (n) appStore.setState({ activeHotspot: n.id }); };
  const share = async () => {
    const url = `${location.origin}/?scene=${sceneId}&spot=${h?.id}`;
    try {
      if (navigator.share) await navigator.share({ title: h?.title, url });
      else { await navigator.clipboard.writeText(url); appStore.setState({ toast: 'Link copied' }); setTimeout(() => appStore.setState({ toast: null }), 2000); }
    } catch { /* cancelled */ }
  };
  const film = sceneId ? filmById(sceneId) : null;

  return (
    <>
      {/* Screen readers hear the panel content as it changes. */}
      <div className="sr-only" aria-live="polite">{h ? `${KIND_LABEL[h.kind]}: ${h.title}. ${h.body}` : ''}</div>
      {h && (
        <div className="panel" role="dialog" aria-modal="false" aria-labelledby="panel-title" tabIndex={-1} ref={ref}>
          <button className="close" onClick={close} aria-label="Close">×</button>
          <div className="kind">{KIND_LABEL[h.kind]}{h.isNew ? ' · New' : ''}</div>
          <h2 id="panel-title">{h.title}</h2>
          <p>{h.body}</p>
          {h.illustrationAlt && <p className="meta">Illustration: {h.illustrationAlt}</p>}
          {film && <div className="meta">{film.title} · {film.year} · Directed by {film.director}</div>}
          <div className="row">
            <button className="pbtn" onClick={() => go(-1)}>← Previous</button>
            <button className="pbtn" onClick={() => go(1)}>Next →</button>
            <button className="pbtn" onClick={share}>Share this</button>
          </div>
        </div>
      )}
    </>
  );
}
