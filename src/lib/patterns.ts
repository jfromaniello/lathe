import { DEFAULT_PARAMS, PRESETS, type ShapeParams, type Waveform } from "./shape";

// ---------- rib "materials" ----------

export interface Pattern {
  id: string;
  name: string;
  ribCount: number;
  ribAmplitude: number; // base amplitude at intensity 1
  ribWaveform: Waveform;
  ribSharpness?: number;
  twist?: number;
}

export const PATTERNS: Pattern[] = [
  { id: "smooth", name: "Liso", ribCount: 0, ribAmplitude: 0, ribWaveform: "scallop" },
  { id: "fine", name: "Estría fina", ribCount: 96, ribAmplitude: 0.8, ribWaveform: "scallop" },
  { id: "reeded", name: "Reeded", ribCount: 48, ribAmplitude: 1.5, ribWaveform: "scallop" },
  { id: "fluted", name: "Acanalado", ribCount: 28, ribAmplitude: -2, ribWaveform: "scallop" },
  { id: "waves", name: "Ondas", ribCount: 12, ribAmplitude: 4, ribWaveform: "sine" },
  { id: "twist", name: "Twist suave", ribCount: 8, ribAmplitude: 6, ribWaveform: "sine", twist: 60 },
  { id: "segments", name: "Gajos", ribCount: 16, ribAmplitude: 3, ribWaveform: "triangle" },
  { id: "facet", name: "Facetado", ribCount: 20, ribAmplitude: 1.5, ribWaveform: "square", ribSharpness: 1 },
];

export function applyPattern(p: ShapeParams, pat: Pattern, intensity = 1): ShapeParams {
  return {
    ...p,
    ribCount: pat.ribCount,
    ribAmplitude: Math.round(pat.ribAmplitude * intensity * 100) / 100,
    ribWaveform: pat.ribWaveform,
    ribSharpness: pat.ribSharpness ?? p.ribSharpness,
    twist: pat.twist !== undefined && p.twist === 0 ? pat.twist : p.twist,
  };
}

/** Which pattern the current params correspond to (by waveform + rib count + amplitude sign). */
export function matchPattern(p: ShapeParams): Pattern | null {
  if (p.ribCount === 0 || p.ribAmplitude === 0) return PATTERNS[0];
  return (
    PATTERNS.find(
      (pat) =>
        pat.ribCount === p.ribCount && pat.ribWaveform === p.ribWaveform && Math.sign(pat.ribAmplitude) === Math.sign(p.ribAmplitude),
    ) ?? null
  );
}

export function patternIntensity(p: ShapeParams, pat: Pattern): number {
  if (!pat.ribAmplitude) return 0;
  return Math.round((p.ribAmplitude / pat.ribAmplitude) * 100) / 100;
}

// ---------- gallery ----------

export interface GalleryItem {
  name: string;
  params: ShapeParams;
}

const base = DEFAULT_PARAMS;

export const GALLERY: GalleryItem[] = [
  ...PRESETS,
  {
    name: "Torso",
    params: { ...base, height: 220, radius: 45, profile: [0.9, 1.05, 0.92, 0.72, 0.86, 1, 0.72], ribCount: 64, ribAmplitude: 0.8, ribStart: 0, twist: 15 },
  },
  {
    name: "Botella",
    params: { ...base, height: 210, radius: 42, profile: [0.92, 1, 1, 0.97, 0.7, 0.4, 0.34], ribCount: 0, ribAmplitude: 0, ribStart: 0 },
  },
  {
    name: "Bowl",
    params: { ...base, height: 70, radius: 75, profile: [0.45, 0.72, 0.88, 0.96, 1, 1.03, 1.05], ribCount: 48, ribAmplitude: 1.5, ribStart: 0, wall: 1.6, bottom: 2 },
  },
  {
    name: "Lapicero",
    params: { ...base, height: 100, radius: 38, squareness: 0.5, ribCount: 48, ribAmplitude: 1.5, ribStart: 0, wall: 1.6, bottom: 2 },
  },
  {
    name: "Facetado",
    params: { ...base, height: 170, radius: 48, profile: [0.8, 0.95, 1.05, 1.08, 1.02, 0.9, 0.78], ribCount: 20, ribAmplitude: 1.5, ribWaveform: "square", ribSharpness: 1, ribStart: 0, twist: 40 },
  },
];

// ---------- "sorprendeme" ----------

export function randomParams(rng: () => number = Math.random): ShapeParams {
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const range = (a: number, b: number, step = 1) => Math.round((a + rng() * (b - a)) / step) * step;

  const height = range(80, 260, 5);
  const radius = range(30, 70, 1);
  const squareness = rng() < 0.6 ? 0 : range(0.3, 0.9, 0.05);

  // smooth random silhouette: random walk with a bias towards one of a few archetypes
  const archetype = pick(["straight", "bulge", "taper", "hourglass", "bottle"]);
  const target = (t: number) => {
    switch (archetype) {
      case "bulge":
        return 0.75 + 0.35 * Math.sin(Math.PI * t);
      case "taper":
        return 1.05 - 0.4 * t;
      case "hourglass":
        return 0.95 + 0.15 * Math.cos(2 * Math.PI * t);
      case "bottle":
        return t < 0.6 ? 1 : 1 - (t - 0.6) * 1.5;
      default:
        return 1;
    }
  };
  const profile = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    return Math.round(Math.max(0.3, Math.min(1.3, target(t) + (rng() - 0.5) * 0.12)) * 100) / 100;
  });

  const pattern = pick(PATTERNS.filter((p) => p.id !== "smooth"));
  const intensity = range(0.6, 1.6, 0.1);
  const twist = rng() < 0.5 ? 0 : range(20, 120, 5);
  const ribStart = rng() < 0.75 ? 0 : range(0.2, 0.5, 0.05);

  return applyPattern(
    {
      ...DEFAULT_PARAMS,
      height,
      radius,
      squareness,
      profile,
      ribStart,
      ribEnd: 1,
      ribFade: 0,
      twist,
      wall: 1.2,
      bottom: 1.6,
      top: 0,
    },
    pattern,
    intensity,
  );
}
