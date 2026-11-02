import { introEnd } from '../layout/strands';

/**
 * Mutable runtime state read by the single render loop. Kept outside React so
 * pointer movement and animation never trigger component re-renders.
 */

export const reducedMotion =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const DEFAULT_SETTINGS = {
  interactionRadius: 0.9,
  interactionForce: 2.6,
  damping: 2.4,
  spring: 3.2,
  motionAmount: reducedMotion ? 0 : 1,
  autoRotate: reducedMotion ? 0 : 1,
  glow: 0.6,
  filamentBrightness: 1,
  hairSpread: 1,
  streamSpeed: 1,
  grain: reducedMotion ? 0 : 1,
};
export type Settings = typeof DEFAULT_SETTINGS;
export const settings: Settings = { ...DEFAULT_SETTINGS };

const settingsListeners = new Set<() => void>();
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  settings[k] = v;
  settingsListeners.forEach((l) => l());
}
export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
  settingsListeners.forEach((l) => l());
}
export function onSettings(l: () => void) {
  settingsListeners.add(l);
  return () => {
    settingsListeners.delete(l);
  };
}

export const pointer = {
  inside: false,
  down: false,
  x: 0, // css px
  y: 0,
  presence: 0,
  dragDist: 0,
};

export const intro = {
  t: 0,
  speed: Number(new URLSearchParams(window.location.search).get('introSpeed')) || 1,
  running: true,
};
export function skipIntro() {
  intro.t = introEnd();
  intro.running = false;
}
export function replayIntro() {
  intro.t = 0;
  intro.running = true;
}
if (reducedMotion) skipIntro();

export const fx = {
  rippleAt: -100, // realTime when nucleus was touched
  resetCameraAt: 0, // bump to request a camera reset
  zoomBy: 1, // multiply camera distance on the next frame (zoom buttons)
  hoverIndex: -1,
};
