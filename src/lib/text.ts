import { Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import polygonClipping, { type MultiPolygon, type Polygon } from "polygon-clipping";
import sans from "./fonts/sans.json";
import serif from "./fonts/serif.json";
import condensed from "./fonts/condensed.json";
import script from "./fonts/script.json";

// Text on the wall: the letters' outlines, flattened to polygons and merged (script letters overlap their neighbours).
// Fonts: Archivo Black, DM Serif Display, Bebas Neue and Pacifico, subset to Latin characters (SIL OFL, see fonts/licenses).

export type TextFont = "sans" | "serif" | "condensed" | "script";
export const TEXT_FONTS: TextFont[] = ["sans", "serif", "condensed", "script"];

const DATA: Record<TextFont, unknown> = { sans, serif, condensed, script };
const fonts = new Map<TextFont, Font>();
const fontOf = (f: TextFont) => {
  let font = fonts.get(f);
  if (!font) fonts.set(f, (font = new Font(DATA[f] as FontData)));
  return font;
};

export interface TextOutline {
  /** Closed rings in mm, centred on the middle of the text; outer outlines and the holes of letters alike (even-odd). */
  rings: [number, number][][];
  width: number;
  height: number;
}

const cache = new Map<string, TextOutline>();

/** The outline of `text` with letters `size` mm tall (font size: capitals come out a bit shorter). */
export function textOutline(text: string, font: TextFont, size: number): TextOutline {
  const key = `${font}|${size}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const shapes = fontOf(font).generateShapes(text, size);
  const polys: Polygon[] = shapes.map((s) => {
    const { shape, holes } = s.extractPoints(4);
    return [shape, ...holes].map((ring) => ring.map((v): [number, number] => [v.x, v.y]));
  });
  let merged: MultiPolygon = [];
  try {
    merged = polys.length ? polygonClipping.union(polys[0], ...polys.slice(1)) : [];
  } catch {
    merged = polys; // degenerate input: fall back to the raw outlines
  }
  // drop the closing point and points closer than a hair; drop slivers
  const rings: [number, number][][] = [];
  for (const poly of merged)
    for (const ring of poly) {
      const r: [number, number][] = [];
      for (const q of ring.slice(0, -1)) {
        const last = r[r.length - 1];
        if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.02) r.push(q);
      }
      while (r.length > 2 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) <= 0.02) r.pop();
      let area = 0;
      for (let i = 0; i < r.length; i++) {
        const [x0, y0] = r[i];
        const [x1, y1] = r[(i + 1) % r.length];
        area += x0 * y1 - x1 * y0;
      }
      if (r.length >= 3 && Math.abs(area) / 2 > 0.01) rings.push(r);
    }
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const r of rings)
    for (const [x, y] of r) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const out: TextOutline = rings.length
    ? { rings: rings.map((r) => r.map(([x, y]): [number, number] => [x - cx, y - cy])), width: x1 - x0, height: y1 - y0 }
    : { rings: [], width: 0, height: 0 };
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}
