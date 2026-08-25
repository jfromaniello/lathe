import type * as THREE from "three";

/**
 * Minimal 3MF writer: each mesh is its own object and build item, in place.
 * (Slicers derived from PrusaSlicer — Bambu, Orca — merge `<components>` of a generic 3MF into one volume, but they do
 * keep separate build items as separate objects and offer to load them as one object with several parts.)
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Store-only ZIP (no compression) — 3MF is a ZIP package. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0),
    ]);
    chunks.push(local, name, f.data);
    central.push(
      new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ]),
      name,
    );
    offset += local.length + name.length + f.data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);
  const total = offset + cdSize + end.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of [...chunks, ...central, end]) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export interface MeshPart {
  name: string;
  geo: THREE.BufferGeometry;
}

/** Vertices welded by position (the geometry duplicates them along sharp edges) so the 3MF mesh is manifold. */
export function weld(geo: THREE.BufferGeometry): { vertices: number[]; triangles: number[] } {
  const pos = geo.getAttribute("position").array as ArrayLike<number>;
  const idx = geo.index!.array as ArrayLike<number>;
  const map = new Map<string, number>();
  const remap = new Int32Array(pos.length / 3);
  const vertices: number[] = [];
  for (let i = 0; i < remap.length; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let w = map.get(k);
    if (w === undefined) {
      w = vertices.length / 3;
      map.set(k, w);
      vertices.push(x, y, z);
    }
    remap[i] = w;
  }
  const triangles: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = remap[idx[i]];
    const b = remap[idx[i + 1]];
    const c = remap[idx[i + 2]];
    if (a === b || b === c || a === c) continue;
    triangles.push(a, b, c);
  }
  return { vertices, triangles };
}

const xmlName = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export function modelXml(parts: MeshPart[]): string {
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    "<resources>",
  ];
  parts.forEach((part, n) => {
    const { vertices, triangles } = weld(part.geo);
    out.push(`<object id="${n + 1}" name="${xmlName(part.name)}" type="model"><mesh><vertices>`);
    for (let i = 0; i < vertices.length; i += 3) {
      out.push(`<vertex x="${vertices[i].toFixed(4)}" y="${vertices[i + 1].toFixed(4)}" z="${vertices[i + 2].toFixed(4)}"/>`);
    }
    out.push("</vertices><triangles>");
    for (let i = 0; i < triangles.length; i += 3) {
      out.push(`<triangle v1="${triangles[i]}" v2="${triangles[i + 1]}" v3="${triangles[i + 2]}"/>`);
    }
    out.push("</triangles></mesh></object>");
  });
  out.push("</resources>", "<build>");
  parts.forEach((_, n) => out.push(`<item objectid="${n + 1}"/>`));
  out.push("</build>", "</model>");
  return out.join("\n");
}

export function make3MF(parts: MeshPart[]): Uint8Array {
  const enc = new TextEncoder();
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>';
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "3D/3dmodel.model", data: enc.encode(modelXml(parts)) },
  ]);
}
