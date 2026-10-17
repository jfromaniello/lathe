import { readFileSync } from "node:fs";
import { join } from "node:path";

// The Lathe skill (skills/lathe/SKILL.md) for any LLM: how to write, check and show a design's URL. Read at build time.
export const dynamic = "force-static";

export function GET() {
  const skill = readFileSync(join(process.cwd(), "skills/lathe/SKILL.md"), "utf8");
  const body = skill.replace(/^---\n[\s\S]*?\n---\n+/, "");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
