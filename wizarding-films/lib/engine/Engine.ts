import { CatmullRomCurve3, Timer, ColorManagement, LinearSRGBColorSpace, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type ShaderMaterial } from 'three';
import { CameraRig } from './CameraRig';
import { SceneBuilder } from './builder';
import { createGlobals, MaterialKit } from './materials';
import { AnchorSet, nearestT, resolvePosition } from './hotspots';
import { LineIllustration } from './lineIllustration';
import { Post } from './post';
import { AmbientAudio } from '@/lib/audio';
import { appStore, frame, type HotspotMeta } from '@/lib/store';
import { filmById, isNewSince, isPublished, loadSceneContent, type HotspotData, type SceneContent, type SceneId } from '@/lib/content';
import { previousVisit, loadFound, saveFound, loadSeenScenes, saveSeenScenes } from '@/lib/storage';
import { PALETTES } from '@/scenes/palettes';
import { SCENES, nextFilm } from '@/scenes';
import type { SceneHooks } from '@/scenes/types';
import type { Quality } from '@/lib/quality';

ColorManagement.enabled = false; // palette hex values are display values

export interface LoadedScene {
  id: SceneId; scene: Scene; builder: SceneBuilder; hooks: SceneHooks; content: SceneContent;
  globals: ReturnType<typeof createGlobals>;
  curve: CatmullRomCurve3 | null;
  hotspots: (HotspotData & { pos: Vector3; t: number; isNew: boolean })[];
  hotspotSet: AnchorSet | null; collectSet: AnchorSet | null; waypointSet: AnchorSet | null;
  illustrations: LineIllustration[];
  loadMs: number; bytes: number;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fract = (v: number) => v - Math.floor(v);

export class Engine {
  renderer: WebGLRenderer;
  camera = new PerspectiveCamera(55, 1, 0.5, 9000);
  rig: CameraRig;
  audio = new AmbientAudio();
  current: LoadedScene | null = null;
  private cache = new Map<SceneId, Promise<LoadedScene>>();
  private keep = new Set<SceneId>();
  private post: Post | null = null;
  private clock = new Timer();
  private raf = 0; private running = false; private time = 0;
  private w = 1; private h = 1;
  private fpsAcc = 0; private fpsFrames = 0; private statT = 0;
  private els = { hotspots: new Map<string, HTMLElement>(), collectibles: new Map<string, HTMLElement>(), waypoints: new Map<string, HTMLElement>() };
  private lastNear: string | null = null;
  private loopShown = false;
  private busy = false;
  private unsub: (() => void)[] = [];
  asOf = Date.now();
  onFrame?: (dt: number) => void;
  studio: boolean;

  constructor(public canvas: HTMLCanvasElement, private container: HTMLElement, public quality: Quality, opts: { studio?: boolean } = {}) {
    this.studio = !!opts.studio;
    this.renderer = new WebGLRenderer({ canvas, antialias: quality.antialias && !quality.post, powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: this.studio });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.setClearColor(0x05070f, 1);
    this.renderer.info.autoReset = false; // reset once per frame so the post pass doesn't hide scene stats
    if (quality.post) this.post = new Post(1, 1);
    this.rig = new CameraRig(this.camera, container);
    this.rig.reducedMotion = appStore.getState().reducedMotion;
    this.rig.onBlockedBackward = () => appStore.setState({ backwardLocked: true });
    this.rig.onFirstMove = () => appStore.setState({ hint: null, backwardLocked: false });
    this.rig.onStep = () => this.crossfade();
    this.rig.onInteract = () => { if (appStore.getState().phase === 'intro') this.rig.skipCinematic(); };

    const ro = new ResizeObserver(() => this.resize()); ro.observe(container); this.unsub.push(() => ro.disconnect());
    this.resize();

    const onVis = () => { if (document.hidden) { this.stop(); this.audio.pause(); } else { this.start(); this.audio.resume(); } };
    document.addEventListener('visibilitychange', onVis); this.unsub.push(() => document.removeEventListener('visibilitychange', onVis));
    const lost = (e: Event) => { e.preventDefault(); this.stop(); appStore.setState({ contextLost: true }); };
    const restored = () => { appStore.setState({ contextLost: false }); this.start(); };
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    this.unsub.push(() => { canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); });

    // Store → engine reactions
    this.unsub.push(appStore.subscribe((s, prev) => {
      if (s.activeHotspot !== prev.activeHotspot && s.activeHotspot) this.focusHotspot(s.activeHotspot);
      if (s.audioOn !== prev.audioOn) { if (s.audioOn) this.audio.enable(this.ambience()); else this.audio.disable(); }
      if (s.reducedMotion !== prev.reducedMotion) this.rig.reducedMotion = s.reducedMotion;
      if (s.gyro !== prev.gyro) { if (s.gyro) this.rig.enableGyro().then((ok) => { if (!ok) appStore.setState({ gyro: false }); }); else this.rig.disableGyro(); }
    }));
  }

  private ambience() { return PALETTES[this.current?.id ?? 'hub'].ambience; }

  bindElements(kind: 'hotspots' | 'collectibles' | 'waypoints', map: Map<string, HTMLElement>) {
    this.els[kind] = map;
    const c = this.current; if (!c) return;
    if (kind === 'hotspots') c.hotspotSet?.bind(map);
    if (kind === 'collectibles') c.collectSet?.bind(map);
    if (kind === 'waypoints') c.waypointSet?.bind(map);
  }
  setHovered(kind: 'hotspots' | 'waypoints', id: string | null) {
    const set = kind === 'hotspots' ? this.current?.hotspotSet : this.current?.waypointSet;
    if (set) set.hovered = id;
  }

  // ------------------------------------------------------------ loading / streaming
  load(id: SceneId): Promise<LoadedScene> {
    let p = this.cache.get(id);
    if (!p) { p = this.build(id); this.cache.set(id, p); p.catch(() => this.cache.delete(id)); }
    return p;
  }

  /** Warm the next scene (e.g. while its waypoint is hovered). Keeps current + this one only. */
  prefetch(id: SceneId) {
    if (!this.current || id === this.current.id) return;
    this.keep = new Set([this.current.id, id]);
    this.enforceMemory();
    this.load(id).catch(() => {});
  }

  private enforceMemory() {
    for (const [id, p] of this.cache) {
      if (this.keep.has(id) || id === this.current?.id) continue;
      this.cache.delete(id);
      p.then((s) => this.disposeScene(s)).catch(() => {});
    }
  }

  private async build(id: SceneId): Promise<LoadedScene> {
    const t0 = performance.now();
    const palette = PALETTES[id];
    const globals = createGlobals(palette);
    const kit = new MaterialKit(globals, palette, this.quality);
    const ctrl = new AbortController();
    const report = (p: number) => { if (appStore.getState().loading.active && this.loadingId === id) appStore.setState({ loading: { active: true, progress: p, label: appStore.getState().loading.label } }); };
    const b = new SceneBuilder(kit, this.quality, ctrl.signal, report);
    const [{ default: mod }, { content, illustrations }] = await Promise.all([SCENES[id](), loadSceneContent(id)]);
    const hooks = await mod.build(b, content);
    const scene = new Scene(); scene.add(b.root);

    const curve = content.path.points.length >= 4 ? new CatmullRomCurve3(content.path.points.map((p) => new Vector3(...p)), true, 'centripetal', 0.5) : null;
    if (curve) curve.arcLengthDivisions = 600;
    const lastVisit = previousVisit();
    const hotspots = content.hotspots.filter((h) => isPublished(h, this.asOf)).map((h) => {
      const pos = resolvePosition(h, curve);
      return { ...h, pos, t: h.view?.t ?? (h.at !== undefined && !h.position ? fract(h.at) : nearestT(curve, pos)), isNew: isNewSince(h, lastVisit) };
    });
    let hotspotSet: AnchorSet | null = null, collectSet: AnchorSet | null = null, waypointSet: AnchorSet | null = null;
    if (hotspots.length) {
      hotspotSet = new AnchorSet(hotspots.map((h) => ({ id: h.id, position: h.pos, t: h.t, isNew: h.isNew })), kit.rune({ size: 1.6 }), { maxDist: 240, nearDist: 70 });
      scene.add(hotspotSet.mesh);
    }
    const found = loadFound()[id] ?? [];
    if (content.collectibles.length) {
      collectSet = new AnchorSet(content.collectibles.map((c) => ({ id: c.id, position: resolvePosition(c, curve), t: 0 })), kit.rune({ size: 0.9, shape: 1, color: '#ffffff' }), { maxDist: 70, nearDist: 30 });
      found.forEach((f) => collectSet!.remove(f));
      scene.add(collectSet.mesh);
    }
    if (hooks.waypoints) {
      waypointSet = new AnchorSet(hooks.waypoints.map((w) => ({ id: w.id, position: w.position, t: 0 })), kit.rune({ size: 2.6, color: palette.ui.accent }), { maxDist: 5000, nearDist: 0 });
      scene.add(waypointSet.mesh);
    }
    const ills: LineIllustration[] = [];
    for (const d of illustrations) {
      if (!isPublished(d, this.asOf)) continue;
      const h = hotspots.find((x) => x.id === d.hotspot); if (!h) continue;
      const il = new LineIllustration(d, kit.line({ color: d.color ?? palette.ui.accent, wobble: appStore.getState().reducedMotion ? 0 : 0.012 }) as ShaderMaterial, h.pos);
      scene.add(il.group); ills.push(il);
    }
    // Compile shaders now rather than on first view, so the swap doesn't hitch.
    try { await this.renderer.compileAsync(scene, this.camera); } catch { /* fall back to lazy compile */ }
    const bytes = 0;
    return { id, scene, builder: b, hooks, content, globals, curve, hotspots, hotspotSet, collectSet, waypointSet, illustrations: ills, loadMs: performance.now() - t0, bytes };
  }
  private loadingId: SceneId | null = null;

  private disposeScene(s: LoadedScene) {
    s.builder.dispose();
    s.hotspotSet?.dispose(); s.collectSet?.dispose(); s.waypointSet?.dispose();
    s.illustrations.forEach((i) => i.dispose());
    s.scene.clear();
  }

  // ------------------------------------------------------------ navigation
  async go(id: SceneId, o: { hotspot?: string; intro?: boolean; instant?: boolean } = {}) {
    if (this.busy) return; this.busy = true;
    try {
      const palette = PALETTES[id];
      const first = !this.current;
      appStore.setState({ faded: true, fadeColor: palette.fogLow, activeHotspot: null, endCard: false, titleCard: null });
      if (!first && !o.instant) await wait(appStore.getState().reducedMotion ? 250 : 650);
      this.loadingId = id;
      const pending = this.load(id);
      const slow = setTimeout(() => appStore.setState({ loading: { active: true, progress: 0, label: id === 'hub' ? 'The grounds' : filmById(id)?.title ?? '' } }), 120);
      const s = await pending;
      clearTimeout(slow);
      this.loadingId = null;
      this.activate(s, o);
      appStore.setState({ loading: { active: false, progress: 1, label: '' } });
      this.render(0);
      await wait(60);
      appStore.setState({ faded: false });
      const film = filmById(id);
      if (film && !o.hotspot) {
        appStore.setState({ titleCard: { kicker: `Film ${film.number} · ${film.year}`, title: film.title, sub: film.setting } });
        setTimeout(() => { if (appStore.getState().sceneId === id) appStore.setState({ titleCard: null }); }, 4200);
      }
      if (o.intro && s.hooks.intro && !appStore.getState().reducedMotion) {
        appStore.setState({ phase: 'intro' });
        const c = s.hooks.intro;
        await this.rig.cinematic(new CatmullRomCurve3(c.points.map((p) => new Vector3(...p))), new CatmullRomCurve3(c.look.map((p) => new Vector3(...p))), c.duration);
        this.rig.mode = 'hub';
        appStore.setState({ phase: 'hub' });
      }
    } finally { this.busy = false; }
  }

  private activate(s: LoadedScene, o: { hotspot?: string }) {
    const prev = this.current;
    this.current = s;
    const isHub = s.id === 'hub';
    if (s.curve) {
      this.rig.setPath(s.content.path.points.map((p) => new Vector3(...p)), s.content.path.look.map((p) => new Vector3(...p)), s.content.startT ?? 0);
      this.rig.stations = s.hotspots.map((h) => h.t);
      const seen = loadSeenScenes();
      if (seen.includes(s.id)) this.rig.unlock();
      else saveSeenScenes([...seen, s.id]);
    }
    if (isHub) { this.rig.mode = 'hub'; }
    s.hotspotSet?.bind(this.els.hotspots); s.collectSet?.bind(this.els.collectibles); s.waypointSet?.bind(this.els.waypoints);
    this.loopShown = false; this.lastNear = null;
    const meta: HotspotMeta[] = s.hotspots.map((h) => ({ id: h.id, title: h.title, kind: h.kind, body: h.body, t: h.t, isNew: h.isNew, illustrationAlt: s.illustrations.find((i) => i.data.hotspot === h.id)?.data.alt }));
    appStore.setState({
      sceneId: s.id, phase: isHub ? 'hub' : 'film', hotspots: meta,
      collectibles: s.content.collectibles.map((c) => ({ id: c.id, name: c.name, note: c.note })),
      found: loadFound(), hint: isHub ? null : this.rig.unlocked ? null : 'scroll', backwardLocked: false, nearHotspot: null,
      stats: { ...appStore.getState().stats, sceneLoadMs: Math.round(s.loadMs) },
    });
    if (o.hotspot) { const h = s.hotspots.find((x) => x.id === o.hotspot); if (h) { this.rig.unlock(); this.rig.jumpTo(h.t); appStore.setState({ activeHotspot: h.id }); } }
    if (this.audio.enabled) this.audio.set(PALETTES[s.id].ambience);
    s.hooks.events?.onThunder?.((k) => { if (this.current === s) this.audio.thunder(k); });
    // memory: keep this scene and the natural next one
    const nxt = isHub ? (appStore.getState().hubHover ?? 'film-1') : nextFilm(s.id) ?? 'hub';
    this.keep = new Set([s.id, nxt]);
    if (prev && prev.id !== s.id) this.keep.delete(prev.id);
    this.enforceMemory();
    if (!this.studio) setTimeout(() => this.load(nxt).catch(() => {}), 2500);
    this.updateUrl(o.hotspot);
  }

  private updateUrl(hotspot?: string) {
    if (this.studio) return;
    try {
      const u = new URL(location.href);
      if (this.current?.id && this.current.id !== 'hub') u.searchParams.set('scene', this.current.id); else u.searchParams.delete('scene');
      if (hotspot) u.searchParams.set('spot', hotspot); else u.searchParams.delete('spot');
      history.replaceState(null, '', u);
    } catch { /* ignore */ }
  }

  focusHotspot(id: string) {
    const h = this.current?.hotspots.find((x) => x.id === id); if (!h) return;
    this.rig.flyTo(h.t, h.view);
    this.updateUrl(id);
  }

  collect(id: string) {
    const s = this.current; if (!s) return;
    const all = loadFound(); const list = new Set(all[s.id] ?? []); list.add(id); all[s.id] = [...list]; saveFound(all);
    s.collectSet?.remove(id);
    appStore.setState({ found: all });
  }

  async outro() {
    const s = this.current; if (!s?.hooks.outro) { this.go('hub'); return; }
    const c = s.hooks.outro;
    appStore.setState({ phase: 'outro', endCard: false, activeHotspot: null });
    if (!appStore.getState().reducedMotion) await this.rig.cinematic(new CatmullRomCurve3(c.points.map((p) => new Vector3(...p))), new CatmullRomCurve3(c.look.map((p) => new Vector3(...p))), c.duration);
    appStore.setState({ titleCard: { kicker: 'Eight films · 2001–2011', title: 'The story ends; the castle remembers', sub: 'Return to the grounds and wander as long as you like.' } });
    await wait(4200);
    await this.go('hub');
  }

  private crossfade() {
    appStore.setState({ faded: true });
    setTimeout(() => appStore.setState({ faded: false }), 260);
  }

  // ------------------------------------------------------------ loop
  start() {
    if (this.running || document.hidden || appStore.getState().contextLost) return;
    this.running = true; this.clock.reset();
    const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.tick(); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  private tick() {
    this.clock.update(); const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    this.render(dt);
    this.fpsAcc += dt; this.fpsFrames++; this.statT += dt;
    if (this.statT > 0.5) {
      const info = this.renderer.info.render, post = this.post ? 1 : 0;
      appStore.setState({ stats: { ...appStore.getState().stats, fps: Math.round(this.fpsFrames / this.fpsAcc), triangles: info.triangles - post, calls: info.calls - post } });
      this.fpsAcc = 0; this.fpsFrames = 0; this.statT = 0;
    }
  }

  private render(dt: number) {
    const s = this.current; if (!s) return;
    s.globals.uTime.value = this.time;
    this.rig.update(dt);
    s.hooks.update?.(this.time, dt, this.camera, this.rig.progress);
    const st = appStore.getState();
    const near = s.hotspotSet?.update(this.camera, this.w, this.h, st.activeHotspot) ?? null;
    s.collectSet?.update(this.camera, this.w, this.h, null);
    s.waypointSet?.update(this.camera, this.w, this.h, st.hubHover);
    if (near !== this.lastNear) { this.lastNear = near; appStore.setState({ nearHotspot: near }); }
    for (const il of s.illustrations) { il.setVisible(il.data.hotspot === near || il.data.hotspot === st.activeHotspot); il.update(dt, this.camera.position, st.reducedMotion); }
    if (s.curve && st.phase === 'film') {
      const loops = this.rig.progress - this.rig.start;
      if (!this.loopShown && loops >= 0.985) { this.loopShown = true; if (s.hooks.outro) this.outro(); else appStore.setState({ endCard: true }); }
      if (this.loopShown && st.endCard && loops > 1.08) appStore.setState({ endCard: false });
      frame.emit(fract(this.rig.progress));
    }
    this.onFrame?.(dt);
    this.renderer.info.reset();
    if (this.post) this.post.render(this.renderer, s.scene, this.camera, this.time);
    else this.renderer.render(s.scene, this.camera);
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.fov = this.camera.aspect < 0.8 ? 68 : 55; // portrait phones get a wider view
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.post?.setSize(Math.floor(this.w * pr), Math.floor(this.h * pr));
  }

  dispose() {
    this.stop();
    this.unsub.forEach((f) => f());
    this.rig.dispose();
    for (const p of this.cache.values()) p.then((s) => this.disposeScene(s)).catch(() => {});
    this.cache.clear();
    this.post?.dispose();
    this.audio.disable();
    this.renderer.dispose();
  }
}
