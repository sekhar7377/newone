export type Tier = 'low' | 'medium' | 'high';
export interface Quality {
  tier: Tier;
  pixelRatio: number;
  instanceFraction: number; // share of scattered instances drawn
  mistOctaves: 1 | 2 | 3;   // "fog steps"
  post: boolean;            // vignette / grain / chromatic edge pass
  particles: number;
  terrain: 'hi' | 'lo';
  antialias: boolean;
  isMobile: boolean;
  gpu?: string;
}

export function qualityFor(tier: Tier, isMobile: boolean, dpr: number): Quality {
  const cap = isMobile ? 1.5 : 2;
  switch (tier) {
    case 'high': return { tier, isMobile, pixelRatio: Math.min(dpr, cap), instanceFraction: 1, mistOctaves: 3, post: !isMobile, particles: 3000, terrain: 'hi', antialias: true };
    case 'medium': return { tier, isMobile, pixelRatio: Math.min(dpr, isMobile ? 1.5 : 1.75), instanceFraction: 0.6, mistOctaves: 2, post: false, particles: 1400, terrain: isMobile ? 'lo' : 'hi', antialias: !isMobile };
    default: return { tier: 'low', isMobile, pixelRatio: Math.min(dpr, 1.25), instanceFraction: 0.35, mistOctaves: 1, post: false, particles: 500, terrain: 'lo', antialias: false };
  }
}
