import * as THREE from 'three';
import { CP, type StrandSpec } from '../layout/strands';
import { statusToken, yearToken } from '../data/derive';
import type { StrandSim } from './sim';

const tmp = new THREE.Vector3();
const centre = new THREE.Vector3();

interface Item {
  el: HTMLDivElement;
  spec: StrandSpec;
  side: number;
  opacity: number;
  cls: string;
  hasStatus: boolean;
  /** Measured label size in css px (0 until measured). */
  w: number;
  h: number;
}

/**
 * DOM labels pinned to each strand tip. Updated imperatively from the render
 * loop (transform + opacity only), never through React.
 */
export class Labels {
  private items: Item[] = [];
  /** Screen-space tip positions (css px), used for picking. NaN when hidden. */
  readonly screen: Float32Array;

  constructor(root: HTMLElement, specs: StrandSpec[]) {
    this.screen = new Float32Array(specs.length * 2).fill(NaN);
    for (const spec of specs) {
      const f = spec.film;
      const el = document.createElement('div');
      el.className = 'tlabel';
      const box = document.createElement('div');
      if (f.look) {
        const img = document.createElement('img');
        img.className = 'tlabel-look';
        img.width = 36;
        img.height = 36;
        img.src = f.look.src;
        img.alt = '';
        img.decoding = 'async';
        img.onerror = () => img.remove();
        el.append(img); // centred on the strand tip

      }
      const t = document.createElement('span');
      t.className = 'tlabel-ti';
      t.textContent = f.title;
      const yr = document.createElement('span');
      yr.className = 'tlabel-yr';
      yr.textContent = yearToken(f);
      t.append(' ', yr); // year sits right beside the title
      box.append(t);
      if (f.director) {
        const m = document.createElement('span');
        m.className = 'tlabel-me';
        m.textContent = f.director;
        box.append(m);
      }
      // Released lead films need no status line; others say Filming, Cameo, Voice credit…
      const token = statusToken(f);
      if (token !== 'Released') {
        const st = document.createElement('span');
        st.className = `tlabel-st st-${f.status !== 'released' ? f.status : f.creditType}`;
        st.textContent = token;
        box.append(st);
      }
      el.append(box);
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      root.appendChild(el);
      this.items.push({ el, spec, side: 0, opacity: -1, cls: '', hasStatus: token !== 'Released', w: 0, h: 0 });
    }
  }

  /** Measure real label sizes (hidden labels still lay out). */
  measure() {
    for (const it of this.items) {
      const box = it.el.lastElementChild as HTMLElement | null;
      if (!box) continue;
      it.w = box.offsetWidth + (it.spec.film.look ? 26 : 8);
      it.h = box.offsetHeight + 2;
    }
  }

  update(
    sim: StrandSim,
    camera: THREE.Camera,
    w: number,
    h: number,
    introT: number,
    target: THREE.Vector3,
    hover: number,
    selected: number,
  ) {
    const camToTarget = camera.position.distanceTo(target);
    centre.set(0, 0, 0).project(camera);
    const cx = (centre.x * 0.5 + 0.5) * w;
    const mobile = w <= 700;
    // pass 1: where each label wants to be and how visible it is
    const cand: { it: Item; x: number; y: number; o: number; pr: number; side: number; isSel: boolean; isHov: boolean }[] = [];
    for (const it of this.items) {
      const i = it.spec.index;
      sim.point(i, CP - 1, tmp);
      const dist = tmp.distanceTo(camera.position);
      tmp.project(camera);
      const g = 1 - (1 - Math.min(1, Math.max(0, (introT - it.spec.growStart) / it.spec.growDur))) ** 1.6;
      const arrived = Math.min(1, Math.max(0, (g - 0.82) / 0.18));
      const depth = THREE.MathUtils.clamp(1 - (dist - camToTarget) / 7, 0.28, 1);
      const bright = THREE.MathUtils.clamp(0.45 + it.spec.look.brightness * 0.5, 0.55, 1);
      const vis = sim.visibility(i);
      const isSel = i === selected;
      const isHov = i === hover;
      let o = tmp.z < 1 ? arrived * (isSel || isHov ? 1 : depth * bright) * vis * vis : 0;
      if (selected >= 0 && !isSel) o *= 0.55;
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      let side = x >= cx ? 1 : -1;
      const edge = mobile ? 130 : 200;
      if (side > 0 && x > w - edge) side = -1;
      else if (side < 0 && x < edge) side = 1;
      const pr = (isSel ? 100 : 0) + (isHov ? 50 : 0) + (it.spec.film.look ? 0.3 : 0) + o * depth;
      cand.push({ it, x, y, o, pr, side, isSel, isHov });
    }

    // pass 2: declutter. Most important labels claim space first; a label that
    // would overlap one already placed fades out until the view changes.
    cand.sort((a, b) => b.pr - a.pr);
    const placed: [number, number, number, number][] = [];
    // keep labels clear of the floating zoom buttons on phones
    if (mobile) placed.push([w - 64, h * 0.42 - 6, w, h * 0.42 + 106]);
    const charW = mobile ? 6.4 : 7.4;
    const lineH = mobile ? 12 : 13;
    for (const c of cand) {
      const { it } = c;
      const i = it.spec.index;
      const f = it.spec.film;
      const lines = mobile ? 1 : 1 + (f.director ? 1 : 0) + (it.hasStatus ? 1 : 0);
      const lw = it.w || (f.title.length + 6) * charW + (f.look ? 26 : 8);
      const lh = it.h || lines * lineH + 4;
      // flip to the other side if the label would run off screen; hide it if neither side fits
      const fits = (side: number) => (side > 0 ? c.x >= 4 && c.x + lw <= w - 4 : c.x - lw >= 4 && c.x <= w - 4);
      if (!fits(c.side) && fits(-c.side)) c.side = -c.side;
      const x0 = c.side > 0 ? c.x : c.x - lw;
      const rect: [number, number, number, number] = [x0, c.y - lh / 2, x0 + lw, c.y + lh / 2];
      let o = c.o;
      if (!c.isSel && !c.isHov && (!fits(c.side) || rect[1] < 0 || rect[3] > h)) o = 0;
      if (o > 0.02 && !c.isSel && !c.isHov) {
        const hit = placed.some((r) => rect[0] < r[2] && rect[2] > r[0] && rect[1] < r[3] && rect[3] > r[1]);
        if (hit) o = 0;
      }
      if (o > 0.02) placed.push(rect);
      o = Math.round(o * 50) / 50;
      if (o !== it.opacity) {
        it.el.style.opacity = String(o);
        it.el.style.visibility = o > 0.02 ? 'visible' : 'hidden';
        it.opacity = o;
      }
      // picking still works on strands whose label is hidden
      this.screen[i * 2] = c.o > 0.02 ? c.x : NaN;
      this.screen[i * 2 + 1] = c.y;
      if (o <= 0.02) continue;
      const cls = `tlabel${f.look ? ' has-look' : ''}${c.isSel ? ' sel' : ''}${c.isHov ? ' hov' : ''}`;
      if (c.side !== it.side || cls !== it.cls) {
        it.el.className = cls + (c.side < 0 ? ' left' : '');
        it.side = c.side;
        it.cls = cls;
      }
      it.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
      it.el.style.zIndex = c.isSel ? '3' : c.isHov ? '2' : '1';
    }
  }

  dispose() {
    for (const it of this.items) it.el.remove();
    this.items = [];
  }
}
