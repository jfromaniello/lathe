// Tiny software renderer: writes a PPM of the mesh (painter's algorithm, Lambert shading).
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { buildGeometry, PRESETS } from "../src/lib/shape";

const W = 420, H = 520;
function render(name: string, p: (typeof PRESETS)[0]["params"], file: string) {
  const geo = buildGeometry({ ...p, radialSegments: Number(process.env.RADIAL ?? 240), heightSegments: 120 });
  const pos = geo.getAttribute("position").array as Float32Array;
  const idx = geo.index!.array;
  // camera: rotate around X by -70deg (look slightly from above), then around Z by 30deg
  const az = Math.PI / 6, el = -Math.PI / 2 + 0.35;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const bb = geo.boundingBox!;
  const cz = (bb.max.z + bb.min.z) / 2;
  const scale = Math.min(W, H) * 0.8 / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) ;
  const proj = (i: number) => {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2] - cz;
    const x1 = x * ca - y * sa, y1 = x * sa + y * ca;
    const y2 = y1 * ce - z * se, z2 = y1 * se + z * ce;
    return [W / 2 + x1 * scale, H / 2 - y2 * scale, z2];
  };
  const L = [0.4, -0.5, 0.75]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const tris: { d: number; pts: number[][]; shade: number }[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const A = proj(a), B = proj(b), C = proj(c);
    // backface cull in screen space
    const cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (cross >= 0) continue;
    // normal in world
    const ax = pos[a*3], ay = pos[a*3+1], az2 = pos[a*3+2];
    const ux = pos[b*3]-ax, uy = pos[b*3+1]-ay, uz = pos[b*3+2]-az2;
    const vx = pos[c*3]-ax, vy = pos[c*3+1]-ay, vz = pos[c*3+2]-az2;
    let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx/=nl; ny/=nl; nz/=nl;
    const shade = 0.25 + 0.75 * Math.max(0, nx*L[0]+ny*L[1]+nz*L[2]);
    tris.push({ d: (A[2] + B[2] + C[2]) / 3, pts: [A, B, C], shade });
  }
  tris.sort((p, q) => p.d - q.d);
  const img = new Uint8Array(W * H * 3).fill(30);
  for (const tr of tris) {
    const [A, B, C] = tr.pts;
    const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const col = [239 * tr.shade, 233 * tr.shade, 223 * tr.shade];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = (B[0]-A[0])*(py-A[1]) - (B[1]-A[1])*(px-A[0]);
      const w1 = (C[0]-B[0])*(py-B[1]) - (C[1]-B[1])*(px-B[0]);
      const w2 = (A[0]-C[0])*(py-C[1]) - (A[1]-C[1])*(px-C[0]);
      if ((w0 <= 0 && w1 <= 0 && w2 <= 0) || (w0 >= 0 && w1 >= 0 && w2 >= 0)) {
        const o = (y * W + x) * 3; img[o] = col[0]; img[o+1] = col[1]; img[o+2] = col[2];
      }
    }
  }
  writeFileSync(file, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), Buffer.from(img)]));
  console.log("wrote", file, name, tris.length, "tris");
}
const out = process.argv[2];
if (process.env.PARAMS) {
  // render a single params JSON file: PARAMS=file.json tsx scripts/render.ts outdir
  render(process.env.PARAMS, JSON.parse(readFileSync(process.env.PARAMS, "utf8")), `${out}/custom.ppm`);
} else {
  PRESETS.forEach((p, i) => render(p.name, p.params, `${out}/preset${i}.ppm`));
}
