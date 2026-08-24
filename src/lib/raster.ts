import * as THREE from "three";
import { buildGeometry, effectiveRadialSegments, type ShapeParams } from "./shape";

/**
 * Pure-JS software renderer for server-side previews (OG images): perspective camera,
 * z-buffer, Gouraud shading with studio-ish lighting, fake contact shadow, 2x supersampling.
 * Output is premultiplied-free RGBA with a transparent background.
 */

export interface RasterOptions {
  width: number;
  height: number;
  color?: string; // hex
  azimuth?: number; // degrees
  supersample?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

export function rasterize(params: ShapeParams, o: RasterOptions): Uint8Array {
  const ss = o.supersample ?? 2;
  const W = o.width * ss;
  const H = o.height * ss;
  const base = hexToRgb(o.color ?? "#efe9df");

  const geo = buildGeometry({
    ...params,
    radialSegments: effectiveRadialSegments({ ...params, radialSegments: 288 }, 8),
    heightSegments: 96,
  });
  const pos = geo.getAttribute("position").array as Float32Array;
  const nrm = geo.getAttribute("normal").array as Float32Array;
  const idx = geo.index!.array;
  const bb = geo.boundingBox!;
  const modelH = bb.max.z - bb.min.z;
  const modelW = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);

  // camera (y-up world; model z becomes y)
  const camera = new THREE.PerspectiveCamera(28, W / H, 1, 6000);
  const fit = Math.max(modelH * 1.12, modelW * 1.45);
  const dist = fit / 2 / Math.tan((camera.fov * Math.PI) / 360) + modelW / 2;
  const az = ((o.azimuth ?? 32) * Math.PI) / 180;
  const el = 0.4;
  camera.position.set(dist * Math.cos(el) * Math.sin(az), modelH * 0.5 + dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
  camera.lookAt(new THREE.Vector3(0, modelH / 2, 0));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  // lights (world space, y-up)
  const key = new THREE.Vector3(0.55, 0.8, 0.5).normalize();
  const fill = new THREE.Vector3(-0.7, 0.3, 0.2).normalize();
  const rim = new THREE.Vector3(0.2, 0.4, -0.9).normalize();
  const view = new THREE.Vector3();

  // project vertices + shade
  const nV = pos.length / 3;
  const sx = new Float32Array(nV);
  const sy = new Float32Array(nV);
  const sz = new Float32Array(nV);
  const shade = new Float32Array(nV);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < nV; i++) {
    v.set(pos[i * 3], pos[i * 3 + 2], -pos[i * 3 + 1]);
    n.set(nrm[i * 3], nrm[i * 3 + 2], -nrm[i * 3 + 1]);
    view.subVectors(camera.position, v).normalize();
    // make normals face the camera (double-sided material)
    if (n.dot(view) < 0) n.negate();
    const diff = Math.max(0, n.dot(key)) * 0.7 + Math.max(0, n.dot(fill)) * 0.25 + Math.max(0, n.dot(rim)) * 0.15;
    const hemi = 0.22 + 0.16 * (n.y * 0.5 + 0.5);
    const h = key.clone().add(view).normalize();
    const spec = Math.pow(Math.max(0, n.dot(h)), 24) * 0.12;
    shade[i] = hemi + diff + spec;
    v.project(camera);
    sx[i] = ((v.x + 1) / 2) * W;
    sy[i] = ((1 - v.y) / 2) * H;
    sz[i] = v.z;
  }

  const rgba = new Float32Array(W * H * 4);
  const zbuf = new Float32Array(W * H).fill(Infinity);

  // --- fake contact shadow: radial gradient disc on the ground, drawn first ---
  {
    const R = modelW * 0.62;
    const segs = 64;
    const c = new THREE.Vector3(0, 0, 0).project(camera);
    const cx = ((c.x + 1) / 2) * W;
    const cy = ((1 - c.y) / 2) * H;
    const ring: [number, number][] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R).project(camera);
      ring.push([((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H]);
    }
    for (let i = 0; i < segs; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % segs];
      fillTri(rgba, null, W, H, cx, cy, 0, 0.55, ax, ay, 0, 0, bx, by, 0, 0, [0.22, 0.18, 0.14], true);
    }
  }

  // --- model ---
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    // backface cull (screen-space winding); indices are CCW seen from outside
    const cross = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sy[b] - sy[a]) * (sx[c] - sx[a]);
    if (cross >= 0) continue;
    fillTri(rgba, zbuf, W, H, sx[a], sy[a], sz[a], shade[a], sx[b], sy[b], sz[b], shade[b], sx[c], sy[c], sz[c], shade[c], base, false);
  }
  geo.dispose();

  // --- downsample to output ---
  const out = new Uint8Array(o.width * o.height * 4);
  const inv = 1 / (ss * ss);
  for (let y = 0; y < o.height; y++) {
    for (let x = 0; x < o.width; x++) {
      let r = 0;
      let g = 0;
      let bl = 0;
      let al = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const i = ((y * ss + dy) * W + (x * ss + dx)) * 4;
          const a = rgba[i + 3];
          r += rgba[i] * a;
          g += rgba[i + 1] * a;
          bl += rgba[i + 2] * a;
          al += a;
        }
      }
      const o4 = (y * o.width + x) * 4;
      if (al > 0) {
        out[o4] = Math.min(255, Math.round((r / al) * 255));
        out[o4 + 1] = Math.min(255, Math.round((g / al) * 255));
        out[o4 + 2] = Math.min(255, Math.round((bl / al) * 255));
        out[o4 + 3] = Math.round(al * inv * 255);
      }
    }
  }
  return out;
}

/** Rasterize one triangle with barycentric interpolation of depth (z) and intensity (s). */
function fillTri(
  rgba: Float32Array,
  zbuf: Float32Array | null,
  W: number,
  H: number,
  ax: number, ay: number, az: number, as: number,
  bx: number, by: number, bz: number, bs: number,
  cx: number, cy: number, cz: number, cs: number,
  color: [number, number, number],
  blendAlpha: boolean,
) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  if (minX > maxX || minY > maxY) return;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      let w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
      let w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
      let w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const i = y * W + x;
      if (zbuf) {
        const z = w0 * az + w1 * bz + w2 * cz;
        if (z >= zbuf[i]) continue;
        zbuf[i] = z;
      }
      const s = w0 * as + w1 * bs + w2 * cs;
      const o = i * 4;
      if (blendAlpha) {
        // s is the alpha of the shadow; composite "over" the (transparent) background
        const a = s;
        const prevA = rgba[o + 3];
        const outA = a + prevA * (1 - a);
        if (outA <= 0) continue;
        rgba[o] = (color[0] * a + rgba[o] * prevA * (1 - a)) / outA;
        rgba[o + 1] = (color[1] * a + rgba[o + 1] * prevA * (1 - a)) / outA;
        rgba[o + 2] = (color[2] * a + rgba[o + 2] * prevA * (1 - a)) / outA;
        rgba[o + 3] = outA;
      } else {
        rgba[o] = color[0] * s;
        rgba[o + 1] = color[1] * s;
        rgba[o + 2] = color[2] * s;
        rgba[o + 3] = 1;
      }
      void w0; void w1; void w2;
      w0 = w1 = w2 = 0;
    }
  }
}
