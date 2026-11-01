/**
 * Hand-drawn line illustrations living in 3D. Each stroke is a ribbon built
 * from centreline points + a relative width per point (see lib/engine/
 * lineIllustration.ts). Expansion happens here, camera-facing, and so does the
 * "drawing in": uProgress runs 0→1 over the illustration's total stroke
 * length; vertices ahead of it collapse to zero width with a tapered pen tip.
 * A small sinusoidal wobble keeps the drawing alive.
 */
export const lineVert = /* glsl */ `
uniform float uTime, uProgress, uThickness, uWobble;
attribute vec3 aTangent;
attribute float aSide, aWidth, aDist;
varying float vSide, vDrawn, vDist;
void main() {
  vec3 p = position;
  float t = uTime;
  p += vec3(sin(t * 1.3 + aDist * 41.0), sin(t * 1.1 + aDist * 33.0 + 1.7), cos(t * 0.9 + aDist * 27.0)) * uWobble;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec3 tang = normalize(mat3(modelMatrix) * aTangent + 1e-5);
  vec3 v = normalize(cameraPosition - wp.xyz);
  vec3 side = normalize(cross(tang, v) + 1e-5);
  float ahead = uProgress - aDist;
  float drawn = smoothstep(-0.0005, 0.0005, ahead);
  float tip = smoothstep(0.0, 0.015, ahead) * 0.7 + 0.3;
  float w = aWidth * uThickness * drawn * tip;
  wp.xyz += side * aSide * w;
  vSide = aSide; vDrawn = drawn; vDist = aDist;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
export const lineFrag = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity, uProgress;
varying float vSide, vDrawn, vDist;
void main() {
  if (vDrawn < 0.01) discard;
  float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
  float head = 1.0 + 1.5 * smoothstep(0.02, 0.0, uProgress - vDist) * step(uProgress, 0.999);
  gl_FragColor = vec4(uColor * edge * uOpacity * head, 1.0);
}
`;
