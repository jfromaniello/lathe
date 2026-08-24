import { buildGeometry, PRESETS, DEFAULT_PARAMS, type ShapeParams } from "../src/lib/shape";
import { exportParamsFor } from "../src/lib/export";

function check(name: string, p: ShapeParams) {
  const geo = buildGeometry({ ...p, radialSegments: 96, heightSegments: 40 });
  const rawIdx = geo.index!.array;
  const pos0 = geo.getAttribute("position").array as Float32Array;
  // weld by position (that's what slicers see in an STL)
  const weld = new Map<string, number>();
  const remap = new Int32Array(pos0.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const k = `${pos0[i*3].toFixed(4)},${pos0[i*3+1].toFixed(4)},${pos0[i*3+2].toFixed(4)}`;
    let w = weld.get(k);
    if (w === undefined) { w = i; weld.set(k, i); }
    remap[i] = w;
  }
  const idx = Array.from(rawIdx, (i) => remap[i]);
  const edges = new Map<string, number>(); // directed edge -> count
  let degenerate = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (a === b || b === c || a === c) degenerate++;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = `${u}>${v}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let unmatched = 0, dup = 0;
  for (const [k, n] of edges) {
    if (n !== 1) dup++;
    const [u, v] = k.split(">");
    if (!edges.has(`${v}>${u}`)) unmatched++;
  }
  // signed volume (should be positive for outward normals)
  const pos = geo.getAttribute("position").array as Float32Array;
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  const ok = unmatched === 0 && dup === 0 && degenerate === 0 && vol > 0;
  console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(34)} tris=${(idx.length / 3).toString().padStart(6)} unmatched=${unmatched} dup=${dup} degen=${degenerate} vol=${(vol / 1000).toFixed(1)}cm³`);
  return ok;
}

let all = true;
for (const pr of PRESETS) all = check(pr.name, pr.params) && all;
all = check("solid", { ...DEFAULT_PARAMS, mode: "solid" }) && all;
all = check("shell open/open", { ...DEFAULT_PARAMS, bottom: 0, top: 0 }) && all;
all = check("shell closed/closed (void)", { ...DEFAULT_PARAMS, bottom: 2, top: 2, topHole: 0 }) && all;
all = check("shell closed/closed+hole", { ...DEFAULT_PARAMS, bottom: 2, top: 2, topHole: 15 }) && all;
all = check("shell open bottom/closed top", { ...DEFAULT_PARAMS, bottom: 0, top: 2, topHole: 0 }) && all;
all = check("shell open bottom/top hole", { ...DEFAULT_PARAMS, bottom: 0, top: 2, topHole: 15 }) && all;
all = check("square twist ribs fade", { ...DEFAULT_PARAMS, squareness: 0.8, twist: 120, ribFade: 10, ribStart: 0.2, ribEnd: 0.8 }) && all;
all = check("export-res lamp", exportParamsFor(PRESETS[1].params)) && all;
process.exit(all ? 0 : 1);
