// Self-host detect-gpu's benchmark data so tier detection makes no third-party request.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
const src = new URL('../node_modules/detect-gpu/dist/benchmarks/', import.meta.url).pathname;
const dst = new URL('../public/benchmarks/', import.meta.url).pathname;
if (existsSync(src)) { mkdirSync(dst, { recursive: true }); cpSync(src, dst, { recursive: true }); console.log('benchmarks copied'); }
else console.warn('detect-gpu benchmarks not found; tier detection will fall back to heuristics');
