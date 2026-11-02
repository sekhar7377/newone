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
      const t = document.createElement('span');
      t.className = 'tlabel-ti';
      t.textContent = f.title;
      const m = document.createElement('span');
      m.className = 'tlabel-me';
      m.textContent = [yearToken(f), f.director].filter(Boolean).join(' · ');
      const st = document.createElement('span');
      st.className = `tlabel-st st-${f.status !== 'released' ? f.status : f.creditType}`;
      st.textContent = statusToken(f);
      box.append(t, m, st);
      el.append(box);
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      root.appendChild(el);
      this.items.push({ el, spec, side: 0, opacity: -1, cls: '' });
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
      o = Math.round(o * 50) / 50;
      if (o !== it.opacity) {
        it.el.style.opacity = String(o);
        it.el.style.visibility = o > 0.02 ? 'visible' : 'hidden';
        it.opacity = o;
      }
      const cls = `tlabel${isSel ? ' sel' : ''}${isHov ? ' hov' : ''}`;
      if (o <= 0.02) {
        this.screen[i * 2] = NaN;
        continue;
      }
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      this.screen[i * 2] = x;
      this.screen[i * 2 + 1] = y;
      let side = x >= cx ? 1 : -1;
      // keep labels on screen near the edges
      if (side > 0 && x > w - 200) side = -1;
      else if (side < 0 && x < 200) side = 1;
      if (side !== it.side || cls !== it.cls) {
        it.el.className = cls + (side < 0 ? ' left' : '');
        it.side = side;
        it.cls = cls;
      }
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      it.el.style.zIndex = isSel ? '3' : isHov ? '2' : '1';
    }
  }

  dispose() {
    for (const it of this.items) it.el.remove();
    this.items = [];
  }
}
