import { noiseGLSL } from './noise.glsl';
import { fogUniformsGLSL, fogGLSL } from './fog.glsl';
import { flagSwayGLSL } from './flagSway.glsl';

/**
 * Silhouette shading for position-only meshes: the face normal comes from
 * screen-space derivatives, colour from a height gradient, plus a rim light so
 * shapes read against the fog. No textures, no UVs, no normals in the data.
 * Defines: FLAG (banner sway), SWAY (gentle foliage sway), BOB (boats on water),
 * FLOAT (floating candles, in step with their flames).
 */
export const silhouetteVert = /* glsl */ `
uniform float uTime;
${flagSwayGLSL}
#ifdef USE_INSTANCING
attribute float aSeed;
#endif
varying vec3 vWorld;
void main() {
  vec3 pos = position;
  float seed = 0.0;
#ifdef USE_INSTANCING
  seed = aSeed;
#endif
#ifdef FLAG
  pos = flagSway(pos, seed);
#endif
  vec4 p = vec4(pos, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  vec4 w = modelMatrix * p;
#ifdef SWAY
  float bend = max(pos.y, 0.0) * 0.012;
  w.x += sin(uTime * 0.7 + w.z * 0.03 + seed * 6.28) * bend;
  w.z += cos(uTime * 0.53 + w.x * 0.03 + seed * 6.28) * bend * 0.6;
#endif
#ifdef BOB
  float ph = seed * 6.28 + w.x * 0.1;
  w.y += sin(uTime * 1.1 + ph) * 0.08 + (pos.z) * sin(uTime * 0.9 + ph) * 0.03;
#endif
#ifdef FLOAT
  w.y += sin(uTime * 0.55 + seed * 40.0) * 0.45; // matches the FLOAT bob in windowGlow
#endif
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const silhouetteFrag = /* glsl */ `
${fogUniformsGLSL}
uniform vec3 uBaseLow, uBaseHigh, uRim, uSnowColor;
uniform float uHeightMin, uHeightRange, uRimPower, uSnow;
varying vec3 vWorld;
${noiseGLSL}
${fogGLSL}
void main() {
  vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  float h = clamp((vWorld.y - uHeightMin) / uHeightRange, 0.0, 1.0);
  vec3 col = mix(uBaseLow, uBaseHigh, h);
  float key = clamp(dot(N, uLightDir) * 0.5 + 0.5, 0.0, 1.0);
  col *= 0.55 + key * 0.7;
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
  col += uRim * rim * (0.3 + 0.7 * key);
  col = mix(col, uSnowColor, uSnow * smoothstep(0.55, 0.85, N.y));
  col += uFlash * 0.25 * key;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}
`;
