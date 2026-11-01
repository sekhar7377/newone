import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

// Geometry URLs carry a content hash so they can be cached forever.
const manifest = new URL('./public/geo/manifest.json', import.meta.url);
const geoVersion = existsSync(manifest) ? createHash('sha1').update(readFileSync(manifest)).digest('hex').slice(0, 10) : 'dev';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  env: { NEXT_PUBLIC_GEO_VERSION: geoVersion },
  async headers() {
    const forever = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
    return [
      { source: '/geo/:path*', headers: [...forever, { key: 'Content-Type', value: 'application/octet-stream' }] },
      { source: '/benchmarks/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
      { source: '/studio', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
};
export default nextConfig;
