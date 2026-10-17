import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, placeCuts, placeTexts, sanitize } from "./shape";
import { decodeParams, KEYS } from "./url";

const skill = readFileSync(join(__dirname, "../../skills/lathe/SKILL.md"), "utf8");

describe("the Lathe skill", () => {
  it("documents every URL key", () => {
    for (const key of Object.values(KEYS)) expect(skill.includes(`\`${key}\``) || skill.includes(`\`${key}=`), key).toBe(true);
  });

  it("states the defaults the app uses", () => {
    const rows = [...skill.matchAll(/^\| `(\w+)` \| (\w+) \| `?([^|`]+?)`? \|/gm)];
    expect(rows.length).toBeGreaterThan(25);
    for (const [, key, name, def] of rows) {
      if (!(name in DEFAULT_PARAMS)) continue;
      expect(KEYS[name as keyof typeof KEYS], name).toBe(key);
      const d = DEFAULT_PARAMS[name as keyof typeof DEFAULT_PARAMS];
      const shown = Array.isArray(d) ? (d as number[]).map((x) => Math.round(x * 1000) / 1000).join(",") : String(d);
      expect(def.replace(/0\.(\d{3})\d*/g, "0.$1"), name).toBe(shown);
    }
  });

  it("has examples that build without changes or rejected holes and texts", () => {
    const examples = [...skill.matchAll(/`\?([^`]+)`/g)].map((m) => m[1]);
    expect(examples.length).toBeGreaterThanOrEqual(4);
    for (const q of examples) {
      const p = decodeParams(q);
      expect(sanitize(p).mode, q).toBe(p.mode);
      expect(placeCuts(p).problems.every((x) => x === null), q).toBe(true);
      expect(placeTexts(p).problems.every((x) => x === null), q).toBe(true);
    }
  });
});
