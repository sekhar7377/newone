import { noiseGLSL } from './noise.glsl';
import { fogUniformsGLSL, fogGLSL } from './fog.glsl';

/** Sky dome that blends into the fog colour at the horizon. Stars, moon/sun disc, drifting cloud bands, lightning. */
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
  gl_Position.z = gl_Position.w * 0.99999; // always behind everything
}
`;
export const skyFrag = /* glsl */ `
${fogUniformsGLSL}
uniform vec3 uSkyTop, uSkyHorizon, uCloudColor;
uniform float uStars, uMoon, uMoonSize, uClouds;
varying vec3 vDir;
${noiseGLSL}
${fogGLSL}
void main() {
  vec3 rd = normalize(vDir);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(smoothstep(0.0, 0.7, rd.y), 0.8));
  vec3 col = mix(fogColor(rd), sky, smoothstep(0.02, 0.3, rd.y));
  // stars
  if (uStars > 0.0 && rd.y > 0.0) {
    vec3 c = floor(rd * 260.0);
    float h = hash21(c.xy + c.z * 13.7);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + h * 50.0);
    col += vec3(0.9, 0.92, 1.0) * step(0.9975, h) * uStars * tw * smoothstep(0.05, 0.4, rd.y);
  }
  // moon / sun
  float d = dot(rd, uLightDir);
  float disc = smoothstep(1.0 - uMoonSize, 1.0 - uMoonSize * 0.7, d);
  col += uLightColor * (disc * 1.6 + pow(max(d, 0.0), 180.0) * 0.6) * uMoon;
  // cloud bands
  if (uClouds > 0.0) {
    vec2 p = rd.xz / max(rd.y + 0.12, 0.05) * 1.4 + uTime * vec2(0.008, 0.003);
    float n = fbm2(p, 4);
    float cl = smoothstep(0.45, 0.8, n) * smoothstep(-0.02, 0.25, rd.y) * uClouds;
    vec3 cc = uCloudColor + uLightColor * pow(max(d, 0.0), 6.0) * 0.6 + uFlash * vec3(0.7, 0.8, 0.75) * 1.5;
    col = mix(col, cc, cl);
  }
  col += uFlash * vec3(0.25, 0.3, 0.28);
  gl_FragColor = vec4(col, 1.0);
}
`;
