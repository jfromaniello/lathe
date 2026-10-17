import { DEFAULT_PARAMS, type Cut, type CutMode, type ShapeParams, type TextMark, type Waveform, type Mode, type RibAlign, type HoleShape } from "./shape";
import { TEXT_FONTS, type TextFont } from "./text";
import { DEFAULT_VIEW, MATERIALS, type MaterialKind, type ViewSettings } from "./view";

// short URL keys for each param
const KEYS: Record<keyof ShapeParams, string> = {
  mode: "m",
  height: "h",
  radius: "r",
  squareness: "sq",
  profile: "p",
  ribCount: "rc",
  ribAmplitude: "ra",
  ribWaveform: "rw",
  ribSharpness: "rs",
  ribStart: "r0",
  ribEnd: "r1",
  ribFade: "rf",
  ribAlign: "al",
  lobeCount: "lc",
  lobeAmplitude: "la",
  lobeWaveform: "lw",
  lobeProfile: "lp",
  twist: "tw",
  twistCurve: "tc",
  wall: "w",
  innerRib: "ir",
  bottom: "b",
  top: "t",
  topHole: "th",
  topHoleShape: "ths",
  topDome: "td",
  slant: "sc",
  slantAngle: "sca",
  split: "sp",
  splitLip: "sl",
  splitGap: "sg",
  cuts: "cut",
  texts: "tx",
  radialSegments: "seg",
  heightSegments: "hseg",
};
const PREVIEW_ONLY: (keyof ShapeParams)[] = ["radialSegments", "heightSegments"];
const WAVEFORMS: Waveform[] = ["sine", "triangle", "scallop", "square"];
const MODES: Mode[] = ["shell", "solid"];
const ALIGNS: RibAlign[] = ["center", "crest", "valley"];
const HOLE_SHAPES: HoleShape[] = ["circle", "follow"];

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

// cuts: "shape,mode,u,z,w,h,depth" joined by "~", shape c|s and mode p|t|b (pocket / through / both sides)
const CUT_MODES: Record<string, CutMode> = { p: "pocket", t: "through", b: "both" };
const encodeCuts = (cuts: Cut[]) =>
  cuts.map((c) => [c.shape === "circle" ? "c" : "s", c.mode[0], fmt(c.u), fmt(c.z), fmt(c.w), fmt(c.h), fmt(c.depth)].join(",")).join("~");
// texts: "font,r|e,u,z,size,depth,text" joined by "~", with "%", "," and "~" in the text escaped (%25, %2C, %7E)
const encodeTexts = (texts: TextMark[]) =>
  texts.map((t) => [t.font, t.raised ? "r" : "e", fmt(t.u), fmt(t.z), fmt(t.size), fmt(t.depth), t.text.replace(/%/g, "%25").replace(/,/g, "%2C").replace(/~/g, "%7E")].join(",")).join("~");
function decodeTexts(s: string): TextMark[] {
  const out: TextMark[] = [];
  for (const item of s.split("~").slice(0, 32)) {
    const [font, relief, ...rest] = item.split(",");
    const [u, z, size, depth] = rest.slice(0, 4).map(Number);
    let text = "";
    try {
      text = decodeURIComponent(rest.slice(4).join(",")).slice(0, 200);
    } catch {
      continue;
    }
    if (!TEXT_FONTS.includes(font as TextFont) || (relief !== "r" && relief !== "e") || ![u, z, size, depth].every(Number.isFinite)) continue;
    const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
    out.push({ text, font: font as TextFont, raised: relief === "r", u: u - Math.floor(u), z: clamp(z, 0, 1), size: clamp(size, 1, 300), depth: clamp(depth, 0, 20) });
  }
  return out;
}

function decodeCuts(s: string): Cut[] {
  const out: Cut[] = [];
  for (const item of s.split("~").slice(0, 64)) {
    const [shape, mode, ...rest] = item.split(",");
    const [u, z, w, h, depth] = rest.map(Number);
    if ((shape !== "c" && shape !== "s") || !CUT_MODES[mode] || ![u, z, w, h, depth].every(Number.isFinite)) continue;
    const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
    out.push({ shape: shape === "c" ? "circle" : "square", mode: CUT_MODES[mode], u: u - Math.floor(u), z: clamp(z, 0, 1), w: clamp(w, 1, 500), h: clamp(h, 1, 500), depth: clamp(depth, 0, 50) });
  }
  return out;
}

/** Query string (without '?') containing only the params that differ from the defaults. */
export function encodeParams(p: ShapeParams): string {
  const q = new URLSearchParams();
  for (const key of Object.keys(KEYS) as (keyof ShapeParams)[]) {
    if (PREVIEW_ONLY.includes(key)) continue;
    const v = p[key];
    const d = DEFAULT_PARAMS[key];
    if (key === "cuts") {
      if (p.cuts.length > 0) q.set(KEYS.cuts, encodeCuts(p.cuts));
    } else if (key === "texts") {
      if (p.texts.length > 0) q.set(KEYS.texts, encodeTexts(p.texts));
    } else if (Array.isArray(v)) {
      if (v.every((x, i) => x === (d as number[])[i]) && v.length === (d as number[]).length) continue;
      q.set(KEYS[key], (v as number[]).map(fmt).join(","));
    } else if (typeof v === "number") {
      if (v === d) continue;
      q.set(KEYS[key], fmt(v));
    } else {
      if (v === d) continue;
      q.set(KEYS[key], String(v));
    }
  }
  return q.toString();
}

function num(s: string | null, min: number, max: number): number | undefined {
  if (s === null) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

/** Parse a query string back into params. Unknown/invalid values fall back to defaults. */
export function decodeParams(search: string, base: ShapeParams = DEFAULT_PARAMS): ShapeParams {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if ([...q.keys()].length === 0) return base;
  const p: ShapeParams = { ...base };
  const g = (k: keyof ShapeParams) => q.get(KEYS[k]);

  const mode = g("mode");
  if (mode && MODES.includes(mode as Mode)) p.mode = mode as Mode;
  const wf = g("ribWaveform");
  if (wf && WAVEFORMS.includes(wf as Waveform)) p.ribWaveform = wf as Waveform;
  const lw = g("lobeWaveform");
  if (lw && WAVEFORMS.includes(lw as Waveform)) p.lobeWaveform = lw as Waveform;
  const al = g("ribAlign");
  if (al && ALIGNS.includes(al as RibAlign)) p.ribAlign = al as RibAlign;
  const hs = g("topHoleShape");
  if (hs && HOLE_SHAPES.includes(hs as HoleShape)) p.topHoleShape = hs as HoleShape;

  const prof = g("profile");
  if (prof) {
    const arr = prof.split(",").map(Number);
    if (arr.length >= 2 && arr.length <= 16 && arr.every((x) => Number.isFinite(x) && x > 0.05 && x < 3)) p.profile = arr;
  }
  const tc = g("twistCurve");
  if (tc) {
    const arr = tc.split(",").map(Number);
    if (arr.length >= 2 && arr.length <= 16 && arr.every((x) => Number.isFinite(x) && Math.abs(x) <= 3)) p.twistCurve = arr;
  }
  const lprof = g("lobeProfile");
  if (lprof) {
    const arr = lprof.split(",").map(Number);
    if (arr.length >= 2 && arr.length <= 16 && arr.every((x) => Number.isFinite(x) && x >= 0 && x < 3)) p.lobeProfile = arr;
  }

  p.height = num(g("height"), 5, 1000) ?? p.height;
  p.radius = num(g("radius"), 2, 500) ?? p.radius;
  p.squareness = num(g("squareness"), 0, 1) ?? p.squareness;
  p.ribCount = Math.round(num(g("ribCount"), 0, 1000) ?? p.ribCount);
  p.ribAmplitude = num(g("ribAmplitude"), -50, 50) ?? p.ribAmplitude;
  p.ribSharpness = num(g("ribSharpness"), 0, 1) ?? p.ribSharpness;
  p.ribStart = num(g("ribStart"), 0, 1) ?? p.ribStart;
  p.ribEnd = num(g("ribEnd"), 0, 1) ?? p.ribEnd;
  p.ribFade = num(g("ribFade"), 0, 500) ?? p.ribFade;
  p.lobeCount = Math.round(num(g("lobeCount"), 0, 64) ?? p.lobeCount);
  p.lobeAmplitude = num(g("lobeAmplitude"), -100, 100) ?? p.lobeAmplitude;
  p.twist = num(g("twist"), -3600, 3600) ?? p.twist;
  p.wall = num(g("wall"), 0.2, 50) ?? p.wall;
  p.innerRib = num(g("innerRib"), 0, 1) ?? p.innerRib;
  p.bottom = num(g("bottom"), 0, 100) ?? p.bottom;
  p.top = num(g("top"), 0, 100) ?? p.top;
  p.topHole = num(g("topHole"), 0, 500) ?? p.topHole;
  p.topDome = num(g("topDome"), -500, 500) ?? p.topDome;
  p.slant = num(g("slant"), 0, 500) ?? p.slant;
  p.slantAngle = num(g("slantAngle"), -360, 360) ?? p.slantAngle;
  const cuts = g("cuts");
  if (cuts !== null) p.cuts = decodeCuts(cuts);
  const texts = g("texts");
  if (texts !== null) p.texts = decodeTexts(texts);
  p.split = num(g("split"), 0, 1) ?? p.split;
  p.splitLip = num(g("splitLip"), 1, 100) ?? p.splitLip;
  p.splitGap = num(g("splitGap"), 0, 5) ?? p.splitGap;
  return p;
}

// ---------- view (material + color) ----------

export type ShareableView = Pick<ViewSettings, "material" | "color">;

export function encodeView(v: ShareableView): string {
  const q = new URLSearchParams();
  if (v.material !== DEFAULT_VIEW.material) q.set("mat", v.material);
  if (v.color.toLowerCase() !== DEFAULT_VIEW.color.toLowerCase()) q.set("c", v.color.replace("#", "").toLowerCase());
  return q.toString();
}

export function decodeView(search: string, base: ViewSettings = DEFAULT_VIEW): ViewSettings {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const v = { ...base };
  const mat = q.get("mat");
  if (mat && MATERIALS.includes(mat as MaterialKind)) v.material = mat as MaterialKind;
  const c = q.get("c");
  if (c && /^[0-9a-f]{6}$/i.test(c)) v.color = `#${c.toLowerCase()}`;
  return v;
}

/** Full query string for a design: shape params + material/color. */
export function encodeAll(p: ShapeParams, v: ShareableView): string {
  return [encodeParams(p), encodeView(v)].filter(Boolean).join("&");
}

export function shareUrl(p: ShapeParams, v: ShareableView): string {
  const qs = encodeAll(p, v);
  const base = `${window.location.origin}${window.location.pathname}`;
  return qs ? `${base}?${qs}` : base;
}
