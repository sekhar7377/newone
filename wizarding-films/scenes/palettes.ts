/**
 * One palette per film (plus the hub). Everything visual that changes between
 * films lives here: sky gradient, fog colours and density, key-light colour
 * and direction, silhouette tones, rim light, glow colour and particle type.
 * Colours are display values (no colour management), hex strings.
 */
export type ParticleKind = 'motes' | 'fireflies' | 'snow' | 'embers' | 'rain' | 'dust' | 'frost' | 'ash' | 'none';
export type Ambience = 'lake' | 'countryside' | 'bells' | 'fire' | 'hall' | 'storm' | 'winter' | 'dawn';

export interface Palette {
  skyTop: string; skyHorizon: string; fogLow: string; fogHigh: string;
  light: string; lightDir: [number, number, number]; moon: number; moonSize: number; stars: number; clouds: number; cloud: string;
  baseLow: string; baseHigh: string; rim: string; rimPower: number; snow: number; snowColor: string;
  glow: string; accent: string; water: string;
  fogDensity: number; fogFalloff: number; fogBase: number; mist: number;
  particles: ParticleKind; particleColor: string; ambience: Ambience;
  fire?: { pos: [number, number, number]; color: string; intensity: number };
  ui: { ink: string; accent: string };
}

const night = { moon: 1, moonSize: 0.0006, stars: 1, clouds: 0.35, rimPower: 3, snow: 0, snowColor: '#dfe6ee' };

export const PALETTES: Record<string, Palette> = {
  hub: { ...night, skyTop: '#060a1c', skyHorizon: '#1d2547', fogLow: '#1a2142', fogHigh: '#2c355e', light: '#f3d9a4', lightDir: [0.35, 0.32, -0.88], cloud: '#141a33',
    baseLow: '#0a0e1e', baseHigh: '#28304f', rim: '#7282c4', glow: '#ffbf5e', accent: '#e8b86a', water: '#070b1a',
    fogDensity: 0.0016, fogFalloff: 0.016, fogBase: 0, mist: 0.6, particles: 'motes', particleColor: '#ffd89a', ambience: 'lake', ui: { ink: '#f1e6cf', accent: '#e8b86a' } },
  // 1. warm candle-gold against deep navy night
  'film-1': { ...night, skyTop: '#030716', skyHorizon: '#16204a', fogLow: '#141c3d', fogHigh: '#25305c', light: '#ffd890', lightDir: [0.1, 0.22, -0.97], cloud: '#0e1430',
    baseLow: '#04060e', baseHigh: '#10162c', rim: '#4b5a99', glow: '#ffb84d', accent: '#f0b24a', water: '#050816',
    fogDensity: 0.0032, fogFalloff: 0.02, fogBase: 0, mist: 0.75, particles: 'fireflies', particleColor: '#ffc767', ambience: 'lake', ui: { ink: '#f4e7c8', accent: '#f0b24a' } },
  // 2. emerald and damp stone grey
  'film-2': { ...night, moon: 0.6, stars: 0.3, clouds: 0.55, skyTop: '#0d1a18', skyHorizon: '#3b4e47', fogLow: '#33443f', fogHigh: '#4c5f58', light: '#cfe8c8', lightDir: [-0.4, 0.35, -0.85], cloud: '#25332f',
    baseLow: '#0a110f', baseHigh: '#1f2b27', rim: '#6f9a83', glow: '#9df2b8', accent: '#3fbf7f', water: '#0f1a17',
    fogDensity: 0.0019, fogFalloff: 0.006, fogBase: 0, mist: 0.6, particles: 'motes', particleColor: '#bfe8cf', ambience: 'countryside', ui: { ink: '#e3efe6', accent: '#53c98e' } },
  // 3. cold blue-silver, mist, dementor frost
  'film-3': { ...night, clouds: 0.6, skyTop: '#0b1220', skyHorizon: '#5b6e86', fogLow: '#6d7f96', fogHigh: '#8798ae', light: '#e8f1ff', lightDir: [-0.3, 0.42, -0.86], cloud: '#3a4658',
    baseLow: '#0d131c', baseHigh: '#2a3546', rim: '#b9cce6', glow: '#cfe4ff', accent: '#a9c6ee', water: '#1a2433',
    fogDensity: 0.0045, fogFalloff: 0.024, fogBase: 0, mist: 1.0, particles: 'frost', particleColor: '#e8f2ff', ambience: 'bells', ui: { ink: '#eef3fa', accent: '#a9c6ee' } },
  // 4. fire orange against black lake teal
  'film-4': { ...night, stars: 0.6, skyTop: '#020607', skyHorizon: '#0c2a2c', fogLow: '#0c2627', fogHigh: '#163a3a', light: '#ff9a4a', lightDir: [0.55, 0.18, 0.82], cloud: '#081617',
    baseLow: '#020505', baseHigh: '#0b1a1a', rim: '#2f7a76', glow: '#ff8a2e', accent: '#ff7a1f', water: '#021314',
    fogDensity: 0.0028, fogFalloff: 0.015, fogBase: 0, mist: 0.7, particles: 'embers', particleColor: '#ff9c45', ambience: 'fire',
    fire: { pos: [430, 30, 120], color: '#ff6a1a', intensity: 0.9 }, ui: { ink: '#f6e3d2', accent: '#ff8a3d' } },
  // 5. ministry black, cold blue glass
  'film-5': { ...night, moon: 0, stars: 0, clouds: 0, skyTop: '#000102', skyHorizon: '#04070d', fogLow: '#050a14', fogHigh: '#02040a', light: '#7fb4ff', lightDir: [0, 1, 0], cloud: '#000000',
    baseLow: '#010205', baseHigh: '#0a1222', rim: '#3d6ed6', glow: '#8cc4ff', accent: '#6ea8ff', water: '#010309',
    fogDensity: 0.012, fogFalloff: 0.035, fogBase: 0, mist: 0.5, particles: 'dust', particleColor: '#9cc8ff', ambience: 'hall', ui: { ink: '#dfe9fb', accent: '#7fb2ff' } },
  // 6. sickly green-grey, storm light
  'film-6': { ...night, moon: 0.3, stars: 0, clouds: 1, skyTop: '#0b120d', skyHorizon: '#4c5a48', fogLow: '#3e4a3b', fogHigh: '#56634f', light: '#c6e3a6', lightDir: [0.3, 0.5, 0.81], cloud: '#1c241b',
    baseLow: '#070a07', baseHigh: '#1e261c', rim: '#8fae7a', glow: '#d4f08c', accent: '#a8cf5d', water: '#0e140d',
    fogDensity: 0.0026, fogFalloff: 0.009, fogBase: 0, mist: 0.8, particles: 'rain', particleColor: '#b8c9b0', ambience: 'storm', ui: { ink: '#e8eedf', accent: '#b5d672' } },
  // 7. desaturated forest, ash, winter
  'film-7': { ...night, moon: 0.4, stars: 0.15, clouds: 0.8, skyTop: '#2c3036', skyHorizon: '#8a8f94', fogLow: '#7b8084', fogHigh: '#8f9397', light: '#f2efe6', lightDir: [-0.5, 0.3, -0.81], cloud: '#5e6368',
    baseLow: '#15181b', baseHigh: '#3a3f44', rim: '#c9ced2', snow: 0.7, snowColor: '#c9cfd5', glow: '#ffc277', accent: '#d9d4c7', water: '#5b646b',
    fogDensity: 0.0052, fogFalloff: 0.02, fogBase: 0, mist: 0.9, particles: 'snow', particleColor: '#f4f6f8', ambience: 'winter', ui: { ink: '#f1efea', accent: '#d6cdb8' } },
  // 8. ember red, smoke and dawn
  'film-8': { ...night, moon: 1, moonSize: 0.004, stars: 0.05, clouds: 0.7, skyTop: '#251322', skyHorizon: '#e0794a', fogLow: '#8d4a3a', fogHigh: '#b56a4c', light: '#ffcf8a', lightDir: [0.85, 0.08, 0.52], cloud: '#3d1f22',
    baseLow: '#120707', baseHigh: '#2e1513', rim: '#ff9a62', glow: '#ff9045', accent: '#ff7a3d', water: '#2a1412',
    fogDensity: 0.0034, fogFalloff: 0.012, fogBase: 0, mist: 0.85, particles: 'embers', particleColor: '#ff8a3a', ambience: 'dawn', ui: { ink: '#fbe7d9', accent: '#ff9a5c' } },
};
