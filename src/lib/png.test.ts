import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { encodePNG } from "./png";

describe("encodePNG", () => {
  it("writes a valid PNG whose IDAT decodes back to the pixels", () => {
    const w = 3;
    const h = 2;
    const px = new Uint8Array(w * h * 4);
    for (let i = 0; i < px.length; i++) px[i] = (i * 37) & 0xff;
    const png = encodePNG(px, w, h);

    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(w);
    expect(png.readUInt32BE(20)).toBe(h);
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(6); // RGBA

    const idatLen = png.readUInt32BE(33);
    expect(png.toString("ascii", 37, 41)).toBe("IDAT");
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    // one filter byte per row, then RGBA
    for (let y = 0; y < h; y++) {
      expect(raw[y * (w * 4 + 1)]).toBe(0);
      expect([...raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1))]).toEqual([...px.subarray(y * w * 4, (y + 1) * w * 4)]);
    }
    expect(png.toString("ascii", png.length - 8, png.length - 4)).toBe("IEND");
  });
});
