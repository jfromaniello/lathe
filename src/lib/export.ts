import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { buildGeometry, effectiveRadialSegments, type ShapeParams } from "./shape";

export function exportParamsFor(p: ShapeParams): ShapeParams {
  const height = Math.min(300, Math.max(96, Math.round(p.height * 0.8)));
  const base = { ...p, radialSegments: 288, heightSegments: height };
  return { ...base, radialSegments: effectiveRadialSegments(base, 10) };
}

export function makeSTL(p: ShapeParams): Blob {
  const geo = buildGeometry(exportParamsFor(p));
  const mesh = new THREE.Mesh(geo);
  const exporter = new STLExporter();
  const data = exporter.parse(mesh, { binary: true }) as DataView;
  geo.dispose();
  return new Blob([data.buffer as ArrayBuffer], { type: "model/stl" });
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
