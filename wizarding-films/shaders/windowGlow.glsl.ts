import { noiseGLSL } from './noise.glsl';
import { fogUniformsGLSL, fogGLSL } from './fog.glsl';
import { candleFlickerGLSL } from './candleFlicker.glsl';

/**
 * Glow without bloom. A unit quad per instance is inflated in the vertex
 * shader so it covers the window plus a halo, and the fragment shader draws a
 * soft rounded-rectangle core with an exponential falloff, blended
 * additively.
 *  - WINDOW: oriented by the instance; fades out as the view grows edge-on
 *    (dot of view direction and the window normal) so the flat plane never shows.
 *  - FLAME: camera-facing teardrop with candle flicker.
 *  - BEAM: cylindrical billboard (vertical light shafts above waypoints).
 *  - FLOAT: slow vertical bob for floating candles.
 */
export const glowVert = /* glsl */ `
uniform float uTime, uInflate;
attribute float aSeed;
varying vec2 vP;
varying float vFade, vFlick;
varying vec3 vWorld;
${noiseGLSL}
${candleFlickerGLSL}
void main() {
  vec3 local = position * (1.0 + uInflate);
  vP = local.xy;
  mat4 im = instanceMatrix;
  vec3 center = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 sx = mat3(modelMatrix) * im[0].xyz, sy = mat3(modelMatrix) * im[1].xyz;
  float flick = 1.0;
#if defined(FLAME) || defined(FLICKER)
  flick = candleFlicker(aSeed);
#endif
#ifdef FLOAT
  center.y += sin(uTime * 0.55 + aSeed * 40.0) * 0.45;
#endif
  vec3 world;
#if defined(FLAME)
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float stretch = 0.85 + 0.3 * flick;
  world = center + right * local.x * length(sx) + up * (local.y + 0.15) * length(sy) * stretch;
  vFade = 1.0;
#elif defined(BEAM)
  vec3 toCam = normalize(cameraPosition - center);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  world = center + right * local.x * length(sx) + vec3(0.0, 1.0, 0.0) * local.y * length(sy);
  vFade = 1.0;
#else
  world = (modelMatrix * im * vec4(local, 1.0)).xyz;
  vec3 n = normalize(mat3(modelMatrix * im) * vec3(0.0, 0.0, 1.0));
  vec3 v = normalize(cameraPosition - center);
  vFade = smoothstep(0.04, 0.4, dot(n, v));
#endif
  vFlick = flick;
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const glowFrag = /* glsl */ `
${fogUniformsGLSL}
uniform vec3 uGlowColor;
uniform float uIntensity, uInflate, uHalo;
varying vec2 vP;
varying float vFade, vFlick;
varying vec3 vWorld;
${noiseGLSL}
${fogGLSL}
void main() {
  float core, halo;
#if defined(FLAME)
  vec2 q = vP * vec2(1.0, 0.62);
  float d = length(q);
  core = smoothstep(0.22, 0.02, d);
  halo = exp(-d * 5.0) * 0.7;
#elif defined(BEAM)
  float x = abs(vP.x) * 2.0;
  float y = vP.y + 0.5;
  core = exp(-x * x * 18.0) * smoothstep(1.0, 0.0, y) * smoothstep(-0.02, 0.1, y);
  halo = exp(-x * 4.0) * 0.25 * smoothstep(1.0, 0.0, y);
#else
  // rounded rectangle with an arched top, in quad units (core spans ±0.5)
  vec2 q = vP; float r = 0.18;
  vec2 b = abs(q) - vec2(0.5 - r);
  float d = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - r;
  float arch = q.y > 0.2 ? length(vec2(q.x, (q.y - 0.2) * 1.4)) - 0.5 : -1.0;
  d = max(d, arch);
  core = smoothstep(0.02, -0.03, d);
  // mullion cross for a little structure at close range
  core *= 1.0 - 0.55 * (smoothstep(0.035, 0.0, abs(q.x)) + smoothstep(0.03, 0.0, abs(q.y + 0.05)));
  halo = exp(-max(d, 0.0) * uHalo) * 0.55 * step(0.0, d);
#endif
  vec3 rd; float f = fogAmount(vWorld, rd);
  float a = (core * 1.1 + halo) * vFlick * vFade * uIntensity;
  // glow survives the fog a little better than geometry: it scatters
  vec3 col = uGlowColor * a * (1.0 - f * 0.82);
  if (a < 0.002) discard;
  gl_FragColor = vec4(col, 1.0);
}
`;
