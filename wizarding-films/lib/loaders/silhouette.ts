import { BufferAttribute, BufferGeometry, Box3, Sphere, Vector3 } from 'three';
import { fetchBinary } from './fetchBinary';

/**
 * Loader for SIL1 silhouette meshes: positions only (no UVs, no normals),
 * int16-quantised to the bounding box or raw float32. Matches
 * tools/blender/export_silhouette.py and scripts/geo/formats.mjs.
 *
 * Quantised positions are uploaded as normalised Int16 and de-quantised on the
 * GPU via the geometry's `userData.dequant` (applied by our materials), so the
 * CPU never expands them to float32.
 */
export interface SilhouetteInfo { vertexCount: number; indexCount: number; min: Vector3; max: Vector3; quantised: boolean }

export function parseSilhouette(buf: ArrayBuffer): BufferGeometry {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'SIL1') throw new Error('Not a SIL1 mesh');
  const flags = dv.getUint16(6, true);
  const wide = (flags & 1) !== 0, isFloat = (flags & 2) !== 0;
  const n = dv.getUint32(8, true), ni = dv.getUint32(12, true);
  const min = new Vector3(dv.getFloat32(16, true), dv.getFloat32(20, true), dv.getFloat32(24, true));
  const max = new Vector3(dv.getFloat32(28, true), dv.getFloat32(32, true), dv.getFloat32(36, true));
  let o = 40;
  const g = new BufferGeometry();
  if (isFloat) {
    g.setAttribute('position', new BufferAttribute(new Float32Array(buf, o, n * 3), 3));
    o += n * 12;
  } else {
    // Expand int16 → float32 once. (Keeping int16 on the GPU saves memory but
    // breaks raycasting in the studio; the transfer size is what matters.)
    const q = new Int16Array(buf, o, n * 3);
    const f = new Float32Array(n * 3);
    const ext = [max.x - min.x || 1, max.y - min.y || 1, max.z - min.z || 1];
    const mn = [min.x, min.y, min.z];
    for (let i = 0; i < n * 3; i++) { const a = i % 3; f[i] = mn[a] + ((q[i] + 32767) / 65534) * ext[a]; }
    g.setAttribute('position', new BufferAttribute(f, 3));
    o += n * 6;
    o += (4 - (o % 4)) % 4;
  }
  const idx = wide ? new Uint32Array(buf, o, ni) : new Uint16Array(buf, o, ni);
  g.setIndex(new BufferAttribute(idx, 1));
  g.boundingBox = new Box3(min, max);
  g.boundingSphere = g.boundingBox.getBoundingSphere(new Sphere());
  g.userData.triangles = ni / 3;
  return g;
}

export async function loadSilhouette(path: string, signal?: AbortSignal) {
  return parseSilhouette(await fetchBinary(path + '.bin', signal));
}
