import { noiseGLSL } from './noise.glsl';
import { fogUniformsGLSL, fogGLSL } from './fog.glsl';

/**
 * Cheap stylised water: two scrolling noise layers give a perturbed normal,
 * the reflection is the fog/sky gradient evaluated along the reflected ray
 * (no reflection pass), plus a stretched specular streak from the key light.
 * The same shader does ice (low waves, pale) and polished stone floors.
 */
export const waterVert = /* glsl */ `
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
export const waterFrag = /* glsl */ `
${fogUniformsGLSL}
uniform vec3 uDeep, uSkyTop;
uniform float uWave, uScale, uSpec, uCracks;
varying vec3 vWorld;
${noiseGLSL}
${fogGLSL}
vec2 grad(vec2 p) {
  float e = 0.35; float c = vnoise(p);
  return vec2(vnoise(p + vec2(e, 0.0)) - c, vnoise(p + vec2(0.0, e)) - c) / e;
}
void main() {
  vec2 uv = vWorld.xz * uScale;
  vec2 g = grad(uv * 0.08 + uTime * vec2(0.02, 0.03)) + 0.5 * grad(uv * 0.23 - uTime * vec2(0.035, 0.012));
  vec3 N = normalize(vec3(g.x * uWave, 1.0, g.y * uWave));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  vec3 refl = mix(fogColor(R), uSkyTop, smoothstep(0.1, 0.8, R.y) * 0.5);
  float spec = pow(max(dot(R, uLightDir), 0.0), 220.0) * uSpec;
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col = mix(uDeep, refl, fres) + uLightColor * spec * 2.5;
  if (uCracks > 0.0) {
    float c = abs(vnoise(vWorld.xz * 0.15) - 0.5);
    col += vec3(0.6, 0.7, 0.75) * smoothstep(0.02, 0.0, c) * uCracks;
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}
`;
