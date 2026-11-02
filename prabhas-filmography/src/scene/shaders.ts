import * as THREE from 'three';
import { CP, MAX_REACH, NUCLEUS_R } from '../layout/strands';

/** Ember core → gold → pale gold → steel → midnight blue, by distance from the nucleus. */
export const HEAT_STOPS: { at: number; color: string }[] = [
  { at: 0, color: '#ff5a00' },
  { at: 0.1, color: '#ff8f1f' },
  { at: 0.22, color: '#ffc46b' },
  { at: 0.36, color: '#f7e6c4' },
  { at: 0.55, color: '#c9b48e' },
  { at: 0.75, color: '#7f9bb8' },
  { at: 1, color: '#2f4f78' },
];

export const heatUniforms = () => ({
  uStopColor: { value: HEAT_STOPS.map((s) => new THREE.Color(s.color)) },
  uStopAt: { value: HEAT_STOPS.map((s) => s.at) },
});

const HEAT = /* glsl */ `
  #define STOPS ${HEAT_STOPS.length}
  uniform vec3 uStopColor[STOPS];
  uniform float uStopAt[STOPS];
  vec3 heat(float d) {
    d = clamp(d, 0.0, 1.0);
    vec3 c = uStopColor[0];
    for (int i = 1; i < STOPS; i++) c = mix(c, uStopColor[i], smoothstep(uStopAt[i - 1], uStopAt[i], d));
    return c;
  }
`;

/**
 * Shared spline code. uPoints: CP x N texture of animated control points.
 * uInfo: 4 x N texture
 *   col0 phase, brightness, rand, speed
 *   col1 glint, pulse, isBranch, energy
 *   col2 growStart, growDur, width, 0
 *   col3 visibility (filters/selection), highlight (hover/selected), 0, 0
 */
const SPLINE = /* glsl */ `
  #define CP ${CP}
  uniform sampler2D uPoints;
  uniform sampler2D uInfo;
  uniform float uTime;
  uniform float uIntro;
  uniform float uHairSpread;
  uniform float uStream;

  vec4 info(int col, int row) { return texelFetch(uInfo, ivec2(col, row), 0); }

  float growth(int row) {
    vec4 g = info(2, row);
    float k = clamp((uIntro - g.x) / g.y, 0.0, 1.0);
    return 1.0 - pow(1.0 - k, 1.6);
  }

  vec3 cp(int i, int row) { return texelFetch(uPoints, ivec2(clamp(i, 0, CP - 1), row), 0).xyz; }

  vec3 catmull(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
    float t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3);
  }

  vec3 spine(float u, int row) {
    float f = clamp(u, 0.0, 1.0) * float(CP - 1);
    int i = min(int(floor(f)), CP - 2);
    float t = f - float(i);
    vec3 p1 = cp(i, row), p2 = cp(i + 1, row);
    vec3 p0 = i == 0 ? 2.0 * p1 - p2 : cp(i - 1, row);
    vec3 p3 = i + 2 > CP - 1 ? 2.0 * p2 - p1 : cp(i + 2, row);
    return catmull(p0, p1, p2, p3, t);
  }

  // A strand is a primary fibre plus fine hairs that fan out toward the tip.
  vec3 fibre(float u, int row, float kind, vec4 hs, out vec3 tangent) {
    vec3 p = spine(u, row);
    tangent = normalize(spine(min(u + 0.012, 1.0), row) - spine(max(u - 0.012, 0.0), row));
    if (kind > 0.5) {
      float ph = info(0, row).x + hs.w * 40.0;
      vec3 h = hs.xyz + 0.45 * vec3(
        sin(uTime * 0.31 + ph + u * 2.3),
        sin(uTime * 0.27 + ph * 1.7 + u * 1.9),
        sin(uTime * 0.23 + ph * 2.3 + u * 2.7));
      h -= tangent * dot(h, tangent);
      p += h * uHairSpread * pow(smoothstep(0.0, 1.0, u), 1.15) * 0.55;
    }
    return p;
  }
`;

const RIBBON_VS = /* glsl */ `
  ${SPLINE}
  attribute vec4 aMeta; // row, u, side, kind
  attribute vec4 aHair;
  uniform float uPixelScale;
  varying float vU, vSide, vDist, vAlpha, vKind, vGrow;
  varying vec4 vI0, vI1, vI3;
  void main() {
    int row = int(aMeta.x + 0.5);
    float kind = aMeta.w;
    float u = aMeta.y * (kind > 0.5 ? mix(0.72, 1.0, aHair.w) : 1.0);
    vec3 tangent;
    vec3 p = fibre(u, row, kind, aHair, tangent);
    vec3 toCam = cameraPosition - p;
    float camDist = length(toCam);
    vec3 side = normalize(cross(tangent, toCam / camDist));
    vec4 i2 = info(2, row);
    vI3 = info(3, row);
    float wanted = mix(0.012, 0.0028, pow(aMeta.y, 0.7)) * (kind > 0.5 ? 0.5 : 1.0) * i2.z * (1.0 + vI3.y * 0.6);
    float w = max(wanted, camDist * uPixelScale * 0.85);
    vAlpha = wanted / w;
    p += side * aMeta.z * w;
    vU = aMeta.y; vSide = aMeta.z; vKind = kind;
    vDist = (length(p) - ${NUCLEUS_R.toFixed(3)}) / (${MAX_REACH.toFixed(3)} - ${NUCLEUS_R.toFixed(3)});
    vI0 = info(0, row); vI1 = info(1, row);
    vGrow = growth(row);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const RIBBON_FS = /* glsl */ `
  ${HEAT}
  uniform float uTime, uBrightness, uRipple;
  varying float vU, vSide, vDist, vAlpha, vKind, vGrow;
  varying vec4 vI0, vI1, vI3;
  void main() {
    if (vGrow <= 0.0) discard;
    float grown = 1.0 - smoothstep(vGrow - 0.035, vGrow, vU);
    float front = vGrow < 0.999 ? exp(-pow((vGrow - vU) * 22.0, 2.0)) * 2.2 : 0.0;
    float edge = 1.0 - vSide * vSide;
    float fadeIn = vKind > 0.5 ? smoothstep(0.03, 0.32, vU) : smoothstep(0.0, mix(0.06, 0.25, vI1.z), vU);
    float tip = 1.0 - smoothstep(0.7, 1.0, vU) * 0.75;
    vec3 col = heat(vDist) * (1.0 + 1.1 * (1.0 - smoothstep(0.0, 0.3, vDist)));
    // light travelling outward along the strand
    float x = fract(vU * 0.9 - uTime * 0.045 * vI0.w + vI0.z * 7.0);
    float glint = exp(-pow((x - 0.5) * 38.0, 2.0)) * 1.6 * vI1.x;
    // unreleased work: a faster second pulse and a slow breath
    float x2 = fract(vU * 1.6 - uTime * 0.11 + vI0.z * 3.0);
    glint += exp(-pow((x2 - 0.5) * 30.0, 2.0)) * 1.4 * step(0.01, vI1.y);
    float breathe = 1.0 + vI1.y * sin(uTime * 0.9 + vI0.x);
    float ripple = exp(-pow((vU - uRipple * 0.55) * 7.0, 2.0)) * exp(-uRipple * 0.6) * 2.5;
    float hl = vI3.y;
    float a = edge * fadeIn * tip * vAlpha * vI0.y * uBrightness * breathe * vI3.x * (1.0 + hl * 0.9);
    a *= (vKind > 0.5 ? 0.42 : 0.9) * grown;
    col = mix(col, vec3(1.0, 0.86, 0.6), hl * 0.25);
    gl_FragColor = vec4(col * (1.0 + glint + ripple + front + hl * 0.6), a);
  }
`;

const POINTS_VS = /* glsl */ `
  ${SPLINE}
  attribute vec4 aMeta; // row, u (negative = travelling bead), size, kind
  attribute vec4 aHair;
  uniform float uPixelScale;
  varying float vDist, vAlpha;
  void main() {
    int row = int(aMeta.x + 0.5);
    vec4 i0 = info(0, row), i1 = info(1, row), i3 = info(3, row);
    float kind = aMeta.w, u, alpha = 1.0;
    float g = growth(row);
    if (aMeta.y < 0.0) {
      // hair beads stream a little faster and vary per hair
      float spd = kind > 0.5 ? mix(0.022, 0.04, aHair.w) : 0.018;
      u = fract(-aMeta.y + uTime * spd * i0.w * uStream);
      alpha = smoothstep(0.05, 0.2, u) * (1.0 - smoothstep(0.75, 0.98, u)) * 0.8 * min(1.0, i1.x);
      alpha *= smoothstep(u, u + 0.05, g);
    } else {
      u = aMeta.y * (kind > 0.5 ? mix(0.72, 1.0, aHair.w) : 1.0);
      alpha *= smoothstep(0.9, 1.0, g);
    }
    vec3 tangent;
    vec3 p = fibre(u, row, kind, aHair, tangent);
    float camDist = length(cameraPosition - p);
    float px = aMeta.z * (1.0 + i3.y * (kind > 0.5 ? 0.3 : 1.2)) / (camDist * uPixelScale);
    gl_PointSize = clamp(px, 1.5, 44.0);
    vAlpha = alpha * i0.y * i3.x * min(1.0, px / 1.5) * (1.0 + i3.y);
    vDist = (length(p) - ${NUCLEUS_R.toFixed(3)}) / (${MAX_REACH.toFixed(3)} - ${NUCLEUS_R.toFixed(3)});
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const POINTS_FS = /* glsl */ `
  ${HEAT}
  uniform float uBrightness;
  varying float vDist, vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (smoothstep(0.55, 0.0, r) + exp(-r * r * 5.0) * 0.35) * vAlpha * uBrightness;
    if (a < 0.002) discard;
    gl_FragColor = vec4(mix(heat(vDist), vec3(1.0), 0.35) * 1.4, a);
  }
`;

function common(points: THREE.Texture, infoTex: THREE.Texture) {
  return {
    ...heatUniforms(),
    uPoints: { value: points },
    uInfo: { value: infoTex },
    uTime: { value: 0 },
    uIntro: { value: 1e4 },
    uHairSpread: { value: 1 },
    uPixelScale: { value: 0.001 },
    uBrightness: { value: 1 },
    uStream: { value: 1 },
  };
}

export function ribbonMaterial(points: THREE.Texture, infoTex: THREE.Texture) {
  return new THREE.ShaderMaterial({
    vertexShader: RIBBON_VS,
    fragmentShader: RIBBON_FS,
    uniforms: { ...common(points, infoTex), uRipple: { value: 100 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function pointsMaterial(points: THREE.Texture, infoTex: THREE.Texture) {
  return new THREE.ShaderMaterial({
    vertexShader: POINTS_VS,
    fragmentShader: POINTS_FS,
    uniforms: common(points, infoTex),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
