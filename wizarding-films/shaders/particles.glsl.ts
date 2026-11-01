import { noiseGLSL } from './noise.glsl';
import { fogUniformsGLSL, fogGLSL } from './fog.glsl';

/**
 * GPU particles: every position is a pure function of a per-particle seed and
 * time, evaluated in the vertex shader. No CPU updates, ever.
 *  - default mode: a box of particles wrapped around the camera (snow, dust,
 *    rain, embers, fireflies), drifting with uVelocity plus turbulence.
 *  - COLUMNS: particles rise from up to 6 source points and expand (smoke).
 */
export const particlesVert = /* glsl */ `
uniform float uTime, uSize, uTurb, uPixelRatio, uLife, uRise, uFlickerParticles;
uniform vec3 uVelocity, uBox;
#ifdef COLUMNS
uniform vec3 uSources[6]; uniform float uSourceCount;
#endif
attribute vec4 aSeed4;
varying float vAlpha; varying vec3 vWorld;
void main() {
  vec3 p;
  float alpha = 1.0, size = uSize * (0.6 + aSeed4.w * 0.8);
#ifdef COLUMNS
  float life = fract(uTime / uLife + aSeed4.w);
  int idx = int(mod(floor(aSeed4.x * 97.0), uSourceCount));
  vec3 src = uSources[0];
  for (int i = 1; i < 6; i++) if (i == idx) src = uSources[i];
  float spread = 2.0 + life * 22.0;
  p = src + vec3((aSeed4.y - 0.5) * spread + life * 18.0, life * uRise, (aSeed4.z - 0.5) * spread);
  p.x += sin(uTime * 0.3 + aSeed4.w * 20.0) * life * 6.0;
  size *= 1.0 + life * 5.0;
  alpha = smoothstep(0.0, 0.08, life) * (1.0 - life);
#else
  p = aSeed4.xyz * uBox + uVelocity * uTime * (0.6 + aSeed4.w * 0.8);
  p.x += sin(uTime * 0.6 + aSeed4.w * 31.0) * uTurb;
  p.z += cos(uTime * 0.47 + aSeed4.w * 17.0) * uTurb;
  p.y += sin(uTime * 0.31 + aSeed4.w * 11.0) * uTurb * 0.5;
  vec3 c = cameraPosition;
  p = mod(p - c + uBox * 0.5, uBox) - uBox * 0.5 + c; // wrap around the camera
  vec3 e = abs(p - c) / (uBox * 0.5);
  alpha = 1.0 - smoothstep(0.7, 1.0, max(e.x, max(e.y, e.z)));
  if (uFlickerParticles > 0.0) alpha *= 0.4 + 0.6 * pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed4.w * 3.0) + aSeed4.x * 60.0), 3.0);
#endif
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vWorld = p; vAlpha = alpha;
  gl_PointSize = min(size * uPixelRatio * (220.0 / max(-mv.z, 0.5)), 18.0 * uPixelRatio);
  vAlpha *= smoothstep(1.0, 6.0, -mv.z); // fade out particles right at the lens
  gl_Position = projectionMatrix * mv;
}
`;
export const particlesFrag = /* glsl */ `
${fogUniformsGLSL}
uniform vec3 uColor; uniform float uOpacity, uSoft;
varying float vAlpha; varying vec3 vWorld;
${noiseGLSL}
${fogGLSL}
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = dot(q, q);
  if (d > 1.0) discard;
  float a = pow(1.0 - d, uSoft) * vAlpha * uOpacity;
  vec3 rd; float f = fogAmount(vWorld, rd);
#ifdef ADDITIVE
  gl_FragColor = vec4(uColor * a * (1.0 - f * 0.85), 1.0);
#else
  gl_FragColor = vec4(mix(uColor, fogColor(rd), f), a);
#endif
}
`;
