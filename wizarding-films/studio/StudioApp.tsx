'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mesh, MeshBasicMaterial, Raycaster, SphereGeometry, Vector2, Vector3, type Object3D, type ShaderMaterial } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Engine } from '@/lib/engine/Engine';
import { qualityFor } from '@/lib/quality';
import { FILMS, isPublished, loadSceneContent, type HotspotData, type HotspotKind, type IllustrationData, type SceneContent, type SceneId, type Stroke } from '@/lib/content';
import { LineIllustration } from '@/lib/engine/lineIllustration';
import { appStore } from '@/lib/store';
import './studio.css';

/**
 * /studio — authoring tools that run on the real engine and renderer.
 *  1. Hotspot placer: fly the scene (path or orbit), click geometry to raycast
 *     and snap a hotspot, fine-tune with a gizmo, store the current camera view.
 *  2. Illustration tool: draw in 3D beside a hotspot with pressure-sensitive
 *     pointer events (Apple Pencil / stylus); preview uses the live line renderer.
 *  3. Content scheduler: publish dates for every hotspot and illustration, plus
 *     an "as of" preview of future content drops.
 * Saves go to /content through a dev-only API route, or download as JSON.
 */
type Tab = 'hotspots' | 'draw' | 'schedule';
const KINDS: HotspotKind[] = ['meta', 'fact', 'bts', 'moment'];
const today = () => new Date().toISOString().slice(0, 10);

export default function StudioApp() {
  const view = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null);
  const orbit = useRef<OrbitControls | null>(null);
  const gizmo = useRef<TransformControls | null>(null);
  const marker = useRef<Mesh | null>(null);
  const drawing = useRef<{ ill: LineIllustration | null; strokes: Stroke[]; active: Stroke | null; origin: Vector3; right: Vector3 }>({ ill: null, strokes: [], active: null, origin: new Vector3(), right: new Vector3(1, 0, 0) });

  const [scene, setScene] = useState<SceneId>('film-1');
  const [content, setContent] = useState<SceneContent | null>(null);
  const [ills, setIlls] = useState<IllustrationData[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('hotspots');
  const [mode, setMode] = useState<'path' | 'orbit'>('path');
  const [placing, setPlacing] = useState(false);
  const [drawOn, setDrawOn] = useState(false);
  const [asOf, setAsOf] = useState(today());
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // ---------------------------------------------------------------- engine
  useEffect(() => {
    if (!canvas.current || !view.current) return;
    appStore.setState({ reducedMotion: false });
    const e = new Engine(canvas.current, view.current, qualityFor('high', false, devicePixelRatio), { studio: true });
    eng.current = e; e.start();
    const oc = new OrbitControls(e.camera, canvas.current); oc.enabled = false; oc.enableDamping = true; orbit.current = oc;
    const tc = new TransformControls(e.camera, canvas.current); gizmo.current = tc;
    tc.addEventListener('dragging-changed', (ev) => { oc.enabled = !(ev as unknown as { value: boolean }).value && e.rig.mode === 'off'; });
    marker.current = new Mesh(new SphereGeometry(0.6, 12, 8), new MeshBasicMaterial({ color: 0xffd27a, wireframe: true }));
    e.onFrame = () => { if (oc.enabled) oc.update(); };
    return () => { tc.dispose(); oc.dispose(); e.dispose(); };
  }, []);

  const load = useCallback(async (id: SceneId, at = asOf) => {
    const e = eng.current; if (!e) return;
    e.asOf = Date.parse(at + 'T23:59:59');
    const { content: c, illustrations } = await loadSceneContent(id);
    setContent(structuredClone(c)); setIlls(structuredClone(illustrations)); setSel(null);
    await e.go(id, { instant: true });
    e.rig.unlock();
    const cur = e.current!;
    const tc = gizmo.current!; cur.scene.add(tc.getHelper()); cur.scene.add(marker.current!);
    marker.current!.visible = false; tc.detach();
  }, [asOf]);
  useEffect(() => { load(scene); }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // the pen and orbiting share the pointer: pen wins
  useEffect(() => { if (orbit.current) orbit.current.enabled = mode === 'orbit' && !drawOn; }, [drawOn, mode]);

  // orbit vs path flight
  useEffect(() => {
    const e = eng.current, oc = orbit.current; if (!e || !oc) return;
    if (mode === 'orbit') { e.rig.mode = 'off'; oc.target.copy(e.camera.position).add(e.camera.getWorldDirection(new Vector3()).multiplyScalar(40)); oc.enabled = true; }
    else { oc.enabled = false; if (e.current?.curve) e.rig.mode = 'path'; }
  }, [mode]);

  const hotspot = content?.hotspots.find((h) => h.id === sel) ?? null;
  const update = (patch: Partial<HotspotData>) => {
    if (!content || !sel) return;
    setContent({ ...content, hotspots: content.hotspots.map((h) => (h.id === sel ? { ...h, ...patch } : h)) });
  };

  // selection → gizmo
  useEffect(() => {
    const e = eng.current, tc = gizmo.current, m = marker.current; if (!e?.current || !tc || !m) return;
    const live = e.current.hotspots.find((h) => h.id === sel);
    if (!sel || !hotspot) { tc.detach(); m.visible = false; return; }
    const pos = hotspot.position ? new Vector3(...hotspot.position) : live?.pos.clone() ?? new Vector3();
    m.position.copy(pos); m.visible = true; tc.attach(m);
    const onChange = () => {
      const p = m.position; e.current?.hotspotSet?.setPosition(sel, p);
      update({ position: [round(p.x), round(p.y), round(p.z)], at: undefined, offset: undefined });
    };
    tc.addEventListener('objectChange', onChange);
    return () => tc.removeEventListener('objectChange', onChange);
  }, [sel, hotspot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- pointer: place / draw
  useEffect(() => {
    const el = canvas.current, e = eng.current; if (!el || !e) return;
    const ray = new Raycaster(), ndc = new Vector2();
    const toNdc = (ev: PointerEvent) => { const r = el.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, e.camera); };
    const planePoint = (ev: PointerEvent) => {
      toNdc(ev); const d = drawing.current;
      const n = e.camera.getWorldDirection(new Vector3()); n.y = 0; n.normalize();
      const t = d.origin.clone().sub(ray.ray.origin).dot(n) / ray.ray.direction.dot(n);
      const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t).sub(d.origin);
      return [Math.round(p.dot(d.right) * 100), Math.round(p.y * 100), 0];
    };
    const down = (ev: PointerEvent) => {
      if (placing && sel && e.current) {
        toNdc(ev);
        const targets: Object3D[] = []; e.current.builder.root.traverse((o) => { if ((o as Mesh).isMesh && o.visible) targets.push(o); });
        const hit = ray.intersectObjects(targets, false).find((h) => h.distance > 1);
        if (hit) { const p = hit.point.add(new Vector3(0, 2, 0)); marker.current!.position.copy(p); e.current.hotspotSet?.setPosition(sel, p); update({ position: [round(p.x), round(p.y), round(p.z)], at: undefined, offset: undefined }); setPlacing(false); flash('Hotspot snapped to geometry (+2 m). Fine-tune with the gizmo.'); }
        return;
      }
      if (drawOn) {
        el.setPointerCapture(ev.pointerId);
        const pr = ev.pointerType === 'mouse' ? 0.5 : ev.pressure || 0.5;
        const [x, y, z] = planePoint(ev);
        drawing.current.active = { p: [x, y, z], w: [Math.round(40 + pr * 215)] };
        drawing.current.strokes.push(drawing.current.active);
      }
    };
    const move = (ev: PointerEvent) => {
      const a = drawing.current.active; if (!drawOn || !a) return;
      const evs = ev.getCoalescedEvents?.() ?? [ev];
      for (const c of evs) {
        const [x, y, z] = planePoint(c);
        const n = a.p.length; if (Math.hypot(x - a.p[n - 3], y - a.p[n - 2]) < 4) continue;
        a.p.push(x, y, z); a.w.push(Math.round(40 + (c.pointerType === 'mouse' ? 0.5 : c.pressure || 0.5) * 215));
      }
      rebuildPreview();
    };
    const up = () => { if (drawing.current.active) { drawing.current.active = null; rebuildPreview(); } };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [placing, drawOn, sel, content]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- illustration tool
  const anchorFor = (id: string) => eng.current?.current?.hotspots.find((h) => h.id === id)?.pos.clone() ?? marker.current!.position.clone();
  const startDrawing = () => {
    const e = eng.current; if (!e?.current || !sel) { flash('Select a hotspot first.'); return; }
    const existing = ills.find((i) => i.hotspot === sel);
    const d = drawing.current;
    d.strokes = existing ? structuredClone(existing.strokes) : [];
    d.origin = anchorFor(sel).add(new Vector3(...(existing?.offset ?? [0, 2.6, 0])));
    const f = e.camera.getWorldDirection(new Vector3()); f.y = 0; f.normalize();
    d.right = new Vector3(-f.z, 0, f.x); // horizontal right of the current view
    setMode('orbit'); setDrawOn(true);
    // frame the drawing plane: camera 14 m in front of it, looking straight at it
    const back = new Vector3(-d.right.z, 0, d.right.x);
    // after the mode effect has run (it re-targets the orbit controls)
    requestAnimationFrame(() => {
      e.rig.mode = 'off';
      e.camera.position.copy(d.origin).addScaledVector(back, 14).add(new Vector3(0, 2.5, 0));
      if (orbit.current) { orbit.current.target.copy(d.origin).add(new Vector3(0, 2.5, 0)); orbit.current.update(); }
      rebuildPreview();
    });
    flash('Drawing on a plane facing you. Pen pressure sets the line width.');
  };
  const rebuildPreview = () => {
    const e = eng.current, d = drawing.current; if (!e?.current) return;
    if (d.ill) { d.ill.group.removeFromParent(); d.ill.dispose(); d.ill = null; }
    if (!d.strokes.length || !sel) return;
    const data: IllustrationData = { id: 'preview', hotspot: sel, alt: '', publishAt: today(), offset: [0, 0, 0], scale: 1, strokes: d.strokes.filter((s) => s.p.length >= 6) };
    if (!data.strokes.length) return;
    const il = new LineIllustration(data, e.current.builder.kit.line({ wobble: 0.01 }) as ShaderMaterial, d.origin);
    // Studio draws in the camera-facing plane, so lock its rotation to that plane.
    il.update = function () { (this.mesh.material as ShaderMaterial).uniforms.uProgress.value = 1; this.group.visible = true; };
    // local +x = the drawing plane's right, local +z = toward the viewer (same convention as the live yaw-billboard)
    il.group.lookAt(il.group.position.clone().add(new Vector3(-d.right.z, 0, d.right.x)));
    e.current.scene.add(il.group); e.current.illustrations.push(il); d.ill = il;
  };
  const commitDrawing = () => {
    if (!sel) return;
    const d = drawing.current; const strokes = d.strokes.filter((s) => s.p.length >= 6);
    const anchor = anchorFor(sel); const off = d.origin.clone().sub(anchor);
    const existing = ills.find((i) => i.hotspot === sel);
    const data: IllustrationData = { id: existing?.id ?? `${sel}-ill`, hotspot: sel, alt: existing?.alt ?? 'A hand-drawn line illustration.', publishAt: existing?.publishAt ?? today(), offset: [round(off.x), round(off.y), round(off.z)], scale: 1, strokes };
    setIlls([...ills.filter((i) => i.hotspot !== sel), data]); setDrawOn(false);
    flash(`Illustration kept: ${strokes.length} strokes, ${JSON.stringify(strokes).length} bytes. Save illustrations to persist.`);
  };

  // ---------------------------------------------------------------- persistence
  const save = async (kind: 'scene' | 'illustrations') => {
    const data = kind === 'scene' ? content : ills;
    try {
      const r = await fetch('/api/studio/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scene, kind, data }) });
      const j = await r.json();
      if (r.ok) flash(`Saved ${j.file}`); else { flash(j.error); download(kind); }
    } catch { download(kind); }
  };
  const download = (kind: 'scene' | 'illustrations') => {
    const blob = new Blob([JSON.stringify(kind === 'scene' ? content : ills, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${scene}${kind === 'scene' ? '' : '.illustrations'}.json`; a.click();
  };

  const addHotspot = () => {
    if (!content || !eng.current) return;
    const id = `${scene.replace('film-', 'f')}-${Date.now().toString(36)}`;
    const p = eng.current.camera.position.clone().add(eng.current.camera.getWorldDirection(new Vector3()).multiplyScalar(20));
    const h: HotspotData = { id, kind: 'fact', title: 'New hotspot', body: 'Write original copy here.', position: [round(p.x), round(p.y), round(p.z)], publishAt: today() };
    setContent({ ...content, hotspots: [...content.hotspots, h] }); setSel(id);
    flash('Added. Click "Place by click" to snap it to geometry. Save, then reload the scene to see its rune.');
  };
  const setView = () => {
    const e = eng.current; if (!e || !hotspot) return;
    const t = ((e.rig.progress % 1) + 1) % 1; const o = e.rig.lookOffsets();
    update({ view: { t: round(t, 4), yaw: round(o.yaw, 3), pitch: round(o.pitch, 3) } });
    flash(`Camera view stored at t=${t.toFixed(3)}`);
  };

  return (
    <div className="studio">
      <aside>
        <h1>Studio</h1>
        <p className="help">Authoring tools on the live renderer. Saves write to <code>/content</code> under <code>npm run dev</code>; otherwise you get a JSON download.</p>
        <label htmlFor="scene">Scene</label>
        <select id="scene" value={scene} onChange={(e) => setScene(e.target.value as SceneId)}>{FILMS.map((f) => <option key={f.id} value={f.id}>{f.number}. {f.title.replace('Harry Potter and the ', '')}</option>)}</select>
        <div className="row">
          <button aria-pressed={mode === 'path'} onClick={() => { setMode('path'); setDrawOn(false); }}>Fly the path</button>
          <button aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>Orbit freely</button>
        </div>
        <div className="tabs" role="tablist">
          {(['hotspots', 'draw', 'schedule'] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'hotspots' ? 'Hotspots' : t === 'draw' ? 'Illustrate' : 'Schedule'}</button>)}
        </div>

        {tab !== 'schedule' && content && (
          <>
            <h2>Hotspots ({content.hotspots.length})</h2>
            <ul className="list">{content.hotspots.map((h) => <li key={h.id}><button className={h.id === sel ? 'sel' : ''} onClick={() => { setSel(h.id); eng.current?.focusHotspot(h.id); }}>{h.title}{!isPublished(h) && <span className="badge future">{h.publishAt}</span>}{ills.some((i) => i.hotspot === h.id) && <span className="badge">✎</span>}</button></li>)}</ul>
            {tab === 'hotspots' && <div className="row"><button onClick={addHotspot}>+ New hotspot</button><button onClick={() => save('scene')}>Save scene</button></div>}
          </>
        )}

        {tab === 'hotspots' && hotspot && (
          <>
            <h2>Edit</h2>
            <label>Title</label><input value={hotspot.title} onChange={(e) => update({ title: e.target.value })} />
            <label>Kind</label><select value={hotspot.kind} onChange={(e) => update({ kind: e.target.value as HotspotKind })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <label>Body (original copy only)</label><textarea value={hotspot.body} onChange={(e) => update({ body: e.target.value })} />
            <label>Publish date</label><input type="date" value={hotspot.publishAt.slice(0, 10)} onChange={(e) => update({ publishAt: e.target.value })} />
            <label>Position</label>
            <div className="row">{[0, 1, 2].map((k) => <input key={k} type="number" step="0.5" value={hotspot.position?.[k] ?? ''} placeholder={`at ${hotspot.at ?? ''}`} onChange={(e) => { const p = [...(hotspot.position ?? [0, 0, 0])] as [number, number, number]; p[k] = +e.target.value; update({ position: p }); marker.current?.position.set(...p); }} />)}</div>
            <div className="row">
              <button aria-pressed={placing} onClick={() => { setPlacing(!placing); setDrawOn(false); }}>{placing ? 'Click the scene…' : 'Place by click'}</button>
            </div>
            <div className="row"><button onClick={setView}>Use current camera view</button><button onClick={() => update({ view: undefined })}>Clear view</button></div>
            <p className="help">{hotspot.view ? `View: t=${hotspot.view.t}, yaw ${hotspot.view.yaw}, pitch ${hotspot.view.pitch}` : 'No stored view: the path parameter nearest the hotspot is used.'}</p>
            <div className="row"><button onClick={() => { setContent({ ...content!, hotspots: content!.hotspots.filter((h) => h.id !== sel) }); setSel(null); }}>Delete hotspot</button></div>
          </>
        )}

        {tab === 'draw' && (
          <>
            <h2>Illustration</h2>
            <p className="help">Pick a hotspot, then draw beside it. Uses the same ribbon renderer as the live site, so what you draw is what visitors see. Pencil/stylus pressure sets the width.</p>
            <div className="row">
              <button onClick={startDrawing} disabled={!sel}>{ills.some((i) => i.hotspot === sel) ? 'Edit drawing' : 'Start drawing'}</button>
              <button aria-pressed={drawOn} onClick={() => setDrawOn(!drawOn)} disabled={!sel}>{drawOn ? 'Pen on' : 'Pen off'}</button>
            </div>
            <div className="row">
              <button onClick={() => { drawing.current.strokes.pop(); rebuildPreview(); }}>Undo stroke</button>
              <button onClick={() => { drawing.current.strokes = []; rebuildPreview(); }}>Clear</button>
              <button onClick={commitDrawing} disabled={!sel}>Keep</button>
            </div>
            {sel && ills.find((i) => i.hotspot === sel) && (
              <><label>Alt text</label><input value={ills.find((i) => i.hotspot === sel)!.alt} onChange={(e) => setIlls(ills.map((i) => (i.hotspot === sel ? { ...i, alt: e.target.value } : i)))} /></>
            )}
            <div className="row"><button onClick={() => save('illustrations')}>Save illustrations</button><button onClick={() => download('illustrations')}>Download JSON</button></div>
          </>
        )}

        {tab === 'schedule' && content && (
          <>
            <h2>Content scheduler</h2>
            <p className="help">Content with a future date stays hidden until that day: release new notes in waves (anniversaries, 1 September).</p>
            <label>Preview the site as of</label>
            <div className="row"><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /><button onClick={() => load(scene, asOf)}>Reload scene</button></div>
            <table><tbody>
              {content.hotspots.map((h) => (
                <tr key={h.id}><td>{h.title}</td><td style={{ width: 130 }}><input type="date" value={h.publishAt.slice(0, 10)} onChange={(e) => setContent({ ...content, hotspots: content.hotspots.map((x) => (x.id === h.id ? { ...x, publishAt: e.target.value } : x)) })} /></td></tr>
              ))}
              {ills.map((i) => (
                <tr key={i.id}><td>✎ {i.id}</td><td><input type="date" value={i.publishAt.slice(0, 10)} onChange={(e) => setIlls(ills.map((x) => (x.id === i.id ? { ...x, publishAt: e.target.value } : x)))} /></td></tr>
              ))}
            </tbody></table>
            <div className="row"><button onClick={() => save('scene')}>Save hotspots</button><button onClick={() => save('illustrations')}>Save illustrations</button></div>
          </>
        )}
        <div className="msg" role="status">{msg}</div>
      </aside>
      <div className="view" ref={view}>
        <canvas ref={canvas} />
        <div className="hud-note">{drawOn ? 'Pen on: draw in the view' : placing ? 'Click any geometry to place the hotspot' : mode === 'path' ? 'Scroll to fly the path' : 'Drag to orbit, right-drag to pan'}</div>
      </div>
    </div>
  );
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
