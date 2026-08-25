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
