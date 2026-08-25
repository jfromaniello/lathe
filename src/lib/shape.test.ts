import { describe, expect, it } from "vitest";
import { buildGeometry, DEFAULT_PARAMS, effectiveRadialSegments, PRESETS, profileAt, sanitize, wallRange, type ShapeParams } from "./shape";
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
    ["top hole following a square, ribbed, twisted section", { ...DEFAULT_PARAMS, squareness: 0.8, twist: 90, top: 2, topHole: 25, topHoleShape: "follow" }],
    ["top hole following the shape, open bottom", { ...DEFAULT_PARAMS, bottom: 0, top: 2, topHole: 25, topHoleShape: "follow", ribCount: 0 }],
    ["square, twisted, ribs fading in a band", { ...DEFAULT_PARAMS, squareness: 0.8, twist: 120, ribFade: 10, ribStart: 0.2, ribEnd: 0.8 }],
    ["negative amplitude (fluted)", { ...DEFAULT_PARAMS, ribAmplitude: -2, ribCount: 28 }],
    ["no ribs", { ...DEFAULT_PARAMS, ribCount: 0 }],
    ["ribs showing inside (constant wall)", { ...DEFAULT_PARAMS, innerRib: 1, top: 2, topHole: 15, topDome: 6 }],
    ["ribs half damped inside", { ...DEFAULT_PARAMS, innerRib: 0.5, squareness: 0.6, twist: 45, ribFade: 8 }],
    ["domed closed top", { ...DEFAULT_PARAMS, top: 2, topHole: 0, topDome: 12 }],
    ["dished top with a circular hole", { ...DEFAULT_PARAMS, top: 2, topHole: 15, topDome: -8 }],
    ["domed top, following hole, square + twist", { ...DEFAULT_PARAMS, squareness: 0.8, twist: 90, top: 2, topHole: 20, topHoleShape: "follow", topDome: 10 }],
    ["open bottom + domed closed top", { ...DEFAULT_PARAMS, bottom: 0, top: 2, topHole: 0, topDome: 10 }],
    ["open bottom + dished top with hole", { ...DEFAULT_PARAMS, bottom: 0, top: 2, topHole: 15, topDome: -6 }],
    ["solid dome", { ...DEFAULT_PARAMS, mode: "solid", topDome: 15 }],
    ["solid dish", { ...DEFAULT_PARAMS, mode: "solid", topDome: -15 }],
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

  /** Largest distance from the axis among the top-face hole-edge vertices (those inside the given half-width). */
  const holeCornerReach = (p: ShapeParams, halfWidth: number) => {
    const geo = buildGeometry(low(p));
    const pos = geo.getAttribute("position").array as Float32Array;
    const H = p.height;
    let reach = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (Math.abs(pos[i + 2] - H) > 1e-4) continue;
      const x = pos[i];
      const y = pos[i + 1];
      if (Math.max(Math.abs(x), Math.abs(y)) > halfWidth + 0.5 || Math.hypot(x, y) < 1e-6) continue;
      reach = Math.max(reach, Math.hypot(x, y));
    }
    return reach;
  };
  const squareLid: ShapeParams = { ...DEFAULT_PARAMS, squareness: 1, radius: 40, ribCount: 0, top: 2, topHole: 30 };

  it("a circular top hole stays a circle on a square body", () => {
    expect(holeCornerReach({ ...squareLid, topHoleShape: "circle" }, 30)).toBeCloseTo(30, 1);
  });

  it("a top hole that follows the shape has the section's corners at the hole half-width", () => {
    // superellipse with n = 12 (squareness 1): on the diagonal r = (2 * cos(45°)^12)^(-1/12) = 2^(5/12) times the half-width
    const corner = 30 * Math.pow(2, 5 / 12);
    expect(holeCornerReach({ ...squareLid, topHoleShape: "follow" }, 30)).toBeCloseTo(corner, 1);
  });

  it("a following top hole ignores the rib pattern", () => {
    const geo = buildGeometry(low({ ...DEFAULT_PARAMS, radius: 40, ribCount: 12, ribAmplitude: 3, top: 2, topHole: 20, topHoleShape: "follow" }));
    const pos = geo.getAttribute("position").array as Float32Array;
    let rMin = Infinity;
    let rMax = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (Math.abs(pos[i + 2] - DEFAULT_PARAMS.height) > 1e-4) continue;
      const r = Math.hypot(pos[i], pos[i + 1]);
      if (r < 1e-6 || r > 30) continue; // keep only the hole edge
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    expect(rMin).toBeCloseTo(20, 3);
    expect(rMax).toBeCloseTo(20, 3);
  });

  const apexZ = (p: ShapeParams) => {
    const pos = buildGeometry(low(p)).getAttribute("position").array as Float32Array;
    let z = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      if (Math.hypot(pos[i], pos[i + 1]) < 1e-6 && pos[i + 2] > p.height / 2) z = Math.max(z, pos[i + 2]);
    }
    return z;
  };

  it("a dome raises the apex by topDome and keeps the rim at the height", () => {
    const p: ShapeParams = { ...DEFAULT_PARAMS, top: 2, topHole: 0, topDome: 12, ribCount: 0 };
    const geo = buildGeometry(low(p));
    expect(geo.boundingBox!.max.z).toBeCloseTo(192, 3);
    expect(apexZ(p)).toBeCloseTo(192, 3);
  });

  it("a dish sinks the apex by topDome below the rim", () => {
    const p: ShapeParams = { ...DEFAULT_PARAMS, top: 2, topHole: 0, topDome: -12, ribCount: 0 };
    const geo = buildGeometry(low(p));
    expect(geo.boundingBox!.max.z).toBeCloseTo(180, 3);
    expect(apexZ(p)).toBeCloseTo(168, 3);
  });

  it("the flat rim around the dome is as wide as the wall", () => {
    const p: ShapeParams = { ...DEFAULT_PARAMS, top: 2, topHole: 0, topDome: 12, ribCount: 0, radius: 40, wall: 2 };
    const pos = buildGeometry(low(p)).getAttribute("position").array as Float32Array;
    let rimInner = 0; // largest radius that is still at z = H but not on the outer edge
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i + 1]);
      if (Math.abs(pos[i + 2] - p.height) < 1e-4 && r < 39.9) rimInner = Math.max(rimInner, r);
    }
    expect(rimInner).toBeCloseTo(38, 2);
  });

  /** Radii of the inner-wall vertices around mid-height of a shell. */
  const innerRadii = (p: ShapeParams) => {
    const pos = buildGeometry(low(p)).getAttribute("position").array as Float32Array;
    const out: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const z = pos[i + 2];
      const r = Math.hypot(pos[i], pos[i + 1]);
      // outer vertices lie in [radius - A, radius + A]; inner ones below radius - A - wall + 2A (ranges don't overlap for A = 0.5)
      if (z > p.height * 0.45 && z < p.height * 0.55 && r > 1 && r < p.radius - Math.abs(p.ribAmplitude) - 0.05) out.push(r);
    }
    return { min: Math.min(...out), max: Math.max(...out) };
  };
  const ribbedShell: ShapeParams = { ...DEFAULT_PARAMS, radius: 40, wall: 1.2, ribCount: 12, ribAmplitude: 0.5, ribStart: 0, profile: [1, 1, 1, 1, 1, 1, 1] };

  it("a smooth inside sits at the wall thickness below the deepest valley", () => {
    const { min, max } = innerRadii({ ...ribbedShell, innerRib: 0 });
    expect(min).toBeCloseTo(38.3, 2);
    expect(max).toBeCloseTo(38.3, 2);
  });

  it("with the pattern inside the wall is constant", () => {
    const { min, max } = innerRadii({ ...ribbedShell, innerRib: 1 });
    expect(min).toBeCloseTo(38.3, 1);
    expect(max).toBeCloseTo(39.3, 1);
  });

  it("wallRange reports valley and crest thickness", () => {
    expect(wallRange({ ...ribbedShell, innerRib: 0 })).toEqual([1.2, 2.2]);
    expect(wallRange({ ...ribbedShell, innerRib: 1 })).toEqual([1.2, 1.2]);
    expect(wallRange({ ...ribbedShell, ribCount: 0 })).toEqual([1.2, 1.2]);
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
  it("keeps a dish from sinking through the floor", () => {
    expect(sanitize({ ...DEFAULT_PARAMS, height: 50, top: 2, bottom: 2, topDome: -60 }).topDome).toBeCloseTo(-46 * 0.8, 5);
    expect(sanitize({ ...DEFAULT_PARAMS, height: 50, top: 2, bottom: 2, topDome: 60 }).topDome).toBe(60);
  });

  it("clamps a following top hole against the inner wall at the top of the profile", () => {
    const base = { ...DEFAULT_PARAMS, radius: 40, wall: 2, top: 2, topHole: 39, topHoleShape: "follow" as const, profile: [1, 1, 1, 1, 1, 1, 1] };
    expect(sanitize({ ...base, ribCount: 0 }).topHole).toBeCloseTo(37, 5);
    // ribs of 1.2 mm centered on the profile dip 1.2 mm below it
    expect(sanitize({ ...base, ribAmplitude: 1.2 }).topHole).toBeCloseTo(35.8, 5);
  });

  it("clamps a top hole that would not fit inside the wall", () => {
    const s = sanitize({ ...DEFAULT_PARAMS, top: 2, topHole: 200 });
    expect(s.topHole).toBeLessThan(DEFAULT_PARAMS.radius);
  });
});
