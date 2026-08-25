import { describe, expect, it } from "vitest";
import { applyPattern, matchPattern, PATTERNS, patternIntensity, randomParams, GALLERY } from "./patterns";
import { buildGeometry, DEFAULT_PARAMS, sanitize } from "./shape";
import { analyzeMesh, isWatertight } from "@/test/mesh";

/** tiny deterministic PRNG so the random test is reproducible */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("patterns", () => {
  it.each(PATTERNS.map((p) => [p.name, p] as const))("apply/match round-trips %s", (_n, pat) => {
    const applied = applyPattern(DEFAULT_PARAMS, pat, 1.3);
    expect(matchPattern(applied)?.id).toBe(pat.id);
    if (pat.ribAmplitude) expect(patternIntensity(applied, pat)).toBeCloseTo(1.3, 1);
  });

  it("does not override an existing twist", () => {
    const twistPattern = PATTERNS.find((p) => p.twist)!;
    expect(applyPattern({ ...DEFAULT_PARAMS, twist: 15 }, twistPattern).twist).toBe(15);
    expect(applyPattern({ ...DEFAULT_PARAMS, twist: 0 }, twistPattern).twist).toBe(twistPattern.twist);
  });

  it("gallery items are watertight", () => {
    for (const g of GALLERY) {
      const r = analyzeMesh(buildGeometry({ ...g.params, radialSegments: 96, heightSegments: 32 }));
      expect(r, g.name).toSatisfy(isWatertight);
    }
  });
});

describe("randomParams", () => {
  it("always yields a printable, watertight design without needing sanitize", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 40; i++) {
      const p = randomParams(rng);
      expect(sanitize(p)).toEqual(p);
      expect(p.wall).toBeGreaterThan(0);
      expect(Math.min(...p.profile)).toBeGreaterThanOrEqual(0.3);
      const r = analyzeMesh(buildGeometry({ ...p, radialSegments: 64, heightSegments: 24 }));
      expect(r, JSON.stringify(p)).toSatisfy(isWatertight);
    }
  });
});
