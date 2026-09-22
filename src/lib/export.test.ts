import { describe, expect, it } from "vitest";
import { buildParts, DEFAULT_PARAMS, type ShapeParams } from "./shape";
import { layOutParts } from "./export";

const split: ShapeParams = { ...DEFAULT_PARAMS, split: 0.8, radialSegments: 96, heightSegments: 40 };

describe("layOutParts", () => {
  it("puts both pieces on the bed, side by side, with the top upside down", () => {
    const built = buildParts(split)!;
    built.top.computeBoundingBox();
    const topHeight = built.top.boundingBox!.max.z - built.top.boundingBox!.min.z;
    const topMaxZ = built.top.boundingBox!.max.z;
    expect(topMaxZ).toBeCloseTo(split.height, 3);
    // the lid's skirt is the widest part of the top piece and starts above the bed; flipped, it sits at the top
    const skirtZ = built.top.boundingBox!.min.z;

    const { body, top } = layOutParts(built, 10);
    const bb = body.boundingBox!;
    const tb = top.boundingBox!;
    expect(bb.min.z).toBeCloseTo(0, 4);
    expect(tb.min.z).toBeCloseTo(0, 4);
    expect(tb.max.z).toBeCloseTo(topHeight, 4);
    expect(tb.min.x - bb.max.x).toBeCloseTo(10, 4);
    expect(bb.min.x + tb.max.x).toBeCloseTo(0, 4); // centred as a pair

    // flipped: what was at the skirt (lowest) is now at the highest z
    const pos = top.getAttribute("position").array as ArrayLike<number>;
    let highest = 0;
    for (let i = 2; i < pos.length; i += 3) highest = Math.max(highest, pos[i]);
    expect(highest).toBeCloseTo(split.height - skirtZ, 3);
  });

  it("leaves a single-piece design alone", () => {
    expect(buildParts(DEFAULT_PARAMS)).toBeNull();
  });
});
