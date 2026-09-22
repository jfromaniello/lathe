import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { buildGeometry, buildParts, effectiveRadialSegments, type ShapeParams } from "./shape";
import { make3MF } from "./threemf";

export function exportParamsFor(p: ShapeParams): ShapeParams {
  const height = Math.min(300, Math.max(96, Math.round(p.height * 0.8)));
  const base = { ...p, radialSegments: 288, heightSegments: height };
  return { ...base, radialSegments: effectiveRadialSegments(base, 10) };
}

function stlBlob(geo: THREE.BufferGeometry): Blob {
  const mesh = new THREE.Mesh(geo);
  const exporter = new STLExporter();
  const data = exporter.parse(mesh, { binary: true }) as DataView;
  geo.dispose();
  return new Blob([data.buffer as ArrayBuffer], { type: "model/stl" });
}

export function makeSTL(p: ShapeParams): Blob {
  return stlBlob(buildGeometry(exportParamsFor(p)));
}

export interface Parts {
  body: THREE.BufferGeometry;
  top: THREE.BufferGeometry;
}

/**
 * Lay the two pieces out for printing (in place): both on the bed, side by side and centred, the top upside down so the
 * lid prints face down with the skirt up. Slicers otherwise see two objects at different heights and offer to merge them.
 */
export function layOutParts(parts: Parts, gap = 10): Parts {
  const { body, top } = parts;
  top.rotateX(Math.PI);
  body.computeBoundingBox();
  top.computeBoundingBox();
  const bb = body.boundingBox!;
  const tb = top.boundingBox!;
  const width = bb.max.x - bb.min.x + gap + (tb.max.x - tb.min.x);
  const x0 = -width / 2;
  body.translate(x0 - bb.min.x, 0, -bb.min.z);
  top.translate(x0 + (bb.max.x - bb.min.x) + gap - tb.min.x, 0, -tb.min.z);
  body.computeBoundingBox();
  top.computeBoundingBox();
  return parts;
}

function exportParts(p: ShapeParams): Parts | null {
  const parts = buildParts(exportParamsFor(p));
  return parts && layOutParts(parts);
}

/** One STL per piece of a split design (null when the design is a single piece). */
export function makeSTLParts(p: ShapeParams): { body: Blob; top: Blob } | null {
  const parts = exportParts(p);
  if (!parts) return null;
  return { body: stlBlob(parts.body), top: stlBlob(parts.top) };
}

/** Both pieces as two objects in one 3MF, laid out on the bed — assign a filament to each in the slicer. */
export function make3MFParts(p: ShapeParams, name = "lathe"): Blob | null {
  const parts = exportParts(p);
  if (!parts) return null;
  const data = make3MF([
    { name: `${name}-body`, geo: parts.body },
    { name: `${name}-top`, geo: parts.top },
  ]);
  parts.body.dispose();
  parts.top.dispose();
  return new Blob([data.buffer as ArrayBuffer], { type: "model/3mf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
