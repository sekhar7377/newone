import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BloomEffect, NoiseEffect } from 'postprocessing';
import { FILMS } from '../data/films';
import { buildStrands, CP, introEnd, NUCLEUS_R, rng, type StrandSpec } from '../layout/strands';
import { getState, visibleIds } from '../state/store';
import { fx, intro, pointer, reducedMotion, settings } from './runtime';
import { Labels } from './labels';
import { pointsGeometry, ribbonGeometry, StrandSim } from './sim';
import { pointsMaterial, ribbonMaterial } from './shaders';

export const QUALITY = {
  // phones: render at up to 2× so strands stay crisp on high-density screens
  low: { hairs: 10, segments: 80, dpr: [1, 2] as [number, number] },
  medium: { hairs: 16, segments: 96, dpr: [1, 1.6] as [number, number] },
};
export type Quality = keyof typeof QUALITY;

const clock = { time: 0, real: 0 };
export const SPECS: StrandSpec[] = buildStrands(FILMS);
const indexById = new Map(SPECS.map((s) => [s.film.id, s.index]));

/** Shared with the DOM layer for picking (set by <Strands/>). */
export const scenePick: { at: (x: number, y: number) => number } = { at: () => -1 };

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const v = new THREE.Vector3();

function Strands({ quality }: { quality: Quality }) {
  const { hairs, segments } = QUALITY[quality];
  const sim = useMemo(() => new StrandSim(SPECS), []);
  const ribbons = useMemo(() => ribbonGeometry(SPECS, hairs, segments), [hairs, segments]);
  const dots = useMemo(() => pointsGeometry(SPECS, hairs), [hairs]);
  const ribbonMat = useMemo(() => ribbonMaterial(sim.pointsTex, sim.infoTex), [sim]);
  const dotMat = useMemo(() => pointsMaterial(sim.pointsTex, sim.infoTex), [sim]);
  const labels = useRef<Labels | null>(null);
  const { camera, size } = useThree();
  const smooth = useRef({ x: 0, y: 0 });

  useEffect(() => () => sim.dispose(), [sim]);
  useEffect(() => () => ribbons.dispose(), [ribbons]);
  useEffect(() => () => dots.dispose(), [dots]);
  useEffect(() => () => (ribbonMat.dispose(), dotMat.dispose()), [ribbonMat, dotMat]);

  useEffect(() => {
    const root = document.getElementById('labels');
    if (!root) return;
    const l = new Labels(root, SPECS);
    labels.current = l;
    const remeasure = () => l.measure();
    remeasure();
    document.fonts?.ready.then(remeasure);
    window.addEventListener('resize', remeasure);
    return () => {
      window.removeEventListener('resize', remeasure);
      l.dispose();
      labels.current = null;
    };
  }, []);

  useEffect(() => {
    // Pick the strand closest to a screen point: label tips first, then any control point.
    scenePick.at = (x, y) => {
      const vis = visibleIds();
      let best = -1;
      let bestD = 26;
      const scr = labels.current?.screen;
      for (const s of SPECS) {
        if (!vis.has(s.film.id)) continue;
        if (scr && !Number.isNaN(scr[s.index * 2])) {
          const d = Math.hypot(scr[s.index * 2] - x, scr[s.index * 2 + 1] - y) * 0.7;
          if (d < bestD) (bestD = d), (best = s.index);
        }
        for (let k = 3; k < CP; k++) {
          sim.point(s.index, k, v).project(camera);
          if (v.z > 1) continue;
          const d = Math.hypot((v.x * 0.5 + 0.5) * size.width - x, (-v.y * 0.5 + 0.5) * size.height - y);
          if (d < bestD) (bestD = d), (best = s.index);
        }
      }
      return best;
    };
    return () => {
      scenePick.at = () => -1;
    };
  }, [sim, camera, size]);

  useFrame((state, dt) => {
    const st = getState();
    const vis = visibleIds(st);
    const sel = st.selectedId != null ? (indexById.get(st.selectedId) ?? -1) : -1;
    const hov = fx.hoverIndex;

    // pointer presence and smoothed ray
    const target = pointer.inside && !pointer.down ? 1 : 0;
    pointer.presence += (target - pointer.presence) * (1 - Math.exp(-dt / 0.25));
    const k = 1 - Math.exp(-dt / 0.12);
    smooth.current.x += (pointer.x - smooth.current.x) * k;
    smooth.current.y += (pointer.y - smooth.current.y) * k;
    ndc.set((smooth.current.x / size.width) * 2 - 1, -(smooth.current.y / size.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);

    sim.update(dt, clock.time, raycaster.ray, reducedMotion ? 0 : pointer.presence);
    const filtering = vis.size !== SPECS.length;
    for (const s of SPECS) {
      const shown = vis.has(s.film.id);
      let visT = shown ? 1 : 0.06;
      if (sel >= 0 && s.index !== sel) visT *= 0.3;
      if (!filtering && sel < 0 && hov >= 0 && s.index !== hov) visT *= 0.75;
      const hl = s.index === sel ? 1 : s.index === hov ? 0.6 : 0;
      sim.setVisual(s.index, visT, hl, reducedMotion ? 1 : dt);
    }
    sim.commitInfo();

    const pixelScale = (2 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2)) / (size.height * state.viewport.dpr);
    const ripple = clock.real - fx.rippleAt;
    for (const m of [ribbonMat, dotMat]) {
      m.uniforms.uTime.value = clock.time;
      m.uniforms.uIntro.value = intro.t;
      m.uniforms.uHairSpread.value = settings.hairSpread;
      m.uniforms.uPixelScale.value = pixelScale;
      m.uniforms.uBrightness.value = settings.filamentBrightness;
      m.uniforms.uStream.value = settings.streamSpeed;
    }
    ribbonMat.uniforms.uRipple.value = ripple;
    const controls = state.controls as unknown as OrbitControls | null;
    labels.current?.update(sim, camera, size.width, size.height, intro.t, controls?.target ?? v.set(0, 0, 0), hov, sel);
    focus.current = sel >= 0 ? sim.point(sel, CP - 1, focusVec) : null; // strand tip
  });

  return (
    <group>
      <mesh geometry={ribbons} material={ribbonMat} frustumCulled={false} renderOrder={2} />
      <points geometry={dots} material={dotMat} frustumCulled={false} renderOrder={3} />
    </group>
  );
}

const focusVec = new THREE.Vector3();
const focus: { current: THREE.Vector3 | null } = { current: null };

/** Advances the single shared clock once per frame. */
function Clock() {
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    clock.real += d;
    clock.time += d * (reducedMotion ? 0 : 1);
    if (intro.running) {
      intro.t += d * intro.speed;
      if (intro.t >= introEnd()) intro.running = false;
    }
  });
  return null;
}

const NUCLEUS_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // billboard: keep the plane facing the camera
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy;
    gl_Position = projectionMatrix * mv;
  }
`;
const NUCLEUS_FS = /* glsl */ `
  uniform float uTime, uIntensity, uFlare;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float core = smoothstep(0.1, 0.0, r);
    float glow = exp(-r * r * 12.0) * 0.7 + exp(-r * 3.6) * 0.25;
    float ang = atan(p.y, p.x);
    float rays = pow(abs(sin(ang * 6.0 + uTime * 0.05)), 18.0) * exp(-r * 4.0) * 0.35;
    vec3 col = mix(vec3(1.0, 0.36, 0.0), vec3(1.0, 0.82, 0.55), core);
    float a = (core * 1.6 + glow + rays) * uIntensity * (1.0 + uFlare);
    gl_FragColor = vec4(col * a, a);
  }
`;

function Nucleus() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NUCLEUS_VS,
        fragmentShader: NUCLEUS_FS,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uFlare: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const [hover, setHover] = useState(false);
  const flare = useRef(0);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover]);
  useFrame((_, dt) => {
    const breath = reducedMotion ? 0 : Math.sin(clock.real * 0.9) * 0.5 + Math.sin(clock.real * 0.37) * 0.5;
    flare.current = Math.max(hover ? 0.25 : 0, flare.current - dt * 0.9);
    const since = clock.real - fx.rippleAt;
    const kick = since < 3 ? Math.exp(-since * 2) : 0;
    const grown = intro.running ? Math.min(1, intro.t / introEnd()) : 1;
    mat.uniforms.uTime.value = clock.real;
    mat.uniforms.uIntensity.value = 0.3 + 0.5 * grown ** 0.6 + breath * 0.05;
    mat.uniforms.uFlare.value = flare.current + kick * 0.9;
  });
  return (
    <group>
      <mesh
        onClick={(e) => {
          if (pointer.dragDist > 5) return;
          e.stopPropagation();
          fx.rippleAt = clock.real;
        }}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[NUCLEUS_R * 1.15, 24, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh material={mat} renderOrder={5}>
        <planeGeometry args={[NUCLEUS_R * 8, NUCLEUS_R * 8]} />
      </mesh>
    </group>
  );
}

function Dust({ count = 1200 }) {
  const geo = useMemo(() => {
    const r = rng(99);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(1.4 + r() ** 0.75 * 15);
      pos.set([d.x, d.y * 0.8, d.z], i * 3);
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aSeed;
          uniform float uTime, uSize;
          varying float vA;
          void main() {
            vec3 p = position + 0.25 * vec3(sin(uTime * 0.05 + aSeed * 40.0), sin(uTime * 0.04 + aSeed * 23.0), sin(uTime * 0.045 + aSeed * 11.0));
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = uSize * (0.6 + aSeed);
            vA = 0.15 + 0.25 * aSeed;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            float r = length(gl_PointCoord - 0.5) * 2.0;
            gl_FragColor = vec4(vec3(0.9, 0.85, 0.75) * vA, smoothstep(1.0, 0.0, r) * vA);
          }`,
        uniforms: { uTime: { value: 0 }, uSize: { value: 1.6 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame((s) => {
    mat.uniforms.uTime.value = clock.time;
    mat.uniforms.uSize.value = 1.6 * s.viewport.dpr;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={0} />;
}

const DEFAULT_POS = new THREE.Vector3(7.6, 4, 9.8);
// portrait screens pull back a little so strands fit the width, but not so far that everything turns tiny
const homePosition = (aspect: number) => DEFAULT_POS.clone().multiplyScalar(aspect < 1 ? (1 / aspect) ** 0.55 : 1);
export const MIN_DIST = 2.4;
export const MAX_DIST = 24;

/** Orbit controls, smooth zoom, keyboard orbit, focus-on-selection and reset. */
const viewShift = { x: 0, y: 0 };

function CameraRig() {
  const { camera, gl, size, set } = useThree();
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.06;
    c.rotateSpeed = 1.6; // hold and drag: full 360° around the nucleus
    c.enablePan = false;
    c.enableZoom = false; // smooth zoom handled below
    c.minDistance = MIN_DIST;
    c.maxDistance = MAX_DIST;
    c.autoRotateSpeed = 0.18;
    return c;
  }, [camera, gl]);
  const anim = useRef<{ from: THREE.Vector3; fromT: THREE.Vector3; to: THREE.Vector3; toT: THREE.Vector3; t: number } | null>(null);
  const zoomTo = useRef<number | null>(null);
  const lastReset = useRef(fx.resetCameraAt);
  const lastSel = useRef<string | null>(null);

  useEffect(() => {
    controls.connect(); // re-attach after a StrictMode remount
    set({ controls: controls as never });
    (window as unknown as { __view?: unknown }).__view = { camera, controls }; // used by the browser checks
    camera.position.copy(homePosition(size.width / size.height));
    camera.lookAt(0, 0, 0);
    const stop = () => (anim.current = null);
    controls.addEventListener('start', stop);
    return () => {
      controls.removeEventListener('start', stop);
      controls.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]);

  // wheel + pinch zoom, keyboard orbit
  useEffect(() => {
    const el = gl.domElement;
    const dist = () => camera.position.distanceTo(controls.target);
    const zoom = (to: number) => {
      zoomTo.current = THREE.MathUtils.clamp(to, MIN_DIST, MAX_DIST);
      anim.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      zoom((zoomTo.current ?? dist()) * Math.exp(THREE.MathUtils.clamp(dy, -240, 240) * 0.0013));
    };
    const touches = new Map<number, { x: number; y: number }>();
    let startGap = 0;
    let startDist = 0;
    const gap = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      // a new gesture starts with its primary finger: drop anything left from the last one
      if (e.isPrimary) touches.clear();
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) (startGap = gap()), (startDist = zoomTo.current ?? dist());
    };
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && startGap > 0) zoom(startDist * (startGap / Math.max(1, gap())));
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) startGap = 0;
    };
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [role="dialog"], .panel')) return;
      const off = camera.position.clone().sub(controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      let handled = true;
      if (e.key === 'ArrowLeft') sph.theta -= 0.12;
      else if (e.key === 'ArrowRight') sph.theta += 0.12;
      else if (e.key === 'ArrowUp') sph.phi = Math.max(0.15, sph.phi - 0.1);
      else if (e.key === 'ArrowDown') sph.phi = Math.min(Math.PI - 0.15, sph.phi + 0.1);
      else if (e.key === '+' || e.key === '=') zoom(dist() * 0.85);
      else if (e.key === '-' || e.key === '_') zoom(dist() * 1.18);
      else handled = false;
      if (!handled) return;
      e.preventDefault();
      if (e.key.startsWith('Arrow')) {
        anim.current = null;
        camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
    };
  }, [gl, camera, controls]);

  useFrame((_, dt) => {
    const st = getState();
    // selection changed → fly to the strand; deselect → fly home
    if (st.selectedId !== lastSel.current) {
      lastSel.current = st.selectedId;
      if (st.selectedId && focus.current) {
        const tip = focus.current.clone();
        const radial = tip.clone().normalize();
        const side = new THREE.Vector3().crossVectors(radial, new THREE.Vector3(0, 1, 0)).normalize();
        if (side.dot(camera.position) < 0) side.negate();
        const dir = side.multiplyScalar(1).addScaledVector(radial, 0.55).add(new THREE.Vector3(0, 0.3, 0)).normalize();
        // frame the whole strand, nucleus to tip, seen from the side
        const toT = tip.clone().multiplyScalar(0.5);
        const dist = Math.max(7.5, tip.length() * 1.75) * (size.width < size.height ? 1.5 : 1);
        anim.current = { from: camera.position.clone(), fromT: controls.target.clone(), toT, to: toT.clone().addScaledVector(dir, dist), t: 0 };
      } else if (!st.selectedId) {
        fx.resetCameraAt++;
      }
    }
    if (fx.resetCameraAt !== lastReset.current) {
      lastReset.current = fx.resetCameraAt;
      anim.current = { from: camera.position.clone(), fromT: controls.target.clone(), to: homePosition(size.width / size.height), toT: new THREE.Vector3(), t: 0 };
    }
    // on-screen zoom buttons
    if (fx.zoomBy !== 1) {
      const d = camera.position.distanceTo(controls.target);
      zoomTo.current = THREE.MathUtils.clamp((zoomTo.current ?? d) * fx.zoomBy, MIN_DIST, MAX_DIST);
      anim.current = null;
      fx.zoomBy = 1;
    }
    const a = anim.current;
    if (a) {
      zoomTo.current = null;
      a.t = reducedMotion ? 1 : Math.min(1, a.t + dt / 1.4);
      const e = 1 - (1 - a.t) ** 3;
      controls.target.lerpVectors(a.fromT, a.toT, e);
      // travel on an arc around the target rather than through the nucleus
      const f = a.from.clone().sub(a.fromT);
      const t = a.to.clone().sub(a.toT);
      const dir = f.clone().normalize().lerp(t.clone().normalize(), e).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, THREE.MathUtils.lerp(f.length(), t.length(), e));
      if (a.t >= 1) anim.current = null;
    }
    const z = zoomTo.current;
    if (z != null && !a) {
      const off = camera.position.clone().sub(controls.target);
      const d = THREE.MathUtils.lerp(off.length(), z, reducedMotion ? 1 : 1 - Math.exp(-dt / 0.22));
      camera.position.copy(controls.target).addScaledVector(off.normalize(), d);
      if (Math.abs(d - z) < 0.002) zoomTo.current = null;
    }
    controls.autoRotate = settings.autoRotate > 0 && !st.selectedId && !pointer.down;
    controls.update();

    // Centre the view in the space the panels leave free.
    const cam = camera as THREE.PerspectiveCamera;
    const mobile = size.width <= 700;
    const panelOpen = st.panel !== 'none';
    let wantX = 0;
    let wantY = 0;
    if (mobile) wantY = st.selectedId || panelOpen ? size.height * 0.26 : 0;
    else wantX = ((st.selectedId ? 380 : 0) - (panelOpen ? 340 : 0)) / 2;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt / 0.35);
    viewShift.x += (wantX - viewShift.x) * k;
    viewShift.y += (wantY - viewShift.y) * k;
    if (Math.abs(viewShift.x) < 0.5 && Math.abs(viewShift.y) < 0.5 && wantX === 0 && wantY === 0) {
      if (cam.view?.enabled) cam.clearViewOffset();
    } else {
      cam.setViewOffset(size.width, size.height, -viewShift.x, viewShift.y, size.width, size.height);
    }
  });
  return null;
}

function Effects() {
  const bloom = useRef<BloomEffect>(null);
  const noise = useRef<NoiseEffect>(null);
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = settings.glow;
    if (noise.current) noise.current.blendMode.opacity.value = 0.18 * settings.grain;
  });
  return (
    <EffectComposer multisampling={4}>
      <Bloom ref={bloom as never} mipmapBlur intensity={settings.glow} luminanceThreshold={0.55} luminanceSmoothing={0.35} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.75} />
      <Noise ref={noise as never} premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.18} />
    </EffectComposer>
  );
}

export function Scene({ quality, onError }: { quality: Quality; onError: (msg: string) => void }) {
  return (
    <Canvas
      flat
      dpr={QUALITY[quality].dpr}
      camera={{ fov: 38, near: 0.05, far: 100, position: DEFAULT_POS.toArray() }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onError('The 3D view lost its graphics context. The film list still works.');
        });
      }}
      aria-hidden="true"
    >
      <color attach="background" args={['#05070c']} />
      <Clock />
      <Dust />
      <Strands quality={quality} />
      <Nucleus />
      <CameraRig />
      <Effects />
    </Canvas>
  );
}
