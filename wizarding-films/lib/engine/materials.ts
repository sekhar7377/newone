import {
  AdditiveBlending, Color, DoubleSide, FrontSide, NormalBlending, ShaderMaterial, Vector3, Vector4, type IUniform, type Material,
} from 'three';
import type { Palette } from '@/scenes/palettes';
import type { Quality } from '@/lib/quality';
import { silhouetteVert, silhouetteFrag } from '@/shaders/silhouette.glsl';
import { glowVert, glowFrag } from '@/shaders/windowGlow.glsl';
import { orbVert, orbFrag } from '@/shaders/orb.glsl';
import { waterVert, waterFrag } from '@/shaders/water.glsl';
import { skyVert, skyFrag } from '@/shaders/sky.glsl';
import { particlesVert, particlesFrag } from '@/shaders/particles.glsl';
import { lineVert, lineFrag } from '@/shaders/line.glsl';
import { runeVert, runeFrag } from '@/shaders/rune.glsl';

type U = Record<string, IUniform>;
const c = (hex: string) => new Color(hex);

/** Scene-wide uniforms shared by reference across every material (fog, light, time). */
export function createGlobals(p: Palette): U {
  const fire = p.fire;
  return {
    uTime: { value: 0 },
    uFogLow: { value: c(p.fogLow) }, uFogHigh: { value: c(p.fogHigh) },
    uLightDir: { value: new Vector3(...p.lightDir).normalize() }, uLightColor: { value: c(p.light) },
    uFogDensity: { value: p.fogDensity }, uFogFalloff: { value: p.fogFalloff }, uFogBase: { value: p.fogBase },
    uMistStrength: { value: p.mist }, uFlash: { value: 0 },
    uFire: { value: fire ? new Vector4(...fire.pos, fire.intensity) : new Vector4(0, -9999, 0, 0) },
    uFireColor: { value: c(fire?.color ?? '#000000') },
  };
}

/** Material factory: tracks everything it creates so a scene can dispose in one call. */
export class MaterialKit {
  private made: Material[] = [];
  constructor(public globals: U, public palette: Palette, public quality: Quality) {}

  private make(vertexShader: string, fragmentShader: string, uniforms: U, opts: Partial<ShaderMaterial> & { defines?: Record<string, string | number | boolean> } = {}) {
    const m = new ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: { ...this.globals, ...uniforms },
      defines: { MIST_OCTAVES: this.quality.mistOctaves, ...(opts.defines ?? {}) },
      fog: false, lights: false,
    });
    Object.assign(m, { ...opts, defines: m.defines });
    this.made.push(m);
    return m;
  }

  silhouette(o: { low?: string; high?: string; rim?: string; heightMin?: number; heightRange?: number; flag?: boolean; sway?: boolean; bob?: boolean; float?: boolean; snow?: number; doubleSide?: boolean; rimPower?: number } = {}) {
    const p = this.palette;
    const defines: Record<string, boolean> = {};
    if (o.flag) defines.FLAG = true; if (o.sway) defines.SWAY = true; if (o.bob) defines.BOB = true; if (o.float) defines.FLOAT = true;
    return this.make(silhouetteVert, silhouetteFrag, {
      uBaseLow: { value: c(o.low ?? p.baseLow) }, uBaseHigh: { value: c(o.high ?? p.baseHigh) }, uRim: { value: c(o.rim ?? p.rim) },
      uHeightMin: { value: o.heightMin ?? -10 }, uHeightRange: { value: o.heightRange ?? 160 }, uRimPower: { value: o.rimPower ?? p.rimPower },
      uSnow: { value: o.snow ?? p.snow }, uSnowColor: { value: c(p.snowColor) },
      uFlagSpeed: { value: 2.6 }, uFlagFreq: { value: 5.5 }, uFlagAmp: { value: 0.22 },
    }, { defines, side: o.doubleSide || o.flag ? DoubleSide : FrontSide });
  }

  /** mode: window (oriented, angle fade) | flame (billboard + flicker) | beam. */
  glow(o: { mode?: 'window' | 'flame' | 'beam'; color?: string; intensity?: number; inflate?: number; halo?: number; flicker?: boolean; float?: boolean; flickerSpeed?: number; flickerAmount?: number } = {}) {
    const defines: Record<string, boolean> = {};
    if (o.mode === 'flame') defines.FLAME = true; if (o.mode === 'beam') defines.BEAM = true;
    if (o.flicker) defines.FLICKER = true; if (o.float) defines.FLOAT = true;
    return this.make(glowVert, glowFrag, {
      uGlowColor: { value: c(o.color ?? this.palette.glow) }, uIntensity: { value: o.intensity ?? 1 },
      uInflate: { value: o.inflate ?? 1.6 }, uHalo: { value: o.halo ?? 3.5 },
      uFlickerSpeed: { value: o.flickerSpeed ?? 6 }, uFlickerAmount: { value: o.flickerAmount ?? 0.3 },
    }, { defines, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  }

  orb(o: { color?: string; intensity?: number } = {}) {
    return this.make(orbVert, orbFrag, {
      uGlowColor: { value: c(o.color ?? this.palette.glow) }, uIntensity: { value: o.intensity ?? 1 },
      uFlickerSpeed: { value: 0.8 }, uFlickerAmount: { value: 0.35 },
    }, { transparent: true, depthWrite: false, blending: AdditiveBlending });
  }

  water(o: { deep?: string; wave?: number; scale?: number; spec?: number; cracks?: number } = {}) {
    return this.make(waterVert, waterFrag, {
      uDeep: { value: c(o.deep ?? this.palette.water) }, uSkyTop: { value: c(this.palette.skyTop) },
      uWave: { value: o.wave ?? 0.55 }, uScale: { value: o.scale ?? 1 }, uSpec: { value: o.spec ?? 1 }, uCracks: { value: o.cracks ?? 0 },
    });
  }

  sky() {
    const p = this.palette;
    return this.make(skyVert, skyFrag, {
      uSkyTop: { value: c(p.skyTop) }, uSkyHorizon: { value: c(p.skyHorizon) }, uCloudColor: { value: c(p.cloud) },
      uStars: { value: p.stars }, uMoon: { value: p.moon }, uMoonSize: { value: p.moonSize }, uClouds: { value: p.clouds },
    }, { depthWrite: false, depthTest: false, side: DoubleSide });
  }

  particles(o: { color?: string; size: number; velocity: [number, number, number]; box: [number, number, number]; turb?: number; additive?: boolean; opacity?: number; soft?: number; flicker?: boolean; columns?: [number, number, number][]; life?: number; rise?: number }) {
    const defines: Record<string, boolean> = {};
    if (o.additive) defines.ADDITIVE = true; if (o.columns) defines.COLUMNS = true;
    const sources = (o.columns ?? []).concat(Array(6).fill([0, 0, 0])).slice(0, 6).map((s) => new Vector3(...s));
    return this.make(particlesVert, particlesFrag, {
      uColor: { value: c(o.color ?? this.palette.particleColor) }, uSize: { value: o.size }, uTurb: { value: o.turb ?? 1 },
      uVelocity: { value: new Vector3(...o.velocity) }, uBox: { value: new Vector3(...o.box) }, uPixelRatio: { value: this.quality.pixelRatio },
      uOpacity: { value: o.opacity ?? 1 }, uSoft: { value: o.soft ?? 1.5 }, uFlickerParticles: { value: o.flicker ? 1 : 0 },
      uSources: { value: sources }, uSourceCount: { value: Math.max(1, o.columns?.length ?? 1) }, uLife: { value: o.life ?? 30 }, uRise: { value: o.rise ?? 120 },
    }, { defines, transparent: true, depthWrite: false, blending: o.additive ? AdditiveBlending : NormalBlending });
  }

  line(o: { color?: string; thickness?: number; wobble?: number } = {}) {
    return this.make(lineVert, lineFrag, {
      uColor: { value: c(o.color ?? this.palette.ui.accent) }, uOpacity: { value: 1 }, uProgress: { value: 0 },
      uThickness: { value: o.thickness ?? 0.06 }, uWobble: { value: o.wobble ?? 0.02 },
    }, { transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  }

  rune(o: { color?: string; newColor?: string; size?: number; shape?: 0 | 1 } = {}) {
    return this.make(runeVert, runeFrag, {
      uColor: { value: c(o.color ?? this.palette.ui.accent) }, uNewColor: { value: c(o.newColor ?? '#ffffff') },
      uSize: { value: o.size ?? 2.2 }, uShape: { value: o.shape ?? 0 },
    }, { transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending });
  }

  dispose() { this.made.forEach((m) => m.dispose()); this.made = []; }
}
