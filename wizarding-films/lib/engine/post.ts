import { BufferAttribute, BufferGeometry, Mesh, OrthographicCamera, Scene, ShaderMaterial, WebGLRenderTarget, HalfFloatType, type WebGLRenderer, type Camera } from 'three';
import { postVert, postFrag } from '@/shaders/post.glsl';

/** Optional high-tier pass: one fullscreen triangle, vignette + grain + chromatic edge. MSAA lives on the target. */
export class Post {
  rt: WebGLRenderTarget; private scene = new Scene(); private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1); private mat: ShaderMaterial;
  constructor(w: number, h: number) {
    this.rt = new WebGLRenderTarget(w, h, { samples: 4, type: HalfFloatType });
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mat = new ShaderMaterial({ vertexShader: postVert, fragmentShader: postFrag, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: this.rt.texture }, uTime: { value: 0 }, uVignette: { value: 0.55 }, uGrain: { value: 0.035 }, uChroma: { value: 0.012 } } });
    const m = new Mesh(g, this.mat); m.frustumCulled = false; this.scene.add(m);
  }
  setSize(w: number, h: number) { this.rt.setSize(w, h); }
  render(r: WebGLRenderer, scene: Scene, camera: Camera, time: number) {
    r.setRenderTarget(this.rt); r.render(scene, camera);
    r.setRenderTarget(null); this.mat.uniforms.uTime.value = time; r.render(this.scene, this.cam);
  }
  dispose() { this.rt.dispose(); this.mat.dispose(); this.scene.traverse((o) => (o as Mesh).geometry?.dispose()); }
}
