import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Quality } from './quality';
import type { HotspotKind, SceneId } from './content';

export type Phase = 'boot' | 'intro' | 'hub' | 'film' | 'outro' | 'fallback';

export interface HotspotMeta { id: string; title: string; kind: HotspotKind; body: string; t: number; isNew: boolean; illustrationAlt?: string }
export interface CollectibleMeta { id: string; name: string; note: string }

export interface AppState {
  phase: Phase;
  sceneId: SceneId | null;
  loading: { active: boolean; progress: number; label: string };
  fadeColor: string; faded: boolean;
  titleCard: { kicker: string; title: string; sub: string } | null;
  quality: Quality | null;
  reducedMotion: boolean;
  audioOn: boolean;
  gyro: boolean;
  hotspots: HotspotMeta[];
  activeHotspot: string | null;
  nearHotspot: string | null;
  collectibles: CollectibleMeta[];
  found: Record<string, string[]>;
  endCard: boolean;
  hint: 'scroll' | 'look' | null;
  backwardLocked: boolean;
  hubHover: SceneId | null;
  contextLost: boolean;
  debug: boolean;
  stats: { fps: number; triangles: number; calls: number; sceneLoadMs: number; geometryKB: number };
  toast: string | null;
}

export const appStore = createStore<AppState>(() => ({
  phase: 'boot', sceneId: null,
  loading: { active: true, progress: 0, label: 'Preparing' },
  fadeColor: '#05070f', faded: true,
  titleCard: null, quality: null, reducedMotion: false, audioOn: false, gyro: false,
  hotspots: [], activeHotspot: null, nearHotspot: null, collectibles: [], found: {},
  endCard: false, hint: null, backwardLocked: false, hubHover: null, contextLost: false, debug: false,
  stats: { fps: 0, triangles: 0, calls: 0, sceneLoadMs: 0, geometryKB: 0 }, toast: null,
}));

export const useApp = <T,>(sel: (s: AppState) => T) => useStore(appStore, sel);

/** High-frequency camera progress lives apart so per-frame updates don't wake the main store. */
type FrameListener = (progress: number) => void;
const frameListeners = new Set<FrameListener>();
export const frame = {
  progress: 0,
  emit(p: number) { this.progress = p; frameListeners.forEach((l) => l(p)); },
  on(l: FrameListener) { frameListeners.add(l); return () => { frameListeners.delete(l); }; },
};
