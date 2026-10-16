import * as THREE from "three";
import { insidePolygon, isDegenerate, lowerBound, splitCell, splitOutline, type CellChords, type CellPt, type PPoint, type Region } from "./cuts";

export type Waveform = "sine" | "triangle" | "scallop" | "square";
export type Mode = "shell" | "solid";
/** Which part of the wave sits on the base profile: its midline, its crest (grooves carved inwards) or its valley (ribs grown outwards). */
export type RibAlign = "center" | "crest" | "valley";
/** Outline of the top hole: a plain circle, or the section shape (squareness + twist, no ribs) at half-width topHole. */
export type HoleShape = "circle" | "follow";
export type CutShape = "circle" | "square";
/** pocket: sunk `depth` mm into the wall · through: through this wall · both: through the whole piece (this wall and the one opposite) */
export type CutMode = "pocket" | "through" | "both";

/** A hole punched in the wall, placed on the outer surface. */
export interface Cut {
  shape: CutShape;
  mode: CutMode;
  u: number; // 0..1 round the section (arc fraction, same as the mesh columns), centre
  z: number; // 0..1 of the height, centre
  w: number; // mm across (diameter for a circle)
  h: number; // mm tall (square only; a circle uses w)
  depth: number; // mm into the wall, for a pocket
}

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
  lobeCount: number; // big waves around the section (0 = none); they are part of the shape, the ribs ride on top
  lobeAmplitude: number; // mm, swing of the lobes either side of the base profile
  lobeWaveform: Waveform;
  lobeProfile: number[]; // lobe amplitude multipliers, evenly spaced from z=0 (bottom) to z=height (top)
  twist: number; // degrees, scaled by twistCurve (linear by default: the total over the full height)
  twistCurve: number[]; // fraction of the twist reached at evenly spaced heights, bottom to top; [0 … 1] linear
  wall: number; // mm, measured at the deepest rib valley
  innerRib: number; // 0..1 how much of the rib pattern shows on the inside: 0 = smooth cavity (thicker at crests), 1 = constant wall
  bottom: number; // mm thickness, 0 = open
  top: number; // mm thickness, 0 = open
  topHole: number; // mm radius (half-width) of hole in the top (when top > 0)
  topHoleShape: HoleShape;
  topDome: number; // mm the top plate bulges at its centre: + convex (dome), - concave (dish), 0 = flat
  slant: number; // mm the mouth drops from its highest to its lowest side (a plane cut instead of a flat one), 0 = flat
  slantAngle: number; // degrees, direction the low side of the slanted mouth faces
  split: number; // 0 = one piece; else fraction of the height where the shell is cut in two pieces (shell only)
  splitLip: number; // mm height of the neck on the body that the top slides over
  splitGap: number; // mm clearance between the neck and the top
  cuts: Cut[]; // holes / pockets in the wall (shell only)
  radialSegments: number;
  heightSegments: number;
}

/** Twist curve that turns at a constant rate. */
export const LINEAR_TWIST = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

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
  lobeCount: 0,
  lobeAmplitude: 8,
  lobeWaveform: "sine",
  lobeProfile: [0, 0.8, 1, 1, 1, 0.8, 0],
  twist: 0,
  twistCurve: LINEAR_TWIST,
  wall: 1.2,
  innerRib: 0,
  bottom: 1.6,
  top: 0,
  topHole: 20,
  topHoleShape: "follow",
  topDome: 0,
  slant: 0,
  slantAngle: 0,
  split: 0,
  splitLip: 6,
  splitGap: 0.2,
  cuts: [],
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
      innerRib: 1,
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
  {
    id: "swirl-vase",
    name: "Swirl vase",
    params: {
      ...DEFAULT_PARAMS,
      height: 200,
      radius: 52,
      profile: [0.8, 0.95, 1.02, 1, 0.92, 0.84, 0.88],
      ribCount: 180,
      ribAmplitude: 0.7,
      ribWaveform: "scallop",
      ribStart: 0,
      ribEnd: 1,
      lobeCount: 3,
      lobeAmplitude: 12,
      lobeProfile: [0.15, 0.9, 1, 1, 0.75, 0.25, 0],
      twist: 150,
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

/**
 * Catmull-Rom interpolation over evenly spaced control points, t in [0,1]. The end tangents come from repeating the end
 * points ("clamp", eases into the ends) or from extrapolating them ("extend", exact for points on a straight line).
 */
export function profileAt(profile: number[], t: number, ends: "clamp" | "extend" = "clamp"): number {
  const n = profile.length;
  if (n === 0) return 1;
  if (n === 1) return profile[0];
  const x = Math.min(1, Math.max(0, t)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  const p1 = profile[i];
  const p2 = profile[i + 1];
  const p0 = i > 0 ? profile[i - 1] : ends === "extend" ? 2 * p1 - p2 : p1;
  const p3 = i + 2 < n ? profile[i + 2] : ends === "extend" ? 2 * p2 - p1 : p2;
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
  /** theta -> arc fraction u */
  const uOf = (theta: number) => {
    const x = ((((theta / TWO_PI) % 1) + 1) % 1) * samples;
    const i = Math.min(samples - 1, Math.floor(x));
    return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / total;
  };
  return { thetaOf, uOf, total };
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

type NodeKind = "outer" | "inner" | "offset" | "hole" | "fixed" | "center" | "dome";
interface Node {
  kind: NodeKind;
  z: number;
  r?: number; // for 'fixed'
  rho?: number; // for 'dome': 1 = where the dome starts (inner wall line), 0 = centre
  off?: number; // for 'offset': mm inwards from the inner surface (neck of a two-piece joint)
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

/** Rotation (radians) of the section at height fraction t; past the ends (a domed top) it carries on at the end slope. */
export function twistAt(p: ShapeParams, t: number): number {
  if (p.twist === 0) return 0;
  const c = p.twistCurve;
  const n = c.length;
  let f = profileAt(c, t, "extend");
  if (n >= 2 && t > 1) f += (t - 1) * (c[n - 1] - c[n - 2]) * (n - 1);
  if (n >= 2 && t < 0) f += t * (c[1] - c[0]) * (n - 1);
  return ((p.twist * Math.PI) / 180) * f;
}

/** Lobe amplitude multiplier at t in [0,1] of the height (never negative, even where the spline overshoots). */
export function lobeEnvelope(p: ShapeParams, t: number): number {
  if (p.lobeCount <= 0 || p.lobeAmplitude === 0) return 0;
  return Math.max(0, profileAt(p.lobeProfile, t));
}

/** How far (mm) the valleys of the lobes sit below the base profile: at height fraction t, or the worst over the height. */
export function lobeDepthBelowBase(p: ShapeParams, t?: number): number {
  if (p.lobeCount <= 0 || p.lobeAmplitude === 0) return 0;
  const a = Math.abs(p.lobeAmplitude);
  if (t !== undefined) return a * lobeEnvelope(p, t);
  let worst = 0;
  for (let i = 0; i <= 64; i++) worst = Math.max(worst, lobeEnvelope(p, i / 64));
  return a * worst;
}

/** Wall thickness range [at the valleys, at the crests] in mm for the current inner-pattern setting. */
export function wallRange(p: ShapeParams): [number, number] {
  if (p.mode !== "shell") return [0, 0];
  const swing = p.ribCount > 0 ? 2 * Math.abs(p.ribAmplitude) : 0;
  return [p.wall, p.wall + (1 - p.innerRib) * swing];
}

export function sanitize(p: ShapeParams): ShapeParams {
  const minProfile = Math.max(0.05, Math.min(...p.profile));
  const minOuter = p.radius * minProfile - ribDepthBelowBase(p) - lobeDepthBelowBase(p);
  const out = { ...p };
  if (out.mode === "shell" && out.wall >= minOuter - 0.5) out.mode = "solid";
  if (out.mode === "shell") {
    const innerMin = minOuter - out.wall;
    // a "follow" hole is the plain section (no ribs) scaled to topHole, so it only has to clear the inner wall at the top,
    // where the ribs and lobes may dip below the base profile
    const holeMax =
      out.topHoleShape === "follow"
        ? out.radius * profileAt(out.profile, 1) - ribDepthBelowBase(out) - lobeDepthBelowBase(out, 1) - out.wall
        : innerMin;
    if (out.top > 0 && out.topHole >= holeMax - 0.5) out.topHole = Math.max(0, holeMax - 1);
    out.bottom = Math.min(out.bottom, out.height * 0.4);
    out.top = Math.min(out.top, out.height * 0.4);
  }
  // a dish must not sink through the floor (shell: the ceiling follows the dish)
  const domeRoom = out.mode === "solid" ? out.height : out.height - out.top - out.bottom;
  if (out.topDome < 0) out.topDome = Math.max(out.topDome, -Math.max(0, domeRoom * 0.8));
  // two pieces: the neck (and the chamfer below it) must fit between floor and ceiling and leave a cavity
  out.split = Math.min(1, Math.max(0, out.split));
  if (out.mode !== "shell" || out.split <= 0) {
    out.split = 0;
  } else {
    const lo = out.bottom + out.wall + out.splitGap + 1;
    const hi = out.height - out.top - out.splitLip - 0.5;
    const cavity = out.radius * minProfile - ribDepthBelowBase(out) - lobeDepthBelowBase(out) - 2 * out.wall - out.splitGap;
    if (hi <= lo || cavity < 1) out.split = 0;
    else out.split = Math.min(hi, Math.max(lo, out.split * out.height)) / out.height;
  }
  // slanted mouth: the rows are squeezed over SLANT_RAMP × the drop below the cut, which must stay above the floor and the joint
  out.slant = Math.min(Math.max(0, out.slant), Math.max(0, (slantTop(out) - slantFloor(out)) / SLANT_RAMP));
  if (out.slant < 0.01) out.slant = 0;
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

// ---------- holes in the wall ----------

/** A cut as the mesh uses it: centre in (u, real height mm), size in mm, depth 0 = through. */
export interface PlacedCut {
  source: number; // index in params.cuts
  shape: CutShape;
  u: number;
  z: number;
  w: number;
  h: number;
  depth: number;
}
export type CutProblem = "solid" | "edge" | "joint" | "wide" | "thin" | "overlap";

/** Which cuts can be made (and how), and why the others can't: they must sit on the wall, clear of each other. */
export function placeCuts(input: ShapeParams): { placed: PlacedCut[]; problems: (CutProblem | null)[] } {
  const p = sanitize(input);
  const H = p.height;
  const { thetaOf, uOf, total } = makeArcTable(2 + p.squareness * 10, 1024);
  // heights are real ones on the surface: under a slanted mouth the rim (and a closed top) sits lower on the low side
  const { wallZ } = wallModel(p);
  const realTop = (u: number, zNode: number) => wallZ(thetaOf(u), zNode);
  const placed: PlacedCut[] = [];
  const problems: (CutProblem | null)[] = [];
  const margin = 1;
  const halfH = (c: { shape: CutShape; w: number; h: number }) => (c.shape === "circle" ? c.w : c.h) / 2;
  for (let i = 0; i < p.cuts.length; i++) {
    const c = p.cuts[i];
    const w = Math.max(1, c.w);
    const h = c.shape === "circle" ? w : Math.max(1, c.h);
    const zc = c.z * H;
    const hh = h / 2;
    const perim = total * p.radius * Math.max(0.05, profileAt(p.profile, c.z));
    const depth = c.mode === "pocket" ? Math.min(c.depth, p.wall - 0.3) : 0;
    const lo = c.mode === "pocket" ? margin : p.bottom + margin;
    // through an open top it may run past the rim: it cuts a notch, as long as part of it is in the wall
    const notch = c.mode !== "pocket" && p.top <= 0;
    const zs = p.split * H;
    const u0 = c.u - Math.floor(c.u);
    const columns = c.mode === "both" ? [u0, uOf(thetaOf(u0) + Math.PI)] : [u0];
    const offEdge = (u: number) => {
      const rim = realTop(u, c.mode === "pocket" ? H : H - p.top);
      return zc - hh < lo || (notch ? zc - hh > rim - margin : zc + hh > rim - margin);
    };
    let problem: CutProblem | null = null;
    if (p.mode !== "shell") problem = "solid";
    else if (c.mode === "pocket" && depth < 0.2) problem = "thin";
    else if (columns.some(offEdge)) problem = "edge";
    else if (p.split > 0 && zc + hh > zs - p.wall - p.splitGap - margin && zc - hh < zs + p.splitLip + margin) problem = "joint";
    else if ((w + 1) / perim > 0.45) problem = "wide";
    const copies: PlacedCut[] = columns.map((u) => ({ source: i, shape: c.shape, u, z: zc, w, h, depth }));
    if (!problem) {
      const clash = (a: PlacedCut, b: PlacedCut) => {
        let du = Math.abs(a.u - b.u) % 1;
        du = Math.min(du, 1 - du) * perim;
        return du < (a.w + b.w) / 2 + 0.5 && Math.abs(a.z - b.z) < halfH(a) + halfH(b) + 0.5;
      };
      if (copies.length === 2 && clash(copies[0], copies[1])) problem = "wide";
      else if (copies.some((a) => placed.some((b) => clash(a, b)))) problem = "overlap";
    }
    problems.push(problem);
    if (!problem) placed.push(...copies);
  }
  return { placed, problems };
}

/** Outline of a cut in (u, z), CCW, centred on (u0, z0), with mm converted to u by the perimeter there. */
function cutOutline(c: PlacedCut, perim: number, u0: number, z0: number): [number, number][] {
  if (c.shape === "square") {
    const a = c.w / 2 / perim;
    const b = c.h / 2;
    const corners: [number, number][] = [
      [u0 - a, z0 - b],
      [u0 + a, z0 - b],
      [u0 + a, z0 + b],
      [u0 - a, z0 + b],
    ];
    // subdivided: the edges are straight on the real surface, not in the mesh's row heights
    const out: [number, number][] = [];
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e];
      const [bx, by] = corners[(e + 1) % 4];
      for (let k = 0; k < 16; k++) out.push([ax + ((bx - ax) * k) / 16, ay + ((by - ay) * k) / 16]);
    }
    return out;
  }
  const N = 64;
  return Array.from({ length: N }, (_, k): [number, number] => {
    const t = (k / N) * TWO_PI;
    return [u0 + (Math.cos(t) * c.w) / 2 / perim, z0 + (Math.sin(t) * c.w) / 2];
  });
}

/** Length of the squeeze below a slant-shifted zone, in units of the drop (> 1, so the rows stay in order). */
const SLANT_RAMP = 1.25;

/** Height (at the high side) where the slant shifts the object rigidly: the ceiling of a closed top, else the top. */
function slantTop(p: ShapeParams): number {
  return p.mode === "shell" ? p.height - p.top : p.height;
}

/** Lowest height the slant may reshape: above the floor and the joint of a two-piece design. */
function slantFloor(p: ShapeParams): number {
  return Math.max(p.mode === "shell" ? p.bottom : 0, p.split > 0 ? p.split * p.height + p.splitLip : 0) + 1;
}

export type Part = "whole" | "body" | "top";

/** Is the (sanitized) design cut in two pieces? */
export function hasSplit(p: ShapeParams): boolean {
  return p.mode === "shell" && p.split > 0;
}

/** Preview / single-file geometry: the whole object, or both pieces assembled in place. */
export function buildGeometry(input: ShapeParams): THREE.BufferGeometry {
  const p = sanitize(input);
  if (!hasSplit(p)) return build(p, "whole");
  return mergeGeometries([build(p, "body"), build(p, "top")]);
}

/** The two pieces of a split design, or null when it is a single piece. */
export function buildParts(input: ShapeParams): { body: THREE.BufferGeometry; top: THREE.BufferGeometry } | null {
  const p = sanitize(input);
  if (!hasSplit(p)) return null;
  return { body: build(p, "body"), top: build(p, "top") };
}

export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const g of geos) {
    const base = positions.length / 3;
    const pos = g.getAttribute("position").array;
    for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
    const idx = g.index!.array;
    for (let i = 0; i < idx.length; i++) indices.push(idx[i] + base);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

/** The wall as a function of (u, z): everything the mesh needs to place a vertex on the outer or inner surface. */
function wallModel(p: ShapeParams) {
  const H = p.height;
  const R = effectiveRadialSegments(p);
  const n = 2 + p.squareness * 10;
  const { thetaOf, uOf, total: arcTotal } = makeArcTable(n);
  const rotAt = (z: number) => twistAt(p, z / H);

  const fade = Math.max(0.01, p.ribFade);
  const zs = p.ribStart * H;
  const ze = p.ribEnd * H;
  const hasRibs = p.ribCount > 0 && p.ribAmplitude !== 0;

  // --- slanted mouth: a plane drops `slant` mm towards slantAngle. Above zHi the wall rows are shifted down by the
  // plane (below zHi - SLANT_RAMP·slant they stay put, in between they are squeezed progressively). The shape is evaluated at the
  // shifted height, so the wall stays the same surface (a true cut), but the rib band is evaluated at the row's own
  // height: its edges above zHi run parallel to the cut instead of level. zHi is the lowest rib edge with room for the
  // squeeze above the floor (and the joint of a two-piece design), or the top itself ---
  const hasSlant = p.slant > 0;
  const zt = slantTop(p);
  let zHi = zt;
  if (hasSlant && hasRibs) {
    const edges = [p.ribStart > 0 ? zs - fade / 2 : Infinity, p.ribEnd < 1 ? ze - fade / 2 : Infinity];
    for (const e of edges) if (e - 0.5 - SLANT_RAMP * p.slant >= slantFloor(p)) zHi = Math.min(zHi, e - 0.5);
  }
  const zc = zHi - SLANT_RAMP * p.slant;
  const slantDir = (p.slantAngle * Math.PI) / 180;
  const sdx = Math.cos(slantDir);
  const sdy = Math.sin(slantDir);
  let maxProj = 1;
  if (hasSlant) {
    for (let k = 0; k < 720; k++) {
      const [x, y] = superellipse((k / 720) * TWO_PI, n);
      maxProj = Math.max(maxProj, x * sdx + y * sdy);
    }
  }
  /** Drop (0 … slant) for a unit-section direction (bx, by), or a point at that distance across the section. */
  const dropAt = (proj: number) => Math.min(p.slant, Math.max(0, (p.slant * (1 + proj / maxProj)) / 2));
  /** Height a wall column at angle theta is evaluated at, for a node at z. */
  const wallZ = (theta: number, z: number) => {
    if (!hasSlant || z <= zc) return z;
    const w = Math.min(1, (z - zc) / (zHi - zc));
    let zz = z;
    for (let k = 0; k < 3; k++) {
      const [bx, by] = superellipse(theta + rotAt(zz), n);
      zz = z - w * dropAt(bx * sdx + by * sdy);
    }
    return zz;
  };
  const plateA = p.radius * profileAt(p.profile, 1);
  /** Top plate vertices (dome, hole, centre) move rigidly with the plane, by their position across the section. */
  const plateZ = (x: number, y: number, z: number) => (hasSlant && z >= zt - 1e-9 ? z - dropAt((x * sdx + y * sdy) / plateA) : z);
  const ribOffset = p.ribAlign === "crest" ? -1 : p.ribAlign === "valley" ? 1 : 0;
  const hasLobes = p.lobeCount > 0 && p.lobeAmplitude !== 0;
  /** Lobes are part of the section (mm, along the base direction): both surfaces follow them, unlike the ribs. (A square
   * lobe shares the ribs' sharpness.) */
  const lobe = (u: number, z: number) =>
    hasLobes ? p.lobeAmplitude * lobeEnvelope(p, z / H) * wave(p.lobeWaveform, p.lobeCount * u, p.ribSharpness) : 0;

  // inner surface: blend between "follows the ribs" (constant wall) and "smooth section" (wall measured at the deepest
  // valley). The smooth section stays at that depth outside the rib band too, so the inside runs on without a step where
  // the ribs start or end, and the plain zones get thicker by however far the alignment puts the valleys below the profile
  const ribDepth = ribDepthBelowBase(p);
  const innerScale = (u: number, z: number, env: number, bx: number, by: number) => {
    const outer = outerScale(u, z, env, bx, by);
    const k = p.innerRib;
    const smooth = p.radius * profileAt(p.profile, z / H) + lobe(u, z) / (Math.hypot(bx, by) || 1) - ribDepth;
    return Math.max(0.3, k * outer + (1 - k) * smooth - p.wall);
  };

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
    let rib = lobe(u, z);
    if (hasRibs && env > 0) {
      // wave is in [-1, 1]; the offset (scaled by the envelope too, so the smooth zone blends into it) anchors
      // the crest or the valley to the base profile instead of the midline
      const w = Math.sign(p.ribAmplitude) * wave(p.ribWaveform, p.ribCount * u, p.ribSharpness);
      rib += Math.abs(p.ribAmplitude) * env * (w + ribOffset);
    }
    // normalise so the rib and lobe amplitudes are in mm even on the corners of a square-ish section
    const len = Math.hypot(bx, by) || 1;
    return base + rib / len;
  };

  /** Vertex on the outer / inner surface (or `off` mm further in) at arc fraction u and row height z. */
  const wallVertex = (kind: "outer" | "inner", u: number, zNode: number, off = 0, theta = thetaOf(u)): [number, number, number] => {
    const z = wallZ(theta, zNode);
    const env = envelope(zNode);
    const [bx, by] = superellipse(theta + rotAt(z), n);
    const s0 = kind === "inner" ? innerScale(u, z, env, bx, by) : outerScale(u, z, env, bx, by);
    const s = off !== 0 ? Math.max(0.3, s0 - off) : s0;
    return [bx * s, by * s, z];
  };
  /** Perimeter (mm) of the plain section at row height z: converts mm along the surface into u. */
  const perimeterAt = (zNode: number) => arcTotal * p.radius * Math.max(0.05, profileAt(p.profile, zNode / H));
  /** Arc fraction and (real) height of a point on the outer surface (model coordinates). */
  const locate = (x: number, y: number, z: number): { u: number; z: number } => ({ u: uOf(Math.atan2(y, x) - rotAt(z)), z });
  /** Row height whose wall sits at real height z in column u (they differ under a slanted mouth, where rows are shifted and squeezed). */
  const nodeZ = (u: number, z: number) => {
    if (!hasSlant) return z;
    const theta = thetaOf(u);
    let lo = -H;
    let hi = 3 * H;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (wallZ(theta, mid) < z) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  /** Point just clear of the outer surface, over the rib crests (no ribs: a smooth surface for drawing on). */
  const overVertex = (u: number, zNode: number, lift: number): [number, number, number] => {
    const theta = thetaOf(u);
    const z = wallZ(theta, zNode);
    const [bx, by] = superellipse(theta + rotAt(z), n);
    const crest = hasRibs ? Math.abs(p.ribAmplitude) * envelope(zNode) * (1 + ribOffset) : 0;
    const s = outerScale(u, z, 0, bx, by) + (crest + lift) / (Math.hypot(bx, by) || 1);
    return [bx * s, by * s, z];
  };
  /** Distance from the axis of the smooth surface over the ribs, in direction phi at height z (model coordinates). */
  const reachAt = (phi: number, z: number) => {
    const theta = phi - rotAt(z);
    const u = uOf(theta);
    const [bx, by] = superellipse(theta, n);
    const len = Math.hypot(bx, by) || 1;
    const crest = hasRibs ? Math.abs(p.ribAmplitude) * envelope(z) * (1 + ribOffset) : 0;
    return (outerScale(u, z, 0, bx, by) + crest / len) * len;
  };
  /** First point where a ray (model coordinates) meets the smooth outer surface, as (u, row height); null if it misses. */
  const raycast = (o: [number, number, number], d: [number, number, number]): { u: number; z: number } | null => {
    const dl = Math.hypot(d[0], d[1], d[2]) || 1;
    const dir = [d[0] / dl, d[1] / dl, d[2] / dl];
    const at = (t: number): [number, number, number] => [o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t];
    const inside = (q: [number, number, number]) => q[2] >= 0 && q[2] <= H && Math.hypot(q[0], q[1]) <= reachAt(Math.atan2(q[1], q[0]), q[2]);
    const far = Math.hypot(o[0], o[1], o[2] - H / 2) + H + 4 * p.radius;
    let prev = 0;
    for (let t = 0; t <= far; t += 0.5) {
      if (!inside(at(t))) {
        prev = t;
        continue;
      }
      let lo = prev;
      let hi = t;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (inside(at(mid))) hi = mid;
        else lo = mid;
      }
      const q = at(hi);
      return locate(q[0], q[1], q[2]);
    }
    return null;
  };
  /** The column straight across the section (where a hole through both sides comes out). */
  const opposite = (u: number) => uOf(thetaOf(u) + Math.PI);
  return { H, R, n, thetaOf, rotAt, envelope, extras, outerScale, innerScale, wallZ, plateZ, wallVertex, perimeterAt, locate, nodeZ, opposite, overVertex, raycast };
}

/** The outer surface as (u, row height) ⇄ model coordinates, for placing holes from the 3D view. */
export function wallSurface(input: ShapeParams) {
  const m = wallModel(sanitize(input));
  return {
    height: m.H,
    /** Point on the outer surface at real height z (`off` mm inwards; negative = outwards). */
    point: (u: number, z: number, off = 0) => m.wallVertex("outer", u, m.nodeZ(u, z), off),
    /** Point `lift` mm clear of the rib crests: smooth, for outlines and markers. */
    over: (u: number, z: number, lift = 0.4) => m.overVertex(u, m.nodeZ(u, z), lift),
    perimeterAt: m.perimeterAt,
    locate: m.locate,
    opposite: m.opposite,
    raycast: m.raycast,
  };
}

function build(p: ShapeParams, part: Part): THREE.BufferGeometry {
  const { H, R, n, thetaOf, rotAt, envelope, extras, outerScale, innerScale, plateZ, wallVertex, perimeterAt, nodeZ } = wallModel(p);

  // --- top plate: flat rim as wide as the wall, then a spherical cap (dome or dish) down to the hole / centre ---
  const hasHole = p.mode === "shell" && p.top > 0 && p.topHole > 0.01;
  const holeKind: NodeKind = p.topHoleShape === "follow" ? "hole" : "fixed";
  const rimW = p.mode === "shell" ? p.wall : 0;
  const hasDome = (p.mode === "solid" || p.top > 0) && Math.abs(p.topDome) >= 0.01;
  const domeA = Math.max(1, p.radius * profileAt(p.profile, 1) - rimW); // mean radius where the cap starts (mm)
  const rhoH = hasHole ? Math.min(0.999, p.topHole / domeA) : 0;
  /** Height of the cap above the flat rim at normalised radius rho (1 = rim, 0 = centre). */
  const domeZ = (rho: number) => {
    if (!hasDome) return 0;
    const d = Math.abs(p.topDome);
    const rc = (domeA * domeA + d * d) / (2 * d); // sphere radius through the rim circle and the apex
    const r = rho * domeA;
    return Math.sign(p.topDome) * (Math.sqrt(Math.max(0, rc * rc - r * r)) - (rc - d));
  };
  const DOME_STEPS = 24;
  /** Rings from the rim (rho = 1) towards the hole/centre; the hole/centre node itself is added by the caller. */
  const domeRings = (zBase: number, surface: string): Node[] =>
    hasDome
      ? Array.from({ length: DOME_STEPS }, (_, k) => ({ kind: "dome" as const, z: zBase, rho: 1 - (1 - rhoH) * (k / DOME_STEPS), surface }))
      : [];


  // --- build loops of nodes ---
  const loops: Node[][] = [];
  const segs = (z0: number, z1: number) => Math.max(2, Math.round((p.heightSegments * (z1 - z0)) / H));
  const outerWall = (z0: number, z1: number): Node[] =>
    zStations(z0, z1, segs(z0, z1), extras).map((z) => ({ kind: "outer", z, surface: "outer" }));

  const zi1 = H - p.top;
  /** Outer edge at H → flat rim → cap → hole edge / apex. */
  const topFace = (): Node[] => {
    const nodes: Node[] = [{ kind: "outer", z: H, surface: "top" }];
    if (hasDome) {
      const rings = domeRings(H, "dome");
      if (rimW > 0) nodes.push({ ...rings[0], surface: "top" }); // crease where the flat rim meets the cap
      else rings.shift(); // no rim: the cap starts right at the outer edge
      nodes.push(...rings);
    }
    const surface = hasDome ? "dome" : "top";
    if (hasHole) nodes.push({ kind: holeKind, z: H + domeZ(rhoH), r: p.topHole, surface });
    else nodes.push({ kind: "center", z: H + domeZ(0), surface });
    return nodes;
  };
  /** Hole edge / apex of the ceiling → cap (same curve, offset by the plate thickness) → inner wall at zi1. */
  const ceilingFace = (): Node[] => {
    const nodes: Node[] = hasHole
      ? [{ kind: holeKind, z: zi1 + domeZ(rhoH), r: p.topHole, surface: "ceiling" }]
      : [{ kind: "center", z: zi1 + domeZ(0), surface: "ceiling" }];
    nodes.push(...domeRings(zi1, "ceiling").slice(1).reverse()); // rho = 1 coincides with inner@zi1
    nodes.push({ kind: "inner", z: zi1, surface: "ceiling" });
    return nodes;
  };

  if (p.mode === "solid") {
    loops.push([{ kind: "center", z: 0, surface: "bottom" }, { kind: "outer", z: 0, surface: "bottom" }, ...outerWall(0, H), ...topFace()]);
  } else {
    const zi0 = p.bottom;
    const innerWallDown = (z0: number, z1: number): Node[] =>
      zStations(z0, z1, segs(z0, z1), extras)
        .reverse()
        .map((z) => ({ kind: "inner", z, surface: "inner" }));

    // top section: from outer@H down to inner@zi1
    let topSection: Node[];
    if (p.top <= 0) {
      topSection = [
        { kind: "outer", z: H, surface: "rim" },
        { kind: "inner", z: H, surface: "rim" },
      ];
    } else if (hasHole) {
      const dzh = domeZ(rhoH);
      topSection = [
        ...topFace(),
        { kind: holeKind, z: H + dzh, r: p.topHole, surface: "holewall" },
        { kind: holeKind, z: zi1 + dzh, r: p.topHole, surface: "holewall" },
        ...ceilingFace(),
      ];
    } else {
      // closed top: the cavity is its own closed surface; centre→centre pairs are simply not stitched
      topSection = [...topFace(), ...ceilingFace()];
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

    if (part === "whole") {
      loops.push([...bottomNodesStart, ...outerWall(0, H), ...topSection, ...innerWallDown(zi0, zi1), ...bottomNodesEnd]);
    } else {
      // two pieces: the body ends in a neck set in by (wall + gap) that the top's skirt slides over
      const zs = p.split * H;
      const L = p.splitLip;
      const g = p.splitGap;
      const c = p.wall + g; // neck inset, also the height of the 45° chamfer inside the body
      if (part === "top") {
        loops.push([
          { kind: "inner", z: zs, surface: "seat" },
          { kind: "outer", z: zs, surface: "seat" },
          ...outerWall(zs, H),
          ...topSection,
          ...innerWallDown(zs, zi1),
        ]);
      } else {
        const neck = zStations(zs, zs + L, segs(zs, zs + L), extras);
        loops.push([
          ...bottomNodesStart,
          ...outerWall(0, zs),
          { kind: "outer", z: zs, surface: "shoulder" },
          { kind: "offset", z: zs, off: g, surface: "shoulder" },
          ...neck.map((z): Node => ({ kind: "offset", z, off: g, surface: "neck" })),
          { kind: "offset", z: zs + L, off: g, surface: "necktop" },
          { kind: "offset", z: zs + L, off: c, surface: "necktop" },
          ...neck
            .slice()
            .reverse()
            .map((z): Node => ({ kind: "offset", z, off: c, surface: "neckin" })),
          { kind: "offset", z: zs, off: c, surface: "chamfer" },
          { kind: "inner", z: zs - c, surface: "chamfer" },
          ...innerWallDown(zi0, zs - c),
          ...bottomNodesEnd,
        ]);
      }
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
      positions.push(0, 0, plateZ(0, 0, node.z));
      return { start, center: true, key: `c:${node.z.toFixed(5)}` };
    }
    if (node.kind === "fixed") {
      const r = node.r ?? 0;
      for (let i = 0; i < R; i++) positions.push(r * cosT[i], r * sinT[i], plateZ(r * cosT[i], r * sinT[i], node.z));
      return { start, center: false, key: `f:${r.toFixed(5)}:${node.z.toFixed(5)}` };
    }
    if (node.kind === "dome") {
      // ring of the cap: each column blends from the rim line (inner wall at zBase) towards the hole edge / centre
      const rho = node.rho ?? 1;
      const zb = node.z;
      const env = envelope(zb);
      const rot = rotAt(zb);
      const t = (1 - rho) / (1 - rhoH);
      const rotH = rotAt(zb + domeZ(rhoH));
      const z = zb + domeZ(rho);
      for (let i = 0; i < R; i++) {
        const [bx, by] = superellipse(thetas[i] + rot, n);
        const s1 = rimW > 0 ? innerScale(i / R, zb, env, bx, by) : outerScale(i / R, zb, env, bx, by);
        const x1 = bx * s1;
        const y1 = by * s1;
        let xh = 0;
        let yh = 0;
        if (hasHole) {
          if (holeKind === "fixed") {
            xh = p.topHole * cosT[i];
            yh = p.topHole * sinT[i];
          } else {
            const [hx, hy] = superellipse(thetas[i] + rotH, n);
            xh = hx * p.topHole;
            yh = hy * p.topHole;
          }
        }
        const x = x1 + (xh - x1) * t;
        const y = y1 + (yh - y1) * t;
        positions.push(x, y, plateZ(x, y, z));
      }
      return { start, center: false, key: `d:${zb.toFixed(5)}:${rho.toFixed(6)}` };
    }
    for (let i = 0; i < R; i++) {
      if (node.kind === "hole") {
        // the section's squareness and twist, but none of the ribs: half-width = topHole
        const [bx, by] = superellipse(thetas[i] + rotAt(node.z), n);
        const x = bx * p.topHole;
        const y = by * p.topHole;
        positions.push(x, y, plateZ(x, y, node.z));
        continue;
      }
      const v = node.kind === "outer" ? wallVertex("outer", i / R, node.z, 0, thetas[i]) : wallVertex("inner", i / R, node.z, node.kind === "offset" ? (node.off ?? 0) : 0, thetas[i]);
      positions.push(v[0], v[1], v[2]);
    }
    const z = node.z;
    const off = node.kind === "offset" ? `:${(node.off ?? 0).toFixed(4)}` : "";
    return { start, center: false, key: `${node.kind}${off}:${z.toFixed(5)}` };
  };

  // ---------- holes: per wall surface, the cells each cut touches and how the outline crosses them ----------
  type Surf = "outer" | "inner";
  const allCuts = p.mode === "shell" ? placeCuts(p).placed : [];
  interface CutPlan {
    c: PlacedCut;
    u0: number;
    z0: number; // row height of the centre
    poly: { u: number; z: number }[];
    pts: Partial<Record<Surf, PPoint[]>>;
  }
  interface CellPlan extends CellChords {
    surf: Surf;
  }
  let plans: CutPlan[] = [];
  let rimTop: number | null = null; // height of an open rim the cuts may notch
  let stations: Record<Surf, number[]> = { outer: [], inner: [] };
  let cells = new Map<string, CellPlan>(); // `${surf}:${band}:${column}`
  const vcache = new Map<string, number>();

  const planCuts = (loop: Node[]) => {
    plans = [];
    cells = new Map();
    vcache.clear();
    if (allCuts.length === 0) return;
    const st = (surf: Surf) => [...new Set(loop.filter((nd) => nd.surface === surf && nd.kind === surf).map((nd) => nd.z))].sort((x, y) => x - y);
    stations = { outer: st("outer"), inner: st("inner") };
    rimTop = loop.some((nd) => nd.surface === "rim") ? H : null;
    /** The outline drawn at real heights, taken to row heights column by column (a circle stays a circle on the surface). */
    const toRows = (outline: [number, number][]): [number, number][] => outline.map(([u, z]) => [u, nodeZ(u, z)]);
    const fits = (outline: [number, number][], depth: number, surf: Surf) => {
      const ss = stations[surf];
      const zs = outline.map((q) => q[1]);
      const lo = Math.min(...zs);
      const hi = Math.max(...zs);
      const top = ss[ss.length - 1];
      const overTop = depth === 0 && rimTop !== null && Math.abs(top - rimTop) < 1e-6 && lo < top - 0.5;
      return ss.length > 1 && lo > ss[0] + 0.5 && (hi < top - 0.5 || overTop);
    };
    for (const c of allCuts) {
      const perim = perimeterAt(c.z);
      const probe = toRows(cutOutline(c, perim, c.u, c.z));
      if (!fits(probe, c.depth, "outer") || (c.depth === 0 && !fits(probe, c.depth, "inner"))) continue;
      const surfs: Surf[] = c.depth === 0 ? ["outer", "inner"] : ["outer"];
      // nudge the outline by a hair if it would cross the grid right at a corner (degenerate cells)
      for (let attempt = 0; attempt < 16; attempt++) {
        const u0 = c.u + (attempt * 2.9e-4) / perim;
        const z0 = c.z + attempt * 3.7e-4;
        const outline = toRows(cutOutline(c, perim, u0, z0));
        const pts: CutPlan["pts"] = {};
        for (const sf of surfs) pts[sf] = splitOutline(outline, R, stations[sf]);
        if (attempt < 15 && surfs.some((sf) => isDegenerate(pts[sf]!, R, stations[sf], perim))) continue;
        plans.push({ c, u0, z0: nodeZ(u0, z0), poly: outline.map(([u, z]) => ({ u, z })), pts });
        break;
      }
    }
    plans.forEach((plan, ci) => {
      for (const surf of Object.keys(plan.pts) as Surf[]) {
        const P = plan.pts[surf]!;
        const ss = stations[surf];
        const cell = (k: number, j: number) => {
          const i = ((k % R) + R) % R;
          const key = `${surf}:${j}:${i}`;
          let cp = cells.get(key);
          if (!cp) cells.set(key, (cp = { surf, chords: [], loops: [] }));
          return { cp, shift: (i - k) / R };
        };
        // every cell under the cut's box, so the ones wholly inside are visited too
        const us = plan.poly.map((q) => q.u);
        const zz = plan.poly.map((q) => q.z);
        const j0 = lowerBound(ss, Math.min(...zz)) - 1;
        const j1 = lowerBound(ss, Math.max(...zz));
        for (let k = Math.floor(Math.min(...us) * R); k <= Math.floor(Math.max(...us) * R); k++) for (let j = j0; j < Math.min(j1, ss.length - 1); j++) cell(k, j);
        const cpt = (q: PPoint, idx: number, shift: number): CellPt => ({ u: q.u + shift, z: q.z, cut: ci, idx });
        const bandOf = (a: PPoint, b: PPoint) => lowerBound(ss, (a.z + b.z) / 2) - 1;
        const cellOf = (a: PPoint, b: PPoint) => cell(Math.floor(((a.u + b.u) / 2) * R), bandOf(a, b));
        const first = P.findIndex((q) => q.vline !== undefined || q.hline !== undefined);
        if (first < 0) {
          const { cp, shift } = cellOf(P[0], P[1]);
          cp.loops.push(P.map((q, idx) => cpt(q, idx, shift)));
          continue;
        }
        let run = [first];
        for (let m = 0; m < P.length; m++) {
          const ia = (first + m) % P.length;
          const ib = (ia + 1) % P.length;
          run.push(ib);
          const b = P[ib];
          if (b.vline !== undefined || b.hline !== undefined) {
            // the stretch over an open rim (a notch) is not on the wall
            if (bandOf(P[run[0]], P[run[1]]) < ss.length - 1) {
              const { cp, shift } = cellOf(P[run[0]], P[run[1]]);
              cp.chords.push(run.map((idx) => cpt(P[idx], idx, shift)));
            }
            run = [ib];
          }
        }
      }
    });
  };

  const insideCut = (surf: Surf, u: number, z: number): number => {
    for (let ci = 0; ci < plans.length; ci++) {
      const pl = plans[ci];
      if (!pl.pts[surf]) continue;
      if (insidePolygon(pl.poly, u + Math.round(pl.u0 - u), z)) return ci;
    }
    return -1;
  };

  const vid = (key: string, make: () => [number, number, number]) => {
    let v = vcache.get(key);
    if (v === undefined) {
      v = positions.length / 3;
      positions.push(...make());
      vcache.set(key, v);
    }
    return v;
  };

  /** Triangulates a region of a cell and emits it, facing the same way as the regular wall there (sign of the area in u, z). */
  const emitRegion = (r: Region, sign: number, resolve: (q: CellPt) => number) => {
    const scale = TWO_PI * p.radius;
    const contour = r.contour.map((q) => new THREE.Vector2(q.u * scale, q.z));
    const holes = r.holes.map((h) => h.map((q) => new THREE.Vector2(q.u * scale, q.z)));
    const all = [...r.contour, ...r.holes.flat()];
    const allV = [...contour, ...holes.flat()];
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, holes)) {
      const area = (allV[b].x - allV[a].x) * (allV[c].y - allV[a].y) - (allV[c].x - allV[a].x) * (allV[b].y - allV[a].y);
      const [x, y] = area * sign >= 0 ? [b, c] : [c, b];
      indices.push(resolve(all[a]), resolve(all[x]), resolve(all[y]));
    }
  };

  /** Wall rows a → b with holes in the band between them: the cells they touch are split, the rest stitched as usual. */
  const stitchCut = (a: Row, b: Row, surf: Surf, za: number, zb: number) => {
    const lo = za < zb ? a : b;
    const hi = za < zb ? b : a;
    const zlo = Math.min(za, zb);
    const zhi = Math.max(za, zb);
    const band = lowerBound(stations[surf], zlo);
    const sign = Math.sign(zb - za);
    for (let i = 0; i < R; i++) {
      const j = (i + 1) % R;
      const cp = cells.get(`${surf}:${band}:${i}`);
      if (!cp) {
        indices.push(a.start + i, a.start + j, b.start + j);
        indices.push(a.start + i, b.start + j, b.start + i);
        continue;
      }
      const { keep, cut } = splitCell({ u0: i / R, u1: (i + 1) / R, zlo, zhi }, cp, (u, z) => insideCut(surf, u, z) >= 0);
      const resolve = (off: number) => (q: CellPt) => {
        if (q.corner !== undefined) {
          const row = q.corner < 2 ? lo : hi;
          const col = q.corner === 0 || q.corner === 3 ? i : j;
          if (off === 0) return row.start + col;
          return vid(`c:${row.start}:${col}:${off}`, () => wallVertex(surf, col / R, q.corner! < 2 ? zlo : zhi, off, thetas[col]));
        }
        const pl = plans[q.cut!];
        const pt = pl.pts[surf]![q.idx!];
        return vid(`p:${surf}:${q.cut}:${q.idx}:${off}`, () => wallVertex(surf, pt.u, pt.z, off));
      };
      for (const r of keep) emitRegion(r, sign, resolve(0));
      for (const r of cut) {
        const q = r.contour.find((x) => x.cut !== undefined);
        const ci = q ? q.cut! : insideCut(surf, (r.contour[0].u + r.contour[2].u) / 2, (zlo + zhi) / 2);
        const depth = ci >= 0 ? plans[ci].c.depth : 0;
        if (depth > 0) emitRegion(r, sign, resolve(depth)); // the floor of a pocket
      }
    }
  };

  /** Where a cut notches the open rim: the two points on the rim (index in the outline points), in u order. */
  const notchOf = (pl: CutPlan, surf: Surf): [number, number] | null => {
    const P = pl.pts[surf];
    if (rimTop === null || !P) return null;
    const at = P.flatMap((q, idx) => (q.hline !== undefined && Math.abs(q.z - rimTop!) < 1e-9 ? [idx] : []));
    if (at.length !== 2) return null;
    return P[at[0]].u <= P[at[1]].u ? [at[0], at[1]] : [at[1], at[0]];
  };

  /** The open rim (outer → inner at the top) with the notches taken out of it. */
  const stitchRim = (a: Row, b: Row, zTop: number) => {
    const notches = plans.flatMap((pl, ci) => {
      const no = notchOf(pl, "outer");
      const ni = notchOf(pl, "inner");
      if (!no || !ni) return [];
      const Po = pl.pts.outer!;
      const Pi = pl.pts.inner!;
      return [
        {
          u0: Po[no[0]].u,
          u1: Po[no[1]].u,
          o0: vid(`p:outer:${ci}:${no[0]}:0`, () => wallVertex("outer", Po[no[0]].u, zTop)),
          o1: vid(`p:outer:${ci}:${no[1]}:0`, () => wallVertex("outer", Po[no[1]].u, zTop)),
          i0: vid(`p:inner:${ci}:${ni[0]}:0`, () => wallVertex("inner", Pi[ni[0]].u, zTop)),
          i1: vid(`p:inner:${ci}:${ni[1]}:0`, () => wallVertex("inner", Pi[ni[1]].u, zTop)),
        },
      ];
    });
    for (let i = 0; i < R; i++) {
      const j = (i + 1) % R;
      // pieces of [i/R, (i+1)/R] outside every notch, each end either the column or a notch side
      let pieces: { ua: number; ub: number; oa: number; ob: number; ia: number; ib: number }[] = [{ ua: i / R, ub: (i + 1) / R, oa: a.start + i, ob: a.start + j, ia: b.start + i, ib: b.start + j }];
      for (const nt of notches) {
        const shift = Math.round(i / R - (nt.u0 + nt.u1) / 2);
        const n0 = nt.u0 + shift;
        const n1 = nt.u1 + shift;
        pieces = pieces.flatMap((pc) => {
          if (n1 <= pc.ua || n0 >= pc.ub) return [pc];
          const out = [];
          if (n0 > pc.ua) out.push({ ...pc, ub: n0, ob: nt.o0, ib: nt.i0 });
          if (n1 < pc.ub) out.push({ ...pc, ua: n1, oa: nt.o1, ia: nt.i1 });
          return out;
        });
      }
      for (const pc of pieces) {
        indices.push(pc.oa, pc.ob, pc.ib);
        indices.push(pc.oa, pc.ib, pc.ia);
      }
    }
  };

  /** The side of each hole: outer ring to inner ring (through), or outer ring to the pocket floor. A notch is open at the rim. */
  const cutWalls = () => {
    plans.forEach((pl, ci) => {
      const { c } = pl;
      const through = c.depth === 0;
      /** The outline points on the wall, in order: all of them, or from one rim point round the bottom to the other. */
      const onWall = (surf: Surf) => {
        const P = pl.pts[surf]!;
        const all = P.map((q, idx) => ({ q, idx, t: q.t }));
        const nt = notchOf(pl, surf);
        if (!nt) return { open: false, list: all };
        // walk from the rim point where the outline dives into the wall (the next point is below the rim)
        const start = P[(nt[0] + 1) % P.length].z < rimTop! ? nt[0] : nt[1];
        const list = [];
        for (let m = 0; m < P.length; m++) {
          const idx = (start + m) % P.length;
          list.push({ q: P[idx], idx, t: P[idx].t + (idx < start ? 1 : 0) });
          if (m > 0 && P[idx].hline !== undefined && Math.abs(P[idx].z - rimTop!) < 1e-9) break;
        }
        return { open: true, list };
      };
      const wa = onWall("outer");
      const ringA = wa.list.map(({ q, idx, t }) => ({ t, v: vid(`p:outer:${ci}:${idx}:0`, () => wallVertex("outer", q.u, q.z)) }));
      const wb = through ? onWall("inner") : wa;
      const ringB = wb.list.map(({ q, idx, t }) => ({
        t,
        v: through ? vid(`p:inner:${ci}:${idx}:0`, () => wallVertex("inner", q.u, q.z)) : vid(`p:outer:${ci}:${idx}:${c.depth}`, () => wallVertex("outer", q.u, q.z, c.depth)),
      }));
      const open = wa.open;
      const o = new THREE.Vector3(...wallVertex("outer", pl.u0, pl.z0));
      const e = new THREE.Vector3(...(through ? wallVertex("inner", pl.u0, pl.z0) : wallVertex("outer", pl.u0, pl.z0, c.depth)));
      const axis = e.clone().sub(o).normalize();
      const P = (v: number) => new THREE.Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const tri = (x: number, y: number, z: number) => {
        const a = P(x);
        const n = P(y).sub(a).cross(P(z).sub(a));
        const cen = a.add(P(y)).add(P(z)).multiplyScalar(1 / 3);
        const toAxis = o.clone().add(axis.clone().multiplyScalar(cen.clone().sub(o).dot(axis))).sub(cen);
        if (n.dot(toAxis) >= 0) indices.push(x, y, z);
        else indices.push(x, z, y);
      };
      // zip the two rings together by position along the outline (a notch: two open strips, end to end)
      let ia = 0;
      let ib = 0;
      const na = open ? ringA.length - 1 : ringA.length;
      const nb = open ? ringB.length - 1 : ringB.length;
      const tA = (k: number) => (open ? ringA[k].t : ringA[k % na].t + Math.floor(k / na));
      const tB = (k: number) => (open ? ringB[k].t : ringB[k % nb].t + Math.floor(k / nb));
      while (ia < na || ib < nb) {
        const advanceA = ib >= nb || (ia < na && tA(ia + 1) <= tB(ib + 1));
        const A = (k: number) => ringA[open ? k : k % na].v;
        const B = (k: number) => ringB[open ? k : k % nb].v;
        if (advanceA) {
          tri(A(ia), A(ia + 1), B(ib));
          ia++;
        } else {
          tri(A(ia), B(ib + 1), B(ib));
          ib++;
        }
      }
    });
  };

  const stitch = (a: Row, b: Row, na: Node, nb: Node) => {
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
    if (plans.length > 0 && na.surface === "rim" && nb.surface === "rim" && na.kind === "outer" && nb.kind === "inner") {
      stitchRim(a, b, na.z);
      return;
    }
    if (plans.length > 0 && na.surface === nb.surface && (na.surface === "outer" || na.surface === "inner") && na.kind === na.surface && nb.kind === na.surface) {
      stitchCut(a, b, na.surface, na.z, nb.z);
      return;
    }
    for (let i = 0; i < R; i++) {
      const j = (i + 1) % R;
      indices.push(a.start + i, a.start + j, b.start + j);
      indices.push(a.start + i, b.start + j, b.start + i);
    }
  };

  for (const loop of loops) {
    planCuts(loop);
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
      stitch(rows[k], rows[(k + 1) % rows.length], loop[k], loop[(k + 1) % loop.length]);
    }
    cutWalls();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

function sameNode(a: Node, b: Node) {
  return a.kind === b.kind && Math.abs(a.z - b.z) < 1e-6 && (a.r ?? 0) === (b.r ?? 0) && (a.rho ?? 0) === (b.rho ?? 0) && (a.off ?? 0) === (b.off ?? 0);
}

export function bounds(geo: THREE.BufferGeometry) {
  const bb = geo.boundingBox ?? new THREE.Box3().setFromBufferAttribute(geo.getAttribute("position") as THREE.BufferAttribute);
  return {
    x: bb.max.x - bb.min.x,
    y: bb.max.y - bb.min.y,
    z: bb.max.z - bb.min.z,
  };
}
