/**
 * Banner / flag sway, done entirely in the vertex shader. The banner mesh has
 * the pole at local x=0 and the free edge at x=1, so displacement grows with
 * x². The phase comes from the instance's world position (and seed) so no two
 * banners flap in sync.
 */
export const flagSwayGLSL = /* glsl */ `
uniform float uFlagSpeed, uFlagFreq, uFlagAmp;
vec3 flagSway(vec3 p, float seed) {
#ifdef USE_INSTANCING
  vec3 anchor = instanceMatrix[3].xyz;
#else
  vec3 anchor = vec3(0.0);
#endif
  float phase = dot(anchor, vec3(0.173, 0.071, 0.119)) + seed * 6.2831;
  float along = clamp(p.x, 0.0, 1.0);
  float a2 = along * along;
  float wave = sin(uTime * uFlagSpeed - along * uFlagFreq + phase);
  float gust = 0.75 + 0.25 * sin(uTime * 0.37 + phase * 1.7);
  p.z += wave * a2 * uFlagAmp * gust;
  p.y += sin(uTime * uFlagSpeed * 0.63 - along * 2.7 + phase) * a2 * uFlagAmp * 0.25;
  p.x -= a2 * abs(wave) * uFlagAmp * 0.12; // the free edge pulls in as it billows
  return p;
}
`;
