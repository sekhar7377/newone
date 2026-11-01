import { noiseGLSL } from './noise.glsl';
import { fogUniformsGLSL, fogGLSL } from './fog.glsl';
import { candleFlickerGLSL } from './candleFlicker.glsl';

/** Glass prophecy orbs: fresnel-bright edges with a slow inner swirl, additive. */
export const orbVert = /* glsl */ `
uniform float uTime;
attribute float aSeed;
varying vec3 vWorld; varying float vSeed;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const orbFrag = /* glsl */ `
${fogUniformsGLSL}
uniform vec3 uGlowColor; uniform float uIntensity;
varying vec3 vWorld; varying float vSeed;
${noiseGLSL}
${candleFlickerGLSL}
${fogGLSL}
void main() {
  vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - abs(dot(N, V)), 2.0);
  float swirl = vnoise(vWorld.xy * 6.0 + uTime * 0.4 + vSeed * 30.0);
  float pulse = candleFlicker(vSeed);
  vec3 rd; float f = fogAmount(vWorld, rd);
  vec3 col = uGlowColor * (0.18 + fres * 0.9 + swirl * 0.25) * pulse * uIntensity * (1.0 - f * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`;
