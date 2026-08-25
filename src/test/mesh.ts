import type * as THREE from "three";

export interface MeshReport {
  triangles: number;
  unmatchedEdges: number; // directed edges without an opposite twin
  duplicateEdges: number; // directed edges used more than once
  degenerate: number; // triangles with a repeated vertex
  volume: number; // signed, mm³ — positive means outward-facing normals
}

/**
 * Topology check for a closed, consistently oriented mesh — what a slicer needs.
 * Vertices are welded by position first (the STL has no indices, so that's what the slicer sees).
 */
export function analyzeMesh(geo: THREE.BufferGeometry): MeshReport {
  const pos = geo.getAttribute("position").array as Float32Array;
  const raw = geo.index!.array;
  const weld = new Map<string, number>();
  const remap = new Int32Array(pos.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const k = `${pos[i * 3].toFixed(4)},${pos[i * 3 + 1].toFixed(4)},${pos[i * 3 + 2].toFixed(4)}`;
    let w = weld.get(k);
    if (w === undefined) {
      w = i;
      weld.set(k, i);
    }
    remap[i] = w;
  }
  const edges = new Map<string, number>();
  let degenerate = 0;
  let volume = 0;
  for (let t = 0; t < raw.length; t += 3) {
    const a = remap[raw[t]];
    const b = remap[raw[t + 1]];
    const c = remap[raw[t + 2]];
    if (a === b || b === c || a === c) degenerate++;
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = `${u}>${v}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
    const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  let unmatchedEdges = 0;
  let duplicateEdges = 0;
  for (const [k, n] of edges) {
    if (n !== 1) duplicateEdges++;
    const [u, v] = k.split(">");
    if (!edges.has(`${v}>${u}`)) unmatchedEdges++;
  }
  return { triangles: raw.length / 3, unmatchedEdges, duplicateEdges, degenerate, volume };
}

export function isWatertight(r: MeshReport) {
  return r.unmatchedEdges === 0 && r.duplicateEdges === 0 && r.degenerate === 0 && r.volume > 0;
}
