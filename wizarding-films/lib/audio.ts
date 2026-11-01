import type { Ambience } from '@/scenes/palettes';

/**
 * Ambient beds synthesised with Web Audio: no audio files to download, and
 * nothing licensed. Off until the visitor opts in (and an AudioContext can
 * only start from a user gesture anyway). Each bed is filtered noise plus a
 * few sparse tonal events: wind, lake water, distant bells, fire crackle,
 * hall drone, storm and rain.
 */
export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bed: { stop: () => void } | null = null;
  private current: Ambience | null = null;
  private noise: AudioBuffer | null = null;
  enabled = false;

  async enable(ambience: Ambience) {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 4; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); let b = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.985 * b + 0.015 * w; d[i] = w * 0.35 + b * 3.2; } // pink-ish
    }
    await this.ctx.resume();
    this.enabled = true;
    this.master!.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.8);
    this.set(ambience, true);
  }
  disable() {
    this.enabled = false;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => { if (!this.enabled) this.ctx?.suspend(); }, 1200);
  }
  pause() { this.ctx?.suspend(); }
  resume() { if (this.enabled) this.ctx?.resume(); }

  set(a: Ambience, force = false) {
    if (!this.ctx || (!force && a === this.current)) return;
    if (a === this.current && this.bed) return;
    this.current = a;
    const old = this.bed; this.bed = this.build(a);
    if (old) setTimeout(() => old.stop(), 2500);
  }

  /** Rumble synced to lightning in the storm scene. */
  thunder(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const n = this.noiseSrc(); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime + 0.3 + Math.random() * 0.8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * strength, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 4);
    n.connect(f).connect(g).connect(this.master!); n.start(t); n.stop(t + 4.2);
  }

  private noiseSrc() { const s = this.ctx!.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = Math.random() * 3; return s; }

  private build(a: Ambience) {
    const ctx = this.ctx!, out = ctx.createGain(); out.gain.value = 0; out.connect(this.master!);
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    const nodes: AudioScheduledSourceNode[] = []; const timers: number[] = [];
    const wind = (freq: number, q: number, level: number, sweep = 0.07) => {
      const n = this.noiseSrc(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = level;
      const lfo = ctx.createOscillator(); lfo.frequency.value = sweep; const lg = ctx.createGain(); lg.gain.value = freq * 0.45;
      lfo.connect(lg).connect(f.frequency);
      const alfo = ctx.createOscillator(); alfo.frequency.value = sweep * 1.7; const ag = ctx.createGain(); ag.gain.value = level * 0.5; alfo.connect(ag).connect(g.gain);
      n.connect(f).connect(g).connect(out); n.start(); lfo.start(); alfo.start(); nodes.push(n, lfo, alfo);
    };
    const lowNoise = (freq: number, level: number) => {
      const n = this.noiseSrc(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = level; n.connect(f).connect(g).connect(out); n.start(); nodes.push(n);
    };
    const every = (min: number, max: number, fn: () => void) => {
      const tick = () => { fn(); timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000)); };
      timers.push(window.setTimeout(tick, Math.random() * max * 1000));
    };
    const bell = (base: number, level: number) => {
      const t = ctx.currentTime;
      for (const [mult, amp] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]]) {
        const o = ctx.createOscillator(); o.frequency.value = base * mult; const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level * amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 6 / mult + 1);
        o.connect(g).connect(out); o.start(t); o.stop(t + 8);
      }
    };
    const crackle = (level: number) => {
      const t = ctx.currentTime; const n = this.noiseSrc(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800 + Math.random() * 3000;
      const g = ctx.createGain(); g.gain.setValueAtTime(level * (0.3 + Math.random()), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
      n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + 0.12);
    };
    const lap = (level: number) => { // water lapping: soft swells of low noise
      const t = ctx.currentTime; const n = this.noiseSrc(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + Math.random() * 300;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.6); g.gain.linearRampToValueAtTime(0, t + 1.8);
      n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + 2);
    };
    const drone = (freq: number, level: number) => {
      for (const d of [0, 0.4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq + d; const g = ctx.createGain(); g.gain.value = level; o.connect(g).connect(out); o.start(); nodes.push(o); }
    };
    switch (a) {
      case 'lake': wind(420, 0.6, 0.12); every(1.2, 3, () => lap(0.18)); every(25, 50, () => bell(196, 0.03)); break;
      case 'countryside': wind(700, 0.5, 0.16, 0.12); wind(250, 0.8, 0.08); break;
      case 'bells': wind(520, 0.9, 0.14, 0.05); every(9, 16, () => bell(146.8, 0.06)); every(3, 7, () => bell(880 + Math.random() * 400, 0.008)); break;
      case 'fire': lowNoise(240, 0.22); every(0.05, 0.4, () => crackle(0.25)); every(2, 4, () => lap(0.06)); break;
      case 'hall': drone(55, 0.05); drone(82.4, 0.02); every(4, 9, () => bell(1320 + Math.random() * 900, 0.01)); wind(300, 2, 0.03, 0.03); break;
      case 'storm': wind(380, 0.5, 0.2, 0.15); lowNoise(2600, 0.06); break;
      case 'winter': wind(900, 1.4, 0.1, 0.05); wind(1800, 6, 0.02, 0.09); break;
      case 'dawn': wind(450, 0.6, 0.1); every(0.2, 1.2, () => crackle(0.1)); every(20, 40, () => bell(130.8, 0.04)); break;
    }
    return {
      stop: () => {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
        timers.forEach(clearTimeout);
        setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); out.disconnect(); }, 2500);
      },
    };
  }
}
