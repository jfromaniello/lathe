// 2D side of the hole punch: everything happens in the wall's (u, z) parameter space, where u ∈ [0, 1) goes round the
// section (one unit = the perimeter) and z is the height of a row of the mesh. The wall is a grid there: columns at
// u = k/R and rows at the z stations. A cut is a convex outline; it is split at every grid line it crosses so that each
// piece lies inside one cell, and each cell it touches is divided into the part kept and the part cut away.

export interface PPoint {
  u: number; // unwrapped: may fall outside [0, 1) for a cut over the seam
  z: number;
  /** Position along the outline, 0 … 1 (to zip two rings of the same outline together). */
  t: number;
  /** On the column line u = vline / R. */
  vline?: number;
  /** On the row line z = stations[hline]. */
  hline?: number;
}

/** A point of a cell polygon: one of the cell's corners (0 bottom-left, 1 bottom-right, 2 top-right, 3 top-left, CCW) or point `idx` of outline `ring` of mark `cut`. */
export interface CellPt {
  u: number;
  z: number;
  corner?: number;
  cut?: number;
  ring?: number;
  idx?: number;
}

export interface Region {
  contour: CellPt[];
  holes: CellPt[][];
}

/** Closed polyline through the outline corners, split at every column and row line it crosses (CCW in u, z). */
export function splitOutline(outline: [number, number][], R: number, stations: number[]): PPoint[] {
  const out: PPoint[] = [];
  const N = outline.length;
  for (let e = 0; e < N; e++) {
    const [ua, za] = outline[e];
    const [ub, zb] = outline[(e + 1) % N];
    out.push({ u: ua, z: za, t: e / N });
    const xs: PPoint[] = [];
    const ka = ua * R;
    const kb = ub * R;
    for (let k = Math.floor(Math.min(ka, kb)) + 1; k < Math.max(ka, kb); k++) {
      const f = (k - ka) / (kb - ka);
      xs.push({ u: k / R, z: za + f * (zb - za), t: (e + f) / N, vline: k });
    }
    const zlo = Math.min(za, zb);
    const zhi = Math.max(za, zb);
    for (let j = lowerBound(stations, zlo); j < stations.length && stations[j] < zhi; j++) {
      if (stations[j] <= zlo) continue;
      const f = (stations[j] - za) / (zb - za);
      xs.push({ u: ua + f * (ub - ua), z: stations[j], t: (e + f) / N, hline: j });
    }
    xs.sort((a, b) => a.t - b.t);
    out.push(...xs);
  }
  return out;
}

/** True when the split outline would produce (near) degenerate cells: a crossing at a grid corner, or two points on top of each other. */
export function isDegenerate(pts: PPoint[], R: number, stations: number[], perimeter: number, eps = 1e-4): boolean {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (Math.hypot((a.u - b.u) * perimeter, a.z - b.z) < eps) return true;
    if (a.vline !== undefined) {
      const j = lowerBound(stations, a.z - eps);
      if (j < stations.length && Math.abs(stations[j] - a.z) < eps) return true;
    }
    if (a.hline !== undefined && Math.abs(a.u * R - Math.round(a.u * R)) * (perimeter / R) < eps) return true;
    // a corner of the outline sitting on a grid line
    if (a.vline === undefined && a.hline === undefined) {
      if (Math.abs(a.u * R - Math.round(a.u * R)) * (perimeter / R) < eps) return true;
      const j = lowerBound(stations, a.z - eps);
      if (j < stations.length && Math.abs(stations[j] - a.z) < eps) return true;
    }
  }
  return false;
}

export function lowerBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Point in polygon (even-odd), for an outline in the same unwrapped frame. */
export function insidePolygon(poly: { u: number; z: number }[], u: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && u < ((b.u - a.u) * (z - a.z)) / (b.z - a.z) + a.u) inside = !inside;
  }
  return inside;
}

export interface CellChords {
  /** Pieces of outlines running through the cell, from one point on its border to another, in the outline's (CCW) direction. */
  chords: CellPt[][];
  /** Outlines entirely inside the cell. */
  loops: CellPt[][];
}

/**
 * Splits the cell [u0, u1] × [zlo, zhi] along the chords into the regions kept (outside every cut) and the regions cut
 * away. Walks the cell border CCW; at a chord it follows the chord to its other end and carries on along the border from
 * there (the cuts are convex and never overlap, so that always lands on a stretch of border on the same side).
 */
export function splitCell(
  cell: { u0: number; u1: number; zlo: number; zhi: number },
  { chords, loops }: CellChords,
  isInside: (u: number, z: number) => boolean,
): { keep: Region[]; cut: Region[] } {
  const { u0, u1, zlo, zhi } = cell;
  const corners: CellPt[] = [
    { u: u0, z: zlo, corner: 0 },
    { u: u1, z: zlo, corner: 1 },
    { u: u1, z: zhi, corner: 2 },
    { u: u0, z: zhi, corner: 3 },
  ];
  if (chords.length === 0) {
    // the whole cell is on one side; outlines wholly inside it are nested in below
    const eps = 1e-6;
    const whole = isInside(u0 + (u1 - u0) * eps, zlo + (zhi - zlo) * eps);
    const base: Region = { contour: corners, holes: [] };
    return nestLoops(whole ? { keep: [], cut: [base] } : { keep: [base], cut: [] }, loops);
  }

  const du = u1 - u0;
  const dz = zhi - zlo;
  const tol = 1e-9;
  /** Position on the border, 0 … 4 CCW from the bottom-left corner. */
  const perim = (p: CellPt): number => {
    if (p.corner !== undefined) return p.corner;
    if (Math.abs(p.z - zlo) <= tol * Math.max(1, Math.abs(zlo))) return (p.u - u0) / du;
    if (Math.abs(p.u - u1) <= tol) return 1 + (p.z - zlo) / dz;
    if (Math.abs(p.z - zhi) <= tol * Math.max(1, Math.abs(zhi))) return 2 + (u1 - p.u) / du;
    return 3 + (zhi - p.z) / dz;
  };
  const atPerim = (s: number): [number, number] => {
    s = ((s % 4) + 4) % 4;
    if (s < 1) return [u0 + s * du, zlo];
    if (s < 2) return [u1, zlo + (s - 1) * dz];
    if (s < 3) return [u1 - (s - 2) * du, zhi];
    return [u0, zhi - (s - 3) * dz];
  };

  interface Ev {
    pt: CellPt;
    s: number;
    chord?: number;
    first?: boolean;
  }
  const evs: Ev[] = corners.map((pt) => ({ pt, s: pt.corner! }));
  chords.forEach((ch, c) => {
    evs.push({ pt: ch[0], s: perim(ch[0]), chord: c, first: true });
    evs.push({ pt: ch[ch.length - 1], s: perim(ch[ch.length - 1]), chord: c, first: false });
  });
  evs.sort((a, b) => a.s - b.s);
  const arcIn = evs.map((e, m) => {
    const next = evs[(m + 1) % evs.length].s + (m + 1 === evs.length ? 4 : 0);
    const [u, z] = atPerim((e.s + next) / 2);
    return isInside(u, z);
  });

  const walk = (want: boolean): CellPt[][] => {
    const used = new Array(evs.length).fill(false);
    const polys: CellPt[][] = [];
    for (let s = 0; s < evs.length; s++) {
      if (used[s] || arcIn[s] !== want) continue;
      const poly: CellPt[] = [];
      let cur = s;
      let guard = 0;
      do {
        used[cur] = true;
        poly.push(evs[cur].pt);
        let nx = (cur + 1) % evs.length;
        const e = evs[nx];
        if (e.chord !== undefined) {
          const ch = chords[e.chord];
          const pts = e.first ? ch : ch.slice().reverse();
          for (let q = 0; q < pts.length - 1; q++) poly.push(pts[q]);
          nx = evs.findIndex((o) => o.chord === e.chord && o.first !== e.first);
        }
        cur = nx;
      } while (cur !== s && ++guard < 100000);
      polys.push(poly);
    }
    return polys;
  };

  const keep: Region[] = walk(false).map((contour) => ({ contour, holes: [] }));
  const cut: Region[] = walk(true).map((contour) => ({ contour, holes: [] }));
  return nestLoops({ keep, cut }, loops);
}

const areaOf = (poly: { u: number; z: number }[]) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.u * q.z - q.u * p.z;
  }
  return Math.abs(a) / 2;
};

/**
 * Outlines wholly inside a cell (a dot, a letter's counter, a tiny hole), biggest first: each becomes a hole in the
 * region that holds it and a region of its own on the other side (cut inside kept, kept inside cut).
 */
function nestLoops(regions: { keep: Region[]; cut: Region[] }, loops: CellPt[][]): { keep: Region[]; cut: Region[] } {
  const sorted = loops.slice().sort((a, b) => areaOf(b) - areaOf(a));
  for (const l of sorted) {
    let host: { r: Region; side: "keep" | "cut"; area: number } | null = null;
    for (const side of ["keep", "cut"] as const)
      for (const r of regions[side]) {
        if (!insidePolygon(r.contour, l[0].u, l[0].z) || r.holes.some((h) => insidePolygon(h, l[0].u, l[0].z))) continue;
        const area = areaOf(r.contour);
        if (!host || area < host.area) host = { r, side, area };
      }
    if (!host) continue;
    host.r.holes.push(l);
    regions[host.side === "keep" ? "cut" : "keep"].push({ contour: l, holes: [] });
  }
  return regions;
}
