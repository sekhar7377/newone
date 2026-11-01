import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3 } from 'three';

const DEG = Math.PI / 180;
const HOVER_YAW = 35 * DEG, HOVER_PITCH = 15 * DEG;
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const fract = (v: number) => v - Math.floor(v);

export type RigMode = 'path' | 'hub' | 'cinematic' | 'off';

/**
 * Camera navigation, per the brief:
 *  - no free roam: the camera rides a looping, hand-authored Catmull-Rom spline;
 *  - scroll / swipe / arrow keys move along it with eased damping;
 *  - on first entry backward travel is blocked until the visitor has moved forward a little;
 *  - look-around is hybrid: hovering rotates gently (clamped ±35° yaw, ±15° pitch),
 *    click-drag looks freely and springs back on release, touch drags look and
 *    vertical swipes travel, gyroscope is opt-in;
 *  - the pointer is never locked.
 */
export class CameraRig {
  mode: RigMode = 'off';
  curve: CatmullRomCurve3 | null = null;
  look: CatmullRomCurve3 | null = null;
  length = 1;
  progress = 0; target = 0; start = 0;
  unlocked = true;
  reducedMotion = false;
  stations: number[] = [];

  onBlockedBackward?: () => void;
  onFirstMove?: () => void;
  onStep?: (t: number) => void; // reduced motion: crossfade to a station
  onInteract?: () => void;

  private yaw = 0; private pitch = 0; private roll = 0;
  private hoverYaw = 0; private hoverPitch = 0;
  private dragYaw = 0; private dragPitch = 0; private dragging = false;
  private viewYaw = 0; private viewPitch = 0;
  private gyroYaw = 0; private gyroPitch = 0; private gyroBase: { a: number; b: number } | null = null; gyroOn = false;
  private keyDir = 0; private stepAcc = 0; private lastBaseYaw: number | null = null;
  private touch: { id: number; x: number; y: number; axis: 'x' | 'y' | null; lastY: number; lastT: number; vy: number } | null = null;
  private mouseDown: { x: number; y: number } | null = null;
  private moved = false;

  // hub
  hubPos = new Vector3(0, 360, 360); hubLook = new Vector3(0, 0, -100);
  // cinematic
  private cine: { curve: CatmullRomCurve3; look: CatmullRomCurve3; dur: number; t: number; done: () => void } | null = null;

  private _p = new Vector3(); private _l = new Vector3(); private _d = new Vector3();
  private cleanup: (() => void)[] = [];

  constructor(public camera: PerspectiveCamera, private el: HTMLElement) { this.bind(); }

  setPath(points: Vector3[], look: Vector3[], startT = 0) {
    this.curve = new CatmullRomCurve3(points, true, 'centripetal', 0.5);
    this.look = new CatmullRomCurve3(look, true, 'centripetal', 0.5);
    this.curve.arcLengthDivisions = 600;
    this.length = this.curve.getLength();
    this.progress = this.target = this.start = startT;
    this.unlocked = false; this.moved = false; this.lastBaseYaw = null;
    this.dragYaw = this.dragPitch = this.viewYaw = this.viewPitch = 0;
    this.mode = 'path';
  }

  /** Unblock backward travel immediately (deep links, returning visitors). */
  unlock() { this.unlocked = true; }

  cinematic(curve: CatmullRomCurve3, look: CatmullRomCurve3, dur: number): Promise<void> {
    return new Promise((done) => { this.cine = { curve, look, dur, t: 0, done }; this.mode = 'cinematic'; });
  }
  skipCinematic() { if (this.cine) { this.cine.t = this.cine.dur; } }

  /** Fly to a path parameter by the shortest way round the loop. */
  flyTo(t: number, view?: { yaw?: number; pitch?: number }) {
    this.unlocked = true;
    const d = ((t - fract(this.target)) % 1 + 1.5) % 1 - 0.5;
    if (this.reducedMotion) { this.target = this.target + d; this.onStep?.(this.target); }
    else this.target += d;
    this.viewYaw = view?.yaw ?? 0; this.viewPitch = view?.pitch ?? 0;
  }
  jumpTo(t: number) { this.progress = this.target = t; }

  /** Travel by `metres` along the path. */
  travel(metres: number) {
    if (this.mode !== 'path') { if (this.mode === 'cinematic') this.onInteract?.(); return; }
    this.onInteract?.();
    if (Math.abs(metres) > 0.5) { this.viewYaw *= 0.5; this.viewPitch *= 0.5; }
    if (this.reducedMotion) {
      this.stepAcc += metres;
      if (Math.abs(this.stepAcc) < 40) return;
      const dir = Math.sign(this.stepAcc); this.stepAcc = 0;
      if (dir < 0 && !this.unlocked) { this.onBlockedBackward?.(); return; }
      this.step(dir); return;
    }
    let next = this.target + metres / this.length;
    if (!this.unlocked && next < this.start) { next = this.start; if (metres < 0) this.onBlockedBackward?.(); }
    this.target = next;
    if (!this.moved && this.target - this.start > 0.004) { this.moved = true; this.onFirstMove?.(); }
    if (!this.unlocked && this.target - this.start > 25 / this.length) this.unlocked = true;
  }

  /** Jump to the next / previous station (hotspot) along the path. */
  step(dir: number) {
    if (!this.stations.length) { this.travel(dir * 60); return; }
    const cur = fract(this.target), eps = 0.002;
    const sorted = [...this.stations].sort((a, b) => a - b);
    let t = dir > 0 ? sorted.find((s) => s > cur + eps) ?? sorted[0] + 1 : [...sorted].reverse().find((s) => s < cur - eps) ?? sorted[sorted.length - 1] - 1;
    if (dir < 0 && !this.unlocked) { this.onBlockedBackward?.(); return; }
    t = Math.floor(this.target) + t;
    this.unlocked = this.unlocked || dir > 0;
    if (!this.moved) { this.moved = true; this.onFirstMove?.(); }
    if (this.reducedMotion) { this.target = t; this.onStep?.(t); } else this.target = t;
  }

  // ------------------------------------------------------------ input
  private bind() {
    const el = this.el;
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => { el.addEventListener(t, f as EventListener, o); this.cleanup.push(() => el.removeEventListener(t, f as EventListener)); };
    const onWin = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => { window.addEventListener(t, f as EventListener, o); this.cleanup.push(() => window.removeEventListener(t, f as EventListener)); };

    on('wheel', (e) => {
      if (this.mode === 'off') return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      this.travel(MathUtils.clamp(e.deltaY * unit, -240, 240) * 0.055);
    }, { passive: false });

    on('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        const r = el.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        this.hoverYaw = -nx * HOVER_YAW; this.hoverPitch = -ny * HOVER_PITCH;
        if (this.mouseDown) {
          this.dragging = true;
          this.dragYaw += e.movementX * 0.0055; this.dragPitch = MathUtils.clamp(this.dragPitch + e.movementY * 0.0045, -1.2, 1.2);
        }
        return;
      }
      if (!this.touch || this.touch.id !== e.pointerId) return;
      const dx = e.clientX - this.touch.x, dy = e.clientY - this.touch.y;
      if (!this.touch.axis && Math.hypot(dx, dy) > 8) this.touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (this.touch.axis === 'x') { this.dragging = true; this.dragYaw += (e.movementX || 0) * 0.008; this.dragPitch = MathUtils.clamp(this.dragPitch + (e.movementY || 0) * 0.004, -1, 1); }
      else if (this.touch.axis === 'y') {
        const step = this.touch.lastY - e.clientY; const now = performance.now();
        this.touch.vy = step / Math.max(1, now - this.touch.lastT); this.touch.lastY = e.clientY; this.touch.lastT = now;
        this.travel(step * 0.16); // swipe up travels forward
      }
    });
    on('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { if (e.button === 0) this.mouseDown = { x: e.clientX, y: e.clientY }; return; }
      this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, lastY: e.clientY, lastT: performance.now(), vy: 0 };
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') { this.mouseDown = null; this.dragging = false; return; }
      if (this.touch && this.touch.id === e.pointerId) {
        if (this.touch.axis === 'y') this.travel(MathUtils.clamp(this.touch.vy, -4, 4) * 60); // fling
        this.touch = null; this.dragging = false;
      }
    };
    onWin('pointerup', up); onWin('pointercancel', up);
    on('pointerleave', (e) => { if (e.pointerType === 'mouse' && !this.mouseDown) { this.hoverYaw *= 0.3; this.hoverPitch *= 0.3; } });

    onWin('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input,textarea,select,[contenteditable],[role="dialog"]'))) return;
      if (this.mode === 'off') return;
      if (this.mode === 'cinematic' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) { this.onInteract?.(); return; }
      if (this.mode !== 'path') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { this.keyDir = 1; e.preventDefault(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { this.keyDir = -1; e.preventDefault(); }
      else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { this.step(1); e.preventDefault(); }
      else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { this.step(-1); e.preventDefault(); }
    });
    onWin('keyup', (e) => { if (e.key.startsWith('Arrow')) this.keyDir = 0; });
    onWin('blur', () => { this.keyDir = 0; this.mouseDown = null; this.dragging = false; });
  }

  /** Gyroscope look, opt-in only (iOS needs a permission prompt from a user gesture). */
  async enableGyro(): Promise<boolean> {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    try { if (DOE?.requestPermission && (await DOE.requestPermission()) !== 'granted') return false; } catch { return false; }
    const h = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null) return;
      if (!this.gyroBase) this.gyroBase = { a: e.alpha, b: e.beta };
      let da = e.alpha - this.gyroBase.a; if (da > 180) da -= 360; if (da < -180) da += 360;
      this.gyroYaw = MathUtils.clamp(da * DEG, -1.2, 1.2); this.gyroPitch = MathUtils.clamp((e.beta - this.gyroBase.b) * DEG * 0.8, -0.6, 0.6);
    };
    window.addEventListener('deviceorientation', h);
    this.cleanup.push(() => window.removeEventListener('deviceorientation', h));
    this.gyroOn = true; this.gyroBase = null;
    return true;
  }
  disableGyro() { this.gyroOn = false; this.gyroYaw = this.gyroPitch = 0; }

  // ------------------------------------------------------------ update
  update(dt: number) {
    const cam = this.camera;
    if (!this.dragging) { const k = Math.exp(-dt * 2.4); this.dragYaw *= k; this.dragPitch *= k; }
    const gy = this.gyroOn ? this.gyroYaw : 0, gp = this.gyroOn ? this.gyroPitch : 0;
    let hy = this.hoverYaw, hp = this.hoverPitch;
    if (this.mode === 'hub') { hy *= 0.18; hp *= 0.25; }
    const ty = hy + this.dragYaw + this.viewYaw + gy, tp = MathUtils.clamp(hp + this.dragPitch + this.viewPitch + gp, -1.35, 1.35);
    this.yaw += (ty - this.yaw) * damp(4, dt); this.pitch += (tp - this.pitch) * damp(4, dt);

    if (this.mode === 'path' && this.curve && this.look) {
      if (this.keyDir) this.travel(this.keyDir * 26 * dt);
      this.progress += (this.target - this.progress) * damp(this.reducedMotion ? 50 : 3.0, dt);
      const u = fract(this.progress);
      this.curve.getPointAt(u, this._p);
      this.look.getPoint(this.curve.getUtoTmapping(u, 0), this._l);
      this.orient(this._p, this._l, dt, true);
    } else if (this.mode === 'hub') {
      this.orient(this.hubPos, this.hubLook, dt, false);
    } else if (this.mode === 'cinematic' && this.cine) {
      const c = this.cine; c.t = Math.min(c.dur, c.t + dt);
      const e = easeInOut(c.t / c.dur);
      c.curve.getPointAt(e, this._p); c.look.getPointAt(e, this._l);
      this.orient(this._p, this._l, dt, true);
      if (c.t >= c.dur) { this.cine = null; this.mode = 'off'; c.done(); }
    }
    void cam;
  }

  private orient(pos: Vector3, look: Vector3, dt: number, bank: boolean) {
    const cam = this.camera;
    cam.position.copy(pos);
    this._d.subVectors(look, pos).normalize();
    const baseYaw = Math.atan2(-this._d.x, -this._d.z), basePitch = Math.asin(MathUtils.clamp(this._d.y, -1, 1));
    if (bank && this.lastBaseYaw !== null && dt > 0) {
      let dy = baseYaw - this.lastBaseYaw; if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
      const targetRoll = MathUtils.clamp((dy / dt) * 0.18, -0.12, 0.12);
      this.roll += (targetRoll - this.roll) * damp(2, dt);
    } else this.roll *= 0.9;
    this.lastBaseYaw = baseYaw;
    cam.rotation.set(basePitch + this.pitch, baseYaw + this.yaw, this.roll, 'YXZ');
  }

  /** Current look offsets relative to the path direction (studio saves these with a hotspot view). */
  lookOffsets() { return { yaw: this.yaw, pitch: this.pitch }; }

  /** Where the camera will be at path parameter t (for the studio and hotspot placement). */
  pointAt(t: number, out = new Vector3()) { return this.curve ? this.curve.getPointAt(fract(t), out) : out; }

  dispose() { this.cleanup.forEach((f) => f()); this.cleanup = []; }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
