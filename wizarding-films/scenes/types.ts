import type { PerspectiveCamera, Vector3 } from 'three';
import type { SceneBuilder } from '@/lib/engine/builder';
import type { SceneContent, SceneId } from '@/lib/content';

export interface SceneHooks {
  update?: (time: number, dt: number, camera: PerspectiveCamera, progress: number) => void;
  /** Hub only: glowing waypoints, one per film. */
  waypoints?: { id: SceneId; position: Vector3 }[];
  /** Optional one-shot camera moves (hub intro fly-in, film 8 outro). */
  intro?: { points: [number, number, number][]; look: [number, number, number][]; duration: number };
  outro?: { points: [number, number, number][]; look: [number, number, number][]; duration: number };
  /** Lightning etc. can ask for a thunder rumble. */
  events?: { onThunder?: (cb: (strength: number) => void) => void };
}

export interface SceneModule {
  build: (b: SceneBuilder, content: SceneContent) => Promise<SceneHooks>;
}
