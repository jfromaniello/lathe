import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildParts, DEFAULT_PARAMS, type ShapeParams } from "./shape";
import { crc32, make3MF, modelXml, weld, zipStore } from "./threemf";
import { analyzeMesh, isWatertight } from "@/test/mesh";

const split: ShapeParams = { ...DEFAULT_PARAMS, split: 0.8, radialSegments: 96, heightSegments: 40 };

describe("3mf", () => {
  it("crc32 matches the reference value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("welds the duplicated seam vertices into a manifold mesh", () => {
    const parts = buildParts(split)!;
    const { vertices, triangles } = weld(parts.body);
    expect(vertices.length / 3).toBeLessThan(parts.body.getAttribute("position").count);
    expect(triangles.length / 3).toBeGreaterThan(0);
    expect(analyzeMesh(parts.body)).toSatisfy(isWatertight);
  });

  it("writes both pieces as separate objects, each a build item", () => {
    const parts = buildParts(split)!;
    const xml = modelXml([
      { name: "body", geo: parts.body },
      { name: "top", geo: parts.top },
    ]);
    expect(xml).toContain('<object id="1" name="body"');
    expect(xml).toContain('<object id="2" name="top"');
    expect(xml).not.toContain("<components>");
    expect(xml).toContain('<build>\n<item objectid="1"/>\n<item objectid="2"/>\n</build>');
    expect((xml.match(/<triangle /g) ?? []).length).toBe(weld(parts.body).triangles.length / 3 + weld(parts.top).triangles.length / 3);
  });

  it("produces a zip that unzip accepts", () => {
    const parts = buildParts(split)!;
    const data = make3MF([
      { name: "body", geo: parts.body },
      { name: "top", geo: parts.top },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "lathe-3mf-"));
    const file = join(dir, "test.3mf");
    writeFileSync(file, data);
    const listing = execFileSync("unzip", ["-l", file]).toString();
    expect(listing).toContain("[Content_Types].xml");
    expect(listing).toContain("_rels/.rels");
    expect(listing).toContain("3D/3dmodel.model");
    expect(() => execFileSync("unzip", ["-tq", file])).not.toThrow();
  });

  it("zipStore round-trips file contents", () => {
    const data = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    const dir = mkdtempSync(join(tmpdir(), "lathe-zip-"));
    const file = join(dir, "t.zip");
    writeFileSync(file, data);
    expect(execFileSync("unzip", ["-p", file, "a.txt"]).toString()).toBe("hello");
  });
});
