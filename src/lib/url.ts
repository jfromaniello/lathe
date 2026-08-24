import { DEFAULT_PARAMS, type ShapeParams, type Waveform, type Mode } from "./shape";
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
  twist: "tw",
  wall: "w",
  bottom: "b",
  top: "t",
  topHole: "th",
  radialSegments: "seg",
  heightSegments: "hseg",
};
const PREVIEW_ONLY: (keyof ShapeParams)[] = ["radialSegments", "heightSegments"];
const WAVEFORMS: Waveform[] = ["sine", "triangle", "scallop", "square"];
const MODES: Mode[] = ["shell", "solid"];

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Query string (without '?') containing only the params that differ from the defaults. */
export function encodeParams(p: ShapeParams): string {
  const q = new URLSearchParams();
  for (const key of Object.keys(KEYS) as (keyof ShapeParams)[]) {
    if (PREVIEW_ONLY.includes(key)) continue;
    const v = p[key];
    const d = DEFAULT_PARAMS[key];
    if (Array.isArray(v)) {
      if (v.every((x, i) => x === (d as number[])[i]) && v.length === (d as number[]).length) continue;
      q.set(KEYS[key], v.map(fmt).join(","));
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

  const prof = g("profile");
  if (prof) {
    const arr = prof.split(",").map(Number);
    if (arr.length >= 2 && arr.length <= 16 && arr.every((x) => Number.isFinite(x) && x > 0.05 && x < 3)) p.profile = arr;
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
  p.twist = num(g("twist"), -3600, 3600) ?? p.twist;
  p.wall = num(g("wall"), 0.2, 50) ?? p.wall;
  p.bottom = num(g("bottom"), 0, 100) ?? p.bottom;
  p.top = num(g("top"), 0, 100) ?? p.top;
  p.topHole = num(g("topHole"), 0, 500) ?? p.topHole;
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
