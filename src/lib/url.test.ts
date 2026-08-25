import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PRESETS } from "./shape";
import { decodeParams, decodeView, encodeAll, encodeParams, encodeView } from "./url";
import { DEFAULT_VIEW } from "./view";

describe("url encoding", () => {
  it("encodes the defaults as an empty query", () => {
    expect(encodeParams(DEFAULT_PARAMS)).toBe("");
    expect(encodeView(DEFAULT_VIEW)).toBe("");
  });

  it.each(PRESETS.map((p) => [p.name, p.params] as const))("round-trips preset %s", (_n, params) => {
    expect(decodeParams(encodeParams(params))).toEqual(params);
  });

  it("does not leak preview resolution into the link", () => {
    const qs = encodeParams({ ...DEFAULT_PARAMS, radialSegments: 720, heightSegments: 400 });
    expect(qs).toBe("");
  });

  it("round-trips material and color", () => {
    const qs = encodeAll(PRESETS[1].params, { material: "glass", color: "#C47A5E" });
    expect(decodeView(qs)).toMatchObject({ material: "glass", color: "#c47a5e" });
    expect(decodeParams(qs)).toEqual(PRESETS[1].params);
  });

  it("round-trips the rib alignment and ignores unknown values", () => {
    const qs = encodeParams({ ...DEFAULT_PARAMS, ribAlign: "crest" });
    expect(qs).toBe("al=crest");
    expect(decodeParams(qs).ribAlign).toBe("crest");
    expect(decodeParams("?al=sideways").ribAlign).toBe("center");
  });

  it("round-trips the top hole shape", () => {
    const qs = encodeParams({ ...DEFAULT_PARAMS, top: 2, topHoleShape: "circle" });
    expect(qs).toContain("ths=circle");
    expect(decodeParams(qs).topHoleShape).toBe("circle");
    expect(decodeParams("?ths=hexagon").topHoleShape).toBe("follow");
  });

  it("round-trips the top curvature", () => {
    expect(decodeParams(encodeParams({ ...DEFAULT_PARAMS, topDome: -7.5 })).topDome).toBe(-7.5);
  });

  it("round-trips the two-piece settings", () => {
    const p = { ...DEFAULT_PARAMS, split: 0.85, splitLip: 8, splitGap: 0.3 };
    const qs = encodeParams(p);
    expect(qs).toBe("sp=0.85&sl=8&sg=0.3");
    expect(decodeParams(qs)).toEqual(p);
  });

  it("tolerates garbage and clamps out-of-range values", () => {
    const p = decodeParams("?h=abc&r=99999&rc=-5&rw=bogus&p=1,2,x&m=nope");
    expect(p.height).toBe(DEFAULT_PARAMS.height);
    expect(p.radius).toBe(500);
    expect(p.ribCount).toBe(0);
    expect(p.ribWaveform).toBe(DEFAULT_PARAMS.ribWaveform);
    expect(p.profile).toEqual(DEFAULT_PARAMS.profile);
    expect(p.mode).toBe(DEFAULT_PARAMS.mode);
    expect(decodeView("?mat=steel&c=zzz")).toEqual(DEFAULT_VIEW);
  });
});
