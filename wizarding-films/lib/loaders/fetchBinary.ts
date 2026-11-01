/**
 * Fetches a geometry file. Every file ships pre-gzipped (`*.gz`) and is
 * inflated with the native DecompressionStream, so transfers stay compressed
 * even on hosts that don't compress application/octet-stream. If a proxy has
 * already decoded it (no gzip magic bytes), the bytes are used as they are.
 * Browsers without DecompressionStream fetch the uncompressed twin.
 */
const cache = new Map<string, Promise<ArrayBuffer>>();
export const GEO_BASE = '/geo/';
const VERSION = process.env.NEXT_PUBLIC_GEO_VERSION ?? 'dev';
export const stats = { bytes: 0, files: 0 };

export function fetchBinary(path: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const url = GEO_BASE + path;
  let p = cache.get(url);
  if (!p) {
    p = load(url, signal);
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

async function load(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (typeof DecompressionStream !== 'undefined') {
    const res = await fetch(`${url}.gz?v=${VERSION}`, { signal });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      stats.bytes += buf.byteLength; stats.files++;
      const b = new Uint8Array(buf, 0, 2);
      if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
      return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
  }
  const res = await fetch(`${url}?v=${VERSION}`, { signal });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  stats.bytes += buf.byteLength; stats.files++;
  return buf;
}

/** Drop decoded buffers once a scene has been disposed (the HTTP cache still has the files). */
export function forgetBinary(paths: string[]) {
  for (const p of paths) cache.delete(GEO_BASE + p);
}
