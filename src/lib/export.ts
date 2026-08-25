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

/** One STL per piece of a split design (null when the design is a single piece). */
export function makeSTLParts(p: ShapeParams): { body: Blob; top: Blob } | null {
  const parts = buildParts(exportParamsFor(p));
  if (!parts) return null;
  return { body: stlBlob(parts.body), top: stlBlob(parts.top) };
}

/** Both pieces as two objects in one 3MF, in place — assign a filament to each in the slicer. */
export function make3MFParts(p: ShapeParams, name = "lathe"): Blob | null {
  const parts = buildParts(exportParamsFor(p));
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
