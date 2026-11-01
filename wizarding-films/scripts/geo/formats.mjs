// Writers for the two binary formats shared with the Blender exporter
// (tools/blender/export_silhouette.py) and the runtime loaders (lib/loaders).
//
// SIL1 — silhouette mesh, positions only
//   0  char[4]  'SIL1'
//   4  uint16   version (1)
//   6  uint16   flags  bit0: indices are uint32 (else uint16)
//                      bit1: positions are float32 (else int16 quantised to bbox)
//   8  uint32   vertexCount
//   12 uint32   indexCount
//   16 float32[3] bboxMin
//   28 float32[3] bboxMax
//   40 positions  (int16 x3 or float32 x3), padded to 4 bytes
//   .. indices    (uint16 or uint32)
//
// PLC1 — instance placements
//   0  char[4]  'PLC1'
//   4  uint16   version (1)
//   6  uint16   flags (reserved)
//   8  uint32   count
//   12 uint32   stride (32)
//   16 per instance: float32 px,py,pz | int16 qx,qy,qz,qw (/32767) | float32 sx,sy,sz
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { rng } from './math.mjs';

const q4 = (v) => Math.round(v * 1e4) / 1e4; // quantise to 4 decimal places

function emit(path, buf) {
  mkdirSync(dirname(path), { recursive: true });
  const gz = gzipSync(buf, { level: 9 });
  writeFileSync(path, buf);
  writeFileSync(path + '.gz', gz);
  return { bytes: buf.length, gz: gz.length };
}

export function writeSil(mesh, path, { forceFloat = false, tolerance = 0.01 } = {}) {
  const n = mesh.vertexCount, ni = mesh.i.length;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < mesh.p.length; k++) { const v = q4(mesh.p[k]); mesh.p[k] = v; min[k % 3] = Math.min(min[k % 3], v); max[k % 3] = Math.max(max[k % 3], v); }
  // int16 is enough if one quantisation step stays under `tolerance` metres.
  const step = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 65534;
  const useFloat = forceFloat || step > tolerance;
  const wide = n > 65535;
  const posBytes = n * 3 * (useFloat ? 4 : 2);
  const pad = (4 - (posBytes % 4)) % 4;
  const buf = Buffer.alloc(40 + posBytes + pad + ni * (wide ? 4 : 2));
  buf.write('SIL1', 0, 'ascii');
  buf.writeUInt16LE(1, 4); buf.writeUInt16LE((wide ? 1 : 0) | (useFloat ? 2 : 0), 6);
  buf.writeUInt32LE(n, 8); buf.writeUInt32LE(ni, 12);
  for (let k = 0; k < 3; k++) { buf.writeFloatLE(min[k], 16 + k * 4); buf.writeFloatLE(max[k], 28 + k * 4); }
  let o = 40;
  for (let k = 0; k < mesh.p.length; k++) {
    if (useFloat) { buf.writeFloatLE(mesh.p[k], o); o += 4; }
    else { const a = k % 3; const r = max[a] - min[a] || 1; buf.writeInt16LE(Math.round(((mesh.p[k] - min[a]) / r) * 65534 - 32767), o); o += 2; }
  }
  o += pad;
  for (const idx of mesh.i) { if (wide) { buf.writeUInt32LE(idx, o); o += 4; } else { buf.writeUInt16LE(idx, o); o += 2; } }
  return { ...emit(path, buf), tris: ni / 3, verts: n };
}

/**
 * instances: [{ p:[x,y,z], q:[x,y,z,w], s:[x,y,z] | number }]
 * Order is shuffled (seeded) so the runtime can thin instances for lower
 * quality tiers by simply drawing the first N.
 */
export function writePlc(instances, path, seed = 7) {
  const list = instances.slice(); const r = rng(seed);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const buf = Buffer.alloc(16 + list.length * 32);
  buf.write('PLC1', 0, 'ascii'); buf.writeUInt16LE(1, 4); buf.writeUInt16LE(0, 6);
  buf.writeUInt32LE(list.length, 8); buf.writeUInt32LE(32, 12);
  let o = 16;
  for (const it of list) {
    const s = typeof it.s === 'number' ? [it.s, it.s, it.s] : it.s || [1, 1, 1];
    const q = it.q || [0, 0, 0, 1];
    for (const v of it.p) { buf.writeFloatLE(q4(v), o); o += 4; }
    for (const v of q) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), o); o += 2; }
    for (const v of s) { buf.writeFloatLE(q4(v), o); o += 4; }
  }
  return { ...emit(path, buf), count: list.length };
}
