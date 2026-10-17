// Converts TTF fonts into the compact typeface JSON that three's Font reads (glyph outlines only, Latin characters).
// Usage: pnpm dlx tsx scripts/make-fonts.ts <dir with the .ttf files>
// The fonts are under the SIL Open Font License; their licenses are copied next to the JSON.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";

const FONTS = [
  { id: "sans", file: "archivoblack_ArchivoBlack-Regular.ttf", license: "archivoblack_OFL.txt", source: "Archivo Black" },
  { id: "serif", file: "dmserif_DMSerifDisplay-Regular.ttf", license: "dmserif_OFL.txt", source: "DM Serif Display" },
  { id: "condensed", file: "bebasneue_BebasNeue-Regular.ttf", license: "bebasneue_OFL.txt", source: "Bebas Neue" },
  { id: "script", file: "pacifico_Pacifico-Regular.ttf", license: "pacifico_OFL.txt", source: "Pacifico" },
];

const CHARS = [...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), ...Array.from({ length: 96 }, (_, i) => String.fromCharCode(160 + i)), "€", "’", "“", "”", "–", "—", "…", "♥"];

const dir = process.argv[2];
if (!dir) throw new Error("usage: make-fonts.ts <dir>");
const out = join(import.meta.dirname, "../src/lib/fonts");
mkdirSync(join(out, "licenses"), { recursive: true });

for (const f of FONTS) {
  const font = opentype.loadSync(join(dir, f.file));
  const scale = 1000 / font.unitsPerEm;
  const r = (n: number) => Math.round(n * scale);
  const glyphs: Record<string, { ha: number; x_min: number; x_max: number; o: string }> = {};
  for (const ch of CHARS) {
    const g = font.charToGlyph(ch);
    if (!g || g.index === 0) continue;
    const parts: string[] = [];
    for (const c of g.path.commands) {
      if (c.type === "M") parts.push(`m ${r(c.x)} ${r(c.y)}`);
      else if (c.type === "L") parts.push(`l ${r(c.x)} ${r(c.y)}`);
      else if (c.type === "Q") parts.push(`q ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)}`);
      else if (c.type === "C") parts.push(`b ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)}`);
    }
    const bb = g.getBoundingBox();
    glyphs[ch] = { ha: r(g.advanceWidth ?? 0), x_min: r(bb.x1), x_max: r(bb.x2), o: parts.join(" ") };
  }
  const json = {
    glyphs,
    familyName: f.id,
    ascender: r(font.ascender),
    descender: r(font.descender),
    underlinePosition: r(font.tables.post?.underlinePosition ?? 0),
    underlineThickness: r(font.tables.post?.underlineThickness ?? 0),
    boundingBox: { xMin: r(font.tables.head.xMin), yMin: r(font.tables.head.yMin), xMax: r(font.tables.head.xMax), yMax: r(font.tables.head.yMax) },
    resolution: 1000,
    original_font_information: { source: f.source, license: "SIL Open Font License 1.1 (see licenses/)" },
  };
  writeFileSync(join(out, `${f.id}.json`), JSON.stringify(json));
  copyFileSync(join(dir, f.license), join(out, "licenses", `${f.id}-OFL.txt`));
  console.log(f.id, Object.keys(glyphs).length, "glyphs");
}
