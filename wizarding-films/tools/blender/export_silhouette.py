"""
Blender exporter for The Wizarding Films geometry pipeline (Blender 3.6+ / 4.x).

Writes the two binary formats the site loads (see lib/loaders/silhouette.ts,
lib/loaders/placements.ts and scripts/geo/formats.mjs, which emits identical
files from the procedural build):

  SIL1  silhouette mesh: POSITIONS ONLY, rounded to 4 decimal places, then
        stored int16-quantised to the bounding box (or float32 if a quantisation
        step would exceed --tolerance). No UVs, no normals: shading is derived in
        the shader from screen-space derivatives, height and fog.
  PLC1  instance placements: [position f32x3 | rotation quat int16x4 | scale f32x3]
        per instance, shuffled so the runtime can thin instances per quality tier.

Every file is also written gzipped (*.gz); the site fetches the .gz and inflates it
with DecompressionStream.

Conventions
-----------
* Blender is Z-up; the site is Y-up. Positions are converted (x, z, -y).
* Collection "SIL"      -> every mesh object inside is exported as <name>.bin
                           (modifiers applied, decimate before export!).
* Collection "SCATTER"  -> each child collection "<plc_name>" holds instances
                           (linked duplicates, or a Geometry Nodes scatter that you
                           "Realize"/"Make Instances Real" first). Only the object
                           transforms are exported, to <plc_name>.plc. Paint them in
                           with a low-poly proxy; the proxy mesh itself is never
                           exported.

Usage
-----
blender scene.blend --background --python tools/blender/export_silhouette.py -- \
    --out public/geo/film-1 [--tolerance 0.01] [--decimate 0.35] [--cull-below -20]

--decimate  optional ratio for a temporary Decimate (collapse) modifier.
--cull-below drop triangles entirely below this height (Blender Z), i.e. under
             the water or lost in fog.
"""
import argparse
import gzip
import math
import os
import random
import struct
import sys

import bpy  # type: ignore
import bmesh  # type: ignore
from mathutils import Matrix, Quaternion  # type: ignore

Z_UP_TO_Y_UP = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--tolerance", type=float, default=0.01, help="max metres per int16 quantisation step")
    p.add_argument("--decimate", type=float, default=0.0)
    p.add_argument("--cull-below", type=float, default=None)
    p.add_argument("--seed", type=int, default=7)
    return p.parse_args(argv)


def emit(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    gz = gzip.compress(data, compresslevel=9, mtime=0)
    with open(path + ".gz", "wb") as f:
        f.write(gz)
    return len(data), len(gz)


def triangulated_positions(obj, decimate, cull_below):
    """World-space triangle soup -> deduplicated (positions, indices), Y-up."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mod = None
    if decimate and 0 < decimate < 1:
        mod = obj.modifiers.new("_wf_decimate", "DECIMATE")
        mod.ratio = decimate
        depsgraph.update()
    ev = obj.evaluated_get(depsgraph)
    mesh = ev.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    m = Z_UP_TO_Y_UP @ obj.matrix_world
    index_of, positions, indices = {}, [], []
    for face in bm.faces:
        world = [m @ v.co for v in face.verts]
        if cull_below is not None and all(w.y < cull_below for w in world):
            continue  # hidden under water / fog: never ship it
        for w in world:
            key = (round(w.x, 4), round(w.y, 4), round(w.z, 4))  # 4 decimal places
            if key not in index_of:
                index_of[key] = len(positions)
                positions.append(key)
            indices.append(index_of[key])
    bm.free()
    ev.to_mesh_clear()
    if mod:
        obj.modifiers.remove(mod)
    return positions, indices


def write_sil(path, positions, indices, tolerance):
    n, ni = len(positions), len(indices)
    mn = [min(p[a] for p in positions) for a in range(3)]
    mx = [max(p[a] for p in positions) for a in range(3)]
    step = max(mx[a] - mn[a] for a in range(3)) / 65534.0
    use_float = step > tolerance
    wide = n > 65535
    flags = (1 if wide else 0) | (2 if use_float else 0)
    out = bytearray(b"SIL1")
    out += struct.pack("<HHII", 1, flags, n, ni)
    out += struct.pack("<3f", *mn) + struct.pack("<3f", *mx)
    for p in positions:
        if use_float:
            out += struct.pack("<3f", *p)
        else:
            q = []
            for a in range(3):
                r = (mx[a] - mn[a]) or 1.0
                q.append(int(round((p[a] - mn[a]) / r * 65534 - 32767)))
            out += struct.pack("<3h", *q)
    while len(out) % 4:
        out += b"\0"
    out += struct.pack("<%d%s" % (ni, "I" if wide else "H"), *indices)
    raw, gz = emit(path, bytes(out))
    return {"verts": n, "tris": ni // 3, "bytes": raw, "gz": gz, "float": use_float}


def write_plc(path, objects, seed):
    items = []
    for o in objects:
        m = Z_UP_TO_Y_UP @ o.matrix_world @ Z_UP_TO_Y_UP.inverted()
        loc, rot, scale = m.decompose()
        items.append(((loc.x, loc.y, loc.z), (rot.x, rot.y, rot.z, rot.w), (scale.x, scale.y, scale.z)))
    random.Random(seed).shuffle(items)  # first N == even spread, for tier thinning
    out = bytearray(b"PLC1") + struct.pack("<HHII", 1, 0, len(items), 32)
    for (p, q, s) in items:
        out += struct.pack("<3f", *[round(v, 4) for v in p])
        out += struct.pack("<4h", *[int(round(max(-1.0, min(1.0, v)) * 32767)) for v in q])
        out += struct.pack("<3f", *[round(v, 4) for v in s])
    raw, gz = emit(path, bytes(out))
    return {"count": len(items), "bytes": raw, "gz": gz}


def main():
    args = parse_args()
    report = []
    sil = bpy.data.collections.get("SIL")
    if sil:
        for obj in sil.all_objects:
            if obj.type != "MESH":
                continue
            pos, idx = triangulated_positions(obj, args.decimate, args.cull_below)
            if not idx:
                continue
            info = write_sil(os.path.join(args.out, obj.name + ".bin"), pos, idx, args.tolerance)
            report.append(f"SIL {obj.name}: {info['tris']} tris, {info['gz'] / 1024:.1f} KB gz{' (float32)' if info['float'] else ''}")
    scatter = bpy.data.collections.get("SCATTER")
    if scatter:
        for child in scatter.children:
            objs = [o for o in child.all_objects if o.type in {"MESH", "EMPTY"}]
            if objs:
                info = write_plc(os.path.join(args.out, child.name + ".plc"), objs, args.seed)
                report.append(f"PLC {child.name}: {info['count']} instances, {info['gz'] / 1024:.1f} KB gz")
    print("\n".join(report) or "Nothing exported: create collections named SIL and/or SCATTER.")


if __name__ == "__main__":
    main()
