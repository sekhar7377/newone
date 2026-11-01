/**
 * Exponential height fog with a per-scene vertical colour gradient, a soft
 * glow toward the key light (moon / sun / fire), a slow animated mist layer,
 * an optional local fire glow and a lightning flash term.
 *
 * Fog density integrates a*exp(-b*(y - base)) along the view ray
 * (analytic, so it costs a handful of ALU ops per fragment).
 * MIST_OCTAVES is set from the quality tier ("fog steps").
 */
export const fogUniformsGLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uFogLow, uFogHigh, uLightDir, uLightColor;
uniform float uFogDensity, uFogFalloff, uFogBase, uMistStrength, uFlash;
uniform vec4 uFire; uniform vec3 uFireColor;
`;

export const fogGLSL = /* glsl */ `
#ifndef MIST_OCTAVES
#define MIST_OCTAVES 2
#endif
vec3 fogColor(vec3 rd) {
  vec3 c = mix(uFogLow, uFogHigh, smoothstep(-0.05, 0.45, rd.y));
  float g = max(dot(rd, uLightDir), 0.0);
  c += uLightColor * (pow(g, 6.0) * 0.35 + pow(g, 48.0) * 0.5);
  c += uFlash * vec3(0.55, 0.65, 0.6);
  return c;
}
float fogAmount(vec3 wpos, out vec3 rd) {
  vec3 d = wpos - cameraPosition; float dist = max(length(d), 1e-3); rd = d / dist;
  float b = uFogFalloff, h0 = cameraPosition.y - uFogBase;
  float k = rd.y * b;
  float fog = abs(k) > 1e-4 ? uFogDensity * exp(-h0 * b) * (1.0 - exp(-dist * k)) / k : uFogDensity * exp(-h0 * b) * dist;
  float mist = fbm2(wpos.xz * 0.011 + uTime * vec2(0.012, 0.005), MIST_OCTAVES);
  fog *= mix(1.0, 0.25 + mist * 1.6, uMistStrength);
  return 1.0 - exp(-max(fog, 0.0));
}
vec3 fireTint(vec3 wpos) {
  float d = length(wpos - uFire.xyz);
  return uFireColor * uFire.w / (1.0 + d * d * 0.0004);
}
vec3 applyFog(vec3 col, vec3 wpos) {
  vec3 rd; float f = fogAmount(wpos, rd);
  vec3 fc = fogColor(rd) + fireTint(wpos) * 0.6;
  return mix(col + fireTint(wpos) * 0.25, fc, clamp(f, 0.0, 1.0));
}
`;
