import { qualityFor, type Quality, type Tier } from './quality';

/**
 * Detect a quality tier on load. detect-gpu (lazy-loaded, benchmarks served
 * from /benchmarks so there's no third-party request) gives a GPU tier; we fall
 * back to cheap heuristics if it fails or takes too long. `?quality=low|medium|high`
 * overrides everything.
 */
export async function detectQuality(): Promise<Quality> {
  const dpr = window.devicePixelRatio || 1;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
  const forced = new URLSearchParams(location.search).get('quality') as Tier | null;
  if (forced === 'low' || forced === 'medium' || forced === 'high') return qualityFor(forced, isMobile, dpr);

  let tier: Tier = heuristicTier(isMobile);
  let gpu: string | undefined;
  try {
    const { getGPUTier } = await import('detect-gpu');
    const res = await Promise.race([
      getGPUTier({ benchmarksURL: '/benchmarks' }),
      new Promise<null>((r) => setTimeout(() => r(null), 1800)),
    ]);
    if (res) {
      gpu = res.gpu;
      if (res.type === 'BLOCKLISTED' || res.type === 'WEBGL_UNSUPPORTED') tier = 'low';
      else if (res.tier >= 3) tier = isMobile ? 'medium' : 'high';
      else if (res.tier === 2) tier = 'medium';
      else tier = 'low';
      // Software renderers (SwiftShader, llvmpipe) report a tier but can't keep up.
      if (/swiftshader|llvmpipe|software/i.test(res.gpu ?? '')) tier = 'low';
    }
  } catch { /* heuristics already chosen */ }
  return { ...qualityFor(tier, isMobile, dpr), gpu };
}

function heuristicTier(isMobile: boolean): Tier {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (isMobile) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  return cores >= 8 && mem >= 8 ? 'high' : 'medium';
}

export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}
