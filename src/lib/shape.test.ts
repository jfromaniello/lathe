import { describe, expect, it } from "vitest";
import { buildGeometry, DEFAULT_PARAMS, effectiveRadialSegments, PRESETS, profileAt, sanitize, type ShapeParams } from "./shape";
import { analyzeMesh, isWatertight } from "@/test/mesh";

const low = (p: ShapeParams): ShapeParams => ({ ...p, radialSegments: 96, heightSegments: 40 });

describe("buildGeometry produces watertight, outward-facing meshes", () => {
  const cases: [string, ShapeParams][] = [
    ...PRESETS.map((p): [string, ShapeParams] => [`preset: ${p.name}`, p.params]),
    ["solid", { ...DEFAULT_PARAMS, mode: "solid" }],
    ["shell open bottom / open top", { ...DEFAULT_PARAMS, bottom: 0, top: 0 }],
    ["shell closed / closed (inner void)", { ...DEFAULT_PARAMS, bottom: 2, top: 2, topHole: 0 }],
    ["shell closed / closed + hole", { ...DEFAULT_PARAMS, bottom: 2, top: 2, topHole: 15 }],
    ["shell open bottom / closed top", { ...DEFAULT_PARAMS, bottom: 0, top: 2, topHole: 0 }],
    ["shell open bottom / top hole", { ...DEFAULT_PARAMS, bottom: 0, top: 2, topHole: 15 }],
    ["square, twisted, ribs fading in a band", { ...DEFAULT_PARAMS, squareness: 0.8, twist: 120, ribFade: 10, ribStart: 0.2, ribEnd: 0.8 }],
    ["negative amplitude (fluted)", { ...DEFAULT_PARAMS, ribAmplitude: -2, ribCount: 28 }],
    ["no ribs", { ...DEFAULT_PARAMS, ribCount: 0 }],
    ["wall thicker than the object falls back to solid", { ...DEFAULT_PARAMS, wall: 60 }],
  ];
  it.each(cases)("%s", (_name, params) => {
    const report = analyzeMesh(buildGeometry(low(params)));
    expect(report, JSON.stringify(report)).toSatisfy(isWatertight);
  });
});

describe("geometry dimensions", () => {
  it("matches height and diameter for a plain cylinder", () => {
    const geo = buildGeometry(low({ ...DEFAULT_PARAMS, ribCount: 0, profile: [1, 1, 1, 1, 1, 1, 1], radius: 40, height: 180 }));
    const bb = geo.boundingBox!;
    expect(bb.max.z - bb.min.z).toBeCloseTo(180, 5);
    expect(bb.max.x - bb.min.x).toBeCloseTo(80, 1);
  });

  it("rib amplitude is added to / subtracted from the radius in mm", () => {
    const geo = buildGeometry(low({ ...DEFAULT_PARAMS, mode: "solid", ribAmplitude: 2, ribCount: 12, ribStart: 0, radius: 40, profile: [1, 1, 1, 1, 1, 1, 1] }));
    const pos = geo.getAttribute("position").array as Float32Array;
    let rMax = 0;
    let rMin = Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i + 1]);
      if (r < 1e-6) continue; // cap centres
      rMax = Math.max(rMax, r);
      rMin = Math.min(rMin, r);
    }
    expect(rMax).toBeCloseTo(42, 1);
    expect(rMin).toBeCloseTo(38, 1);
  });

  const radialRange = (p: ShapeParams) => {
    const pos = buildGeometry(low(p)).getAttribute("position").array as Float32Array;
    let rMax = 0;
    let rMin = Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i + 1]);
      if (r < 1e-6) continue;
      rMax = Math.max(rMax, r);
      rMin = Math.min(rMin, r);
    }
    return { rMin, rMax };
  };
  const ribbed: ShapeParams = { ...DEFAULT_PARAMS, mode: "solid", ribAmplitude: 2, ribCount: 12, ribStart: 0, radius: 40, profile: [1, 1, 1, 1, 1, 1, 1] };

  it("crest alignment keeps the rib tops on the base profile (grooves carved inwards)", () => {
    for (const ribAmplitude of [2, -2]) {
      const { rMin, rMax } = radialRange({ ...ribbed, ribAmplitude, ribAlign: "crest" });
      expect(rMax).toBeCloseTo(40, 1);
      expect(rMin).toBeCloseTo(36, 1);
    }
  });

  it("valley alignment keeps the rib bottoms on the base profile (ribs grown outwards)", () => {
    for (const ribAmplitude of [2, -2]) {
      const { rMin, rMax } = radialRange({ ...ribbed, ribAmplitude, ribAlign: "valley" });
      expect(rMax).toBeCloseTo(44, 1);
      expect(rMin).toBeCloseTo(40, 1);
    }
  });

  it("with crest alignment the smooth zone is as wide as the rib crests", () => {
    const smooth = radialRange({ ...ribbed, ribCount: 0 });
    const half = radialRange({ ...ribbed, ribStart: 0.5, ribAlign: "crest" });
    expect(half.rMax).toBeCloseTo(smooth.rMax, 1);
  });

  it("square sections keep the half-width equal to the radius", () => {
    const geo = buildGeometry(low({ ...DEFAULT_PARAMS, ribCount: 0, squareness: 1, radius: 40 }));
    expect(geo.boundingBox!.max.x).toBeCloseTo(40, 1);
    expect(geo.boundingBox!.max.y).toBeCloseTo(40, 1);
  });
});

describe("effectiveRadialSegments", () => {
  it("snaps to a multiple of the rib count", () => {
    expect(effectiveRadialSegments({ ...DEFAULT_PARAMS, ribCount: 96, radialSegments: 256 }) % 96).toBe(0);
    expect(effectiveRadialSegments({ ...DEFAULT_PARAMS, ribCount: 7, radialSegments: 256 }) % 7).toBe(0);
  });
  it("guarantees a minimum number of samples per rib", () => {
    expect(effectiveRadialSegments({ ...DEFAULT_PARAMS, ribCount: 200, radialSegments: 32 })).toBeGreaterThanOrEqual(1200);
  });
  it("leaves the count alone without ribs", () => {
    expect(effectiveRadialSegments({ ...DEFAULT_PARAMS, ribCount: 0, radialSegments: 100 })).toBe(100);
  });
});

describe("profileAt", () => {
  it("interpolates through the control points", () => {
    const p = [0.5, 1, 0.8];
    expect(profileAt(p, 0)).toBeCloseTo(0.5);
    expect(profileAt(p, 0.5)).toBeCloseTo(1);
    expect(profileAt(p, 1)).toBeCloseTo(0.8);
  });
  it("is constant for a flat profile", () => {
    for (let t = 0; t <= 1; t += 0.1) expect(profileAt([1, 1, 1, 1], t)).toBeCloseTo(1);
  });
});

describe("sanitize", () => {
  it("clamps a top hole that would not fit inside the wall", () => {
    const s = sanitize({ ...DEFAULT_PARAMS, top: 2, topHole: 200 });
    expect(s.topHole).toBeLessThan(DEFAULT_PARAMS.radius);
  });
});
