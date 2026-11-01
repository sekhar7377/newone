/** High tier only: subtle vignette, film grain and chromatic edge in one pass. */
export const postVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const postFrag = /* glsl */ `
uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uChroma;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 c = vUv - 0.5;
  float e = dot(c, c);
  vec2 off = c * e * uChroma;
  vec3 col = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
  col *= 1.0 - smoothstep(0.12, 0.75, e) * uVignette;
  col += (h(vUv * 917.0 + fract(uTime) * 37.0) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
`;
