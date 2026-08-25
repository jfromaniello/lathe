import { describe, expect, it } from "vitest";
import { rasterize } from "./raster";
import { PRESETS } from "./shape";

describe("rasterize", () => {
  const W = 120;
  const H = 130;
  const px = rasterize(PRESETS[0].params, { width: W, height: H, supersample: 1 });

  it("returns an RGBA buffer of the requested size", () => {
    expect(px.length).toBe(W * H * 4);
  });

  it("draws the model in the middle and leaves the corners transparent", () => {
    const alphaAt = (x: number, y: number) => px[(y * W + x) * 4 + 3];
    expect(alphaAt(W >> 1, H >> 1)).toBe(255);
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(W - 1, 0)).toBe(0);
  });

  it("is deterministic", () => {
    const again = rasterize(PRESETS[0].params, { width: W, height: H, supersample: 1 });
    expect(Buffer.from(again).equals(Buffer.from(px))).toBe(true);
  });

  it("uses the requested colour", () => {
    const red = rasterize(PRESETS[0].params, { width: W, height: H, supersample: 1, color: "#ff0000" });
    const i = ((H >> 1) * W + (W >> 1)) * 4;
    expect(red[i]).toBeGreaterThan(red[i + 1] + 50);
    expect(red[i]).toBeGreaterThan(red[i + 2] + 50);
  });
});
