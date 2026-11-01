/**
 * Hotspot runes, collectible glints and hub waypoints: camera-facing quads
 * drawn as a ring + diamond rune with a soft pulse. Per-instance aState packs
 * hover/near (x), "new" (y) and visibility (z), written by the CPU only when it
 * changes.
 */
export const runeVert = /* glsl */ `
uniform float uTime, uSize;
attribute vec3 aState; attribute float aSeed;
varying vec2 vP; varying vec3 vState; varying float vPulse;
void main() {
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float pulse = 0.5 + 0.5 * sin(uTime * 2.2 + aSeed * 6.28);
  float dist = length(cameraPosition - center);
  // grow when hovered or near; keep a minimum on-screen size so far runes stay clickable
  float s = uSize * (1.0 + aState.x * 0.6 + pulse * 0.08) * max(1.0, dist / 60.0) * aState.z;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 w = center + (right * position.x + up * position.y) * s;
  vP = position.xy * 2.0; vState = aState; vPulse = pulse;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
export const runeFrag = /* glsl */ `
uniform vec3 uColor, uNewColor; uniform float uShape;
varying vec2 vP; varying vec3 vState; varying float vPulse;
void main() {
  float r = length(vP);
  float ring = smoothstep(0.06, 0.0, abs(r - 0.55)) * (uShape < 0.5 ? 1.0 : 0.0);
  vec2 a = abs(vP);
  float diamond = smoothstep(0.05, 0.0, abs(a.x + a.y - 0.32));
  float star = uShape > 0.5 ? smoothstep(0.08, 0.0, min(a.x, a.y) * (1.0 + r * 6.0)) * smoothstep(0.9, 0.0, r) : 0.0;
  float core = smoothstep(0.16, 0.0, r);
  float halo = exp(-r * 3.2) * (0.35 + 0.25 * vPulse + vState.x * 0.4);
  vec3 col = mix(uColor, uNewColor, vState.y);
  float alpha = (ring + diamond + core + halo + star) * vState.z;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col * alpha, 1.0);
}
`;
