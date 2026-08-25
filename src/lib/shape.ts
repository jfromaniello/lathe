import * as THREE from "three";

export type Waveform = "sine" | "triangle" | "scallop" | "square";
export type Mode = "shell" | "solid";
/** Which part of the wave sits on the base profile: its midline, its crest (grooves carved inwards) or its valley (ribs grown outwards). */
export type RibAlign = "center" | "crest" | "valley";
/** Outline of the top hole: a plain circle, or the section shape (squareness + twist, no ribs) at half-width topHole. */
export type HoleShape = "circle" | "follow";

export interface ShapeParams {
  mode: Mode;
  height: number; // mm
  radius: number; // mm (half-width for square-ish sections)
  squareness: number; // 0 = circle, 1 = square
  profile: number[]; // radius multipliers, evenly spaced from z=0 (bottom) to z=height (top)
  ribCount: number;
  ribAmplitude: number; // mm, negative flips ridges/grooves
  ribWaveform: Waveform;
  ribSharpness: number; // 0..1 (square waveform)
  ribStart: number; // 0..1 fraction of height
  ribEnd: number; // 0..1
  ribFade: number; // mm transition length (0 = hard step)
  ribAlign: RibAlign;
  twist: number; // total degrees over full height
  wall: number; // mm
  bottom: number; // mm thickness, 0 = open
  top: number; // mm thickness, 0 = open
  topHole: number; // mm radius (half-width) of hole in the top (when top > 0)
  topHoleShape: HoleShape;
  radialSegments: number;
  heightSegments: number;
}

export const DEFAULT_PARAMS: ShapeParams = {
  mode: "shell",
  height: 180,
  radius: 40,
  squareness: 0,
  profile: [1, 1, 1, 1, 1, 1, 1],
  ribCount: 72,
  ribAmplitude: 1.2,
  ribWaveform: "scallop",
  ribSharpness: 0.5,
  ribStart: 0.3,
  ribEnd: 1,
  ribFade: 0,
  ribAlign: "center",
  twist: 0,
  wall: 1.2,
  bottom: 1.6,
  top: 0,
  topHole: 20,
  topHoleShape: "circle",
  radialSegments: 256,
  heightSegments: 128,
};

export const PRESETS: { id: string; name: string; params: ShapeParams }[] = [
  {
    id: "fluted-vase",
    name: "Fluted vase",
    params: { ...DEFAULT_PARAMS },
  },
  {
    id: "twist-lamp",
    name: "Twist lamp",
    params: {
      ...DEFAULT_PARAMS,
      height: 120,
      radius: 65,
      profile: [0.55, 0.82, 0.97, 1, 0.97, 0.85, 0.65],
      ribCount: 8,
      ribAmplitude: 6,
      ribWaveform: "sine",
      ribStart: 0,
      ribEnd: 1,
      twist: 70,
      wall: 1.2,
      bottom: 0,
      top: 2,
      topHole: 20.5,
    },
  },
  {
    id: "desk-bin",
    name: "Desk bin",
    params: {
      ...DEFAULT_PARAMS,
      height: 150,
      radius: 60,
      squareness: 0.7,
      ribCount: 96,
      ribAmplitude: 1,
      ribWaveform: "scallop",
      ribStart: 0,
      ribEnd: 1,
      wall: 1.6,
      bottom: 2,
      top: 0,
    },
  },
  {
    id: "square-twist",
    name: "Square twist",
    params: {
      ...DEFAULT_PARAMS,
      height: 160,
      radius: 45,
      squareness: 0.85,
      profile: [0.8, 0.9, 1, 1.05, 1, 0.95, 0.9],
      ribCount: 0,
      ribAmplitude: 0,
      twist: 90,
      wall: 1.2,
      bottom: 1.6,
      top: 0,
    },
  },
];

const TWO_PI = Math.PI * 2;

// ---------- helpers ----------

function smoothstep(e0: number, e1: number, x: number) {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function wave(kind: Waveform, p: number, sharp: number): number {
  p -= Math.floor(p);
  switch (kind) {
    case "sine":
      return Math.sin(TWO_PI * p);
    case "triangle":
      return 1 - 4 * Math.abs(p - 0.5);
    case "scallop":
      return 2 * Math.abs(Math.sin(Math.PI * p)) - 1;
    case "square": {
      const k = 1 + sharp * 15;
      return Math.tanh(k * Math.sin(TWO_PI * p)) / Math.tanh(k);
    }
  }
}

/** Catmull-Rom interpolation over evenly spaced control points, t in [0,1]. */
export function profileAt(profile: number[], t: number): number {
  const n = profile.length;
  if (n === 0) return 1;
  if (n === 1) return profile[0];
  const x = Math.min(1, Math.max(0, t)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  const p0 = profile[Math.max(0, i - 1)];
  const p1 = profile[i];
  const p2 = profile[i + 1];
  const p3 = profile[Math.min(n - 1, i + 2)];
  const f2 = f * f;
  const f3 = f2 * f;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * f +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * f3)
  );
}

/** Superellipse in polar form (smooth in phi everywhere, unlike the cos^(2/n) parametrisation). Half-width = 1. */
function superellipse(phi: number, n: number): [number, number] {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const r = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), -1 / n);
  return [r * c, r * s];
}

/** Arc-length tables so vertices AND ribs are evenly spaced along the perimeter of non-circular sections. */
function makeArcTable(n: number, samples = 4096) {
  const cum = new Float64Array(samples + 1);
  let [px, py] = superellipse(0, n);
  for (let i = 1; i <= samples; i++) {
    const [x, y] = superellipse((i / samples) * TWO_PI, n);
    cum[i] = cum[i - 1] + Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  const total = cum[samples];
  // inverse: arc fraction u -> theta
  const thetaOf = (u: number) => {
    u -= Math.floor(u);
    const target = u * total;
    let lo = 0;
    let hi = samples;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const f = (target - cum[lo]) / span;
    return ((lo + f) / samples) * TWO_PI;
  };
  return { thetaOf };
}

function zStations(z0: number, z1: number, count: number, extras: number[]) {
  const zs: number[] = [];
  for (let i = 0; i <= count; i++) zs.push(z0 + ((z1 - z0) * i) / count);
  for (const e of extras) if (e > z0 && e < z1) zs.push(e);
  zs.sort((a, b) => a - b);
  const out: number[] = [];
  for (const z of zs) if (out.length === 0 || z - out[out.length - 1] > 1e-6) out.push(z);
  return out;
}

// ---------- mesh construction ----------

type NodeKind = "outer" | "inner" | "hole" | "fixed" | "center";
interface Node {
  kind: NodeKind;
  z: number;
  r?: number; // for 'fixed'
  surface: string; // vertices are shared only within the same surface (smooth normals inside, sharp edges between)
}

/** How far (mm) the deepest valley of the pattern sits below the base profile. */
export function ribDepthBelowBase(p: ShapeParams): number {
  if (p.ribCount <= 0) return 0;
  const a = Math.abs(p.ribAmplitude);
  switch (p.ribAlign) {
    case "crest":
      return 2 * a;
    case "valley":
      return 0;
    default:
      return a;
  }
}

export function sanitize(p: ShapeParams): ShapeParams {
  const minProfile = Math.max(0.05, Math.min(...p.profile));
  const minOuter = p.radius * minProfile - ribDepthBelowBase(p);
  const out = { ...p };
  if (out.mode === "shell" && out.wall >= minOuter - 0.5) out.mode = "solid";
  if (out.mode === "shell") {
    const innerMin = minOuter - out.wall;
    // a "follow" hole is the plain section (no ribs) scaled to topHole, so it only has to clear the inner wall at the top,
    // where the ribs may dip below the base profile
    const holeMax =
      out.topHoleShape === "follow" ? out.radius * profileAt(out.profile, 1) - ribDepthBelowBase(out) - out.wall : innerMin;
    if (out.top > 0 && out.topHole >= holeMax - 0.5) out.topHole = Math.max(0, holeMax - 1);
    out.bottom = Math.min(out.bottom, out.height * 0.4);
    out.top = Math.min(out.top, out.height * 0.4);
  }
  return out;
}

/**
 * Radial segment count actually used: snapped to an exact multiple of the rib count so every rib is
 * sampled identically (otherwise the sampling beats against the pattern and produces moiré / flat zones).
 */
export function effectiveRadialSegments(p: ShapeParams, minPerRib = 6): number {
  const wanted = Math.max(24, p.radialSegments);
  if (p.ribCount > 0 && p.ribAmplitude !== 0) {
    const perRib = Math.max(minPerRib, Math.ceil(wanted / p.ribCount));
    return perRib * p.ribCount;
  }
  return wanted;
}

export function buildGeometry(input: ShapeParams): THREE.BufferGeometry {
  const p = sanitize(input);
  const H = p.height;
  const R = effectiveRadialSegments(p);
  const n = 2 + p.squareness * 10;
  const { thetaOf } = makeArcTable(n);
  const twistRad = (p.twist * Math.PI) / 180;
  const fade = Math.max(0.01, p.ribFade);
  const zs = p.ribStart * H;
  const ze = p.ribEnd * H;
  const hasRibs = p.ribCount > 0 && p.ribAmplitude !== 0;
  const ribOffset = p.ribAlign === "crest" ? -1 : p.ribAlign === "valley" ? 1 : 0;

  const envelope = (z: number) => {
    if (!hasRibs) return 0;
    const a = p.ribStart <= 0 ? 1 : smoothstep(zs - fade / 2, zs + fade / 2, z);
    const b = p.ribEnd >= 1 ? 1 : 1 - smoothstep(ze - fade / 2, ze + fade / 2, z);
    return a * b;
  };

  const extras = hasRibs ? [zs - fade / 2, zs + fade / 2, ze - fade / 2, ze + fade / 2] : [];

  const outerScale = (u: number, z: number, env: number, bx: number, by: number) => {
    const zf = z / H;
    const base = p.radius * profileAt(p.profile, zf);
    let rib = 0;
    if (hasRibs && env > 0) {
      // wave is in [-1, 1]; the offset (scaled by the envelope too, so the smooth zone blends into it) anchors
      // the crest or the valley to the base profile instead of the midline
      const w = Math.sign(p.ribAmplitude) * wave(p.ribWaveform, p.ribCount * u, p.ribSharpness);
      rib = Math.abs(p.ribAmplitude) * env * (w + ribOffset);
    }
    // normalise so the rib amplitude is in mm even on the corners of a square-ish section
    const len = Math.hypot(bx, by) || 1;
    return base + rib / len;
  };

  // --- build loops of nodes ---
  const loops: Node[][] = [];
  const outerWall = (): Node[] =>
    zStations(0, H, p.heightSegments, extras).map((z) => ({ kind: "outer", z, surface: "outer" }));

  if (p.mode === "solid") {
    loops.push([
      { kind: "center", z: 0, surface: "bottom" },
      { kind: "outer", z: 0, surface: "bottom" },
      ...outerWall(),
      { kind: "outer", z: H, surface: "top" },
      { kind: "center", z: H, surface: "top" },
    ]);
  } else {
    const zi0 = p.bottom;
    const zi1 = H - p.top;
    const innerWallDown = (): Node[] =>
      zStations(zi0, zi1, p.heightSegments, extras)
        .reverse()
        .map((z) => ({ kind: "inner", z, surface: "inner" }));
    const hasHole = p.top > 0 && p.topHole > 0.01;
    const holeKind: NodeKind = p.topHoleShape === "follow" ? "hole" : "fixed";

    // top section (from outer@H down to inner@zi1)
    const topNodes: Node[] = [];
    if (p.top <= 0) {
      topNodes.push({ kind: "outer", z: H, surface: "rim" }, { kind: "inner", z: H, surface: "rim" });
    } else if (hasHole) {
      topNodes.push(
        { kind: "outer", z: H, surface: "topface" },
        { kind: holeKind, z: H, r: p.topHole, surface: "topface" },
        { kind: holeKind, z: H, r: p.topHole, surface: "holewall" },
        { kind: holeKind, z: zi1, r: p.topHole, surface: "holewall" },
        { kind: holeKind, z: zi1, r: p.topHole, surface: "ceiling" },
        { kind: "inner", z: zi1, surface: "ceiling" },
      );
    }
    const bottomNodesEnd: Node[] = [];
    const bottomNodesStart: Node[] = [];
    if (p.bottom <= 0) {
      bottomNodesStart.push({ kind: "outer", z: 0, surface: "brim" });
      bottomNodesEnd.push({ kind: "inner", z: 0, surface: "brim" });
    } else {
      bottomNodesStart.push({ kind: "center", z: 0, surface: "bottom" }, { kind: "outer", z: 0, surface: "bottom" });
      bottomNodesEnd.push({ kind: "inner", z: zi0, surface: "floor" }, { kind: "center", z: zi0, surface: "floor" });
    }

    if (p.top > 0 && !hasHole) {
      // fully closed top: the cavity is a separate (inverted) loop
      loops.push([
        ...bottomNodesStart,
        ...outerWall(),
        { kind: "outer", z: H, surface: "top" },
        { kind: "center", z: H, surface: "top" },
      ]);
      const cavity: Node[] = [
        { kind: "center", z: zi1, surface: "ceiling" },
        { kind: "inner", z: zi1, surface: "ceiling" },
        ...innerWallDown(),
        ...(p.bottom > 0
          ? bottomNodesEnd
          : [{ kind: "inner", z: 0, surface: "brim" } as Node, { kind: "outer", z: 0, surface: "brim" } as Node]),
      ];
      if (p.bottom <= 0) {
        // open bottom + closed top: it's actually one loop; rebuild as such
        loops.length = 0;
        loops.push([
          { kind: "outer", z: 0, surface: "brim" },
          ...outerWall(),
          { kind: "outer", z: H, surface: "top" },
          { kind: "center", z: H, surface: "top" },
          { kind: "center", z: zi1, surface: "ceiling" },
          { kind: "inner", z: zi1, surface: "ceiling" },
          ...innerWallDown(),
          { kind: "inner", z: 0, surface: "brim" },
        ]);
      } else {
        loops.push(cavity);
      }
    } else {
      loops.push([...bottomNodesStart, ...outerWall(), ...topNodes, ...innerWallDown(), ...bottomNodesEnd]);
    }
  }

  // --- emit vertices ---
  const positions: number[] = [];
  const indices: number[] = [];

  // theta for each column, evenly spaced along the section perimeter (not by angle)
  const thetas = new Float64Array(R);
  const cosT = new Float64Array(R);
  const sinT = new Float64Array(R);
  for (let i = 0; i < R; i++) {
    thetas[i] = thetaOf(i / R);
    const a = (i / R) * TWO_PI;
    cosT[i] = Math.cos(a);
    sinT[i] = Math.sin(a);
  }

  interface Row { start: number; center: boolean; key: string }

  const emitRow = (node: Node): Row => {
    const start = positions.length / 3;
    if (node.kind === "center") {
      positions.push(0, 0, node.z);
      return { start, center: true, key: `c:${node.z.toFixed(5)}` };
    }
    if (node.kind === "fixed") {
      const r = node.r ?? 0;
      for (let i = 0; i < R; i++) positions.push(r * cosT[i], r * sinT[i], node.z);
      return { start, center: false, key: `f:${r.toFixed(5)}:${node.z.toFixed(5)}` };
    }
    const z = node.z;
    const env = envelope(z);
    const rot = twistRad * (z / H);
    for (let i = 0; i < R; i++) {
      const theta = thetas[i] + rot;
      const [bx, by] = superellipse(theta, n);
      let s: number;
      if (node.kind === "hole") {
        // the section's squareness and twist, but none of the ribs: half-width = topHole
        s = p.topHole;
      } else {
        s = outerScale(i / R, z, env, bx, by);
        if (node.kind === "inner") s = Math.max(0.3, s - p.wall);
      }
      positions.push(bx * s, by * s, z);
    }
    return { start, center: false, key: `${node.kind}:${z.toFixed(5)}` };
  };

  const stitch = (a: Row, b: Row) => {
    if (a.key === b.key) return;
    if (a.center && b.center) return;
    if (a.center) {
      for (let i = 0; i < R; i++) {
        const j = (i + 1) % R;
        indices.push(a.start, b.start + j, b.start + i);
      }
      return;
    }
    if (b.center) {
      for (let i = 0; i < R; i++) {
        const j = (i + 1) % R;
        indices.push(a.start + i, a.start + j, b.start);
      }
      return;
    }
    for (let i = 0; i < R; i++) {
      const j = (i + 1) % R;
      indices.push(a.start + i, a.start + j, b.start + j);
      indices.push(a.start + i, b.start + j, b.start + i);
    }
  };

  for (const loop of loops) {
    const rows: Row[] = [];
    let prev: Node | null = null;
    let prevRow: Row | null = null;
    for (const node of loop) {
      // share vertices when consecutive nodes belong to the same surface and same position
      let row: Row;
      if (prev && prevRow && prev.surface === node.surface && sameNode(prev, node)) {
        row = prevRow;
      } else {
        row = emitRow(node);
      }
      rows.push(row);
      prev = node;
      prevRow = row;
    }
    for (let k = 0; k < rows.length; k++) {
      stitch(rows[k], rows[(k + 1) % rows.length]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

function sameNode(a: Node, b: Node) {
  return a.kind === b.kind && Math.abs(a.z - b.z) < 1e-6 && (a.r ?? 0) === (b.r ?? 0);
}

export function bounds(geo: THREE.BufferGeometry) {
  const bb = geo.boundingBox ?? new THREE.Box3().setFromBufferAttribute(geo.getAttribute("position") as THREE.BufferAttribute);
  return {
    x: bb.max.x - bb.min.x,
    y: bb.max.y - bb.min.y,
    z: bb.max.z - bb.min.z,
  };
}
