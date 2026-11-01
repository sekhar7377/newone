/** Per-instance flicker from a noise function of time and instance id. */
export const candleFlickerGLSL = /* glsl */ `
uniform float uFlickerSpeed, uFlickerAmount;
float candleFlicker(float seed) {
  float t = uTime * uFlickerSpeed;
  float n = vnoise(vec2(t, seed * 113.0)) * 0.65 + vnoise(vec2(t * 2.7, seed * 57.0 + 9.0)) * 0.35;
  return 1.0 - uFlickerAmount + uFlickerAmount * 2.0 * n;
}
`;
