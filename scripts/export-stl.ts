import { writeFileSync } from "node:fs";
import { PRESETS } from "../src/lib/shape";
import { makeSTL } from "../src/lib/export";
const out = process.argv[2];
async function main() {
for (const [i, p] of PRESETS.entries()) {
  const t0 = performance.now();
  const blob = makeSTL(p.params);
  const buf = Buffer.from(await blob.arrayBuffer());
  const tris = buf.readUInt32LE(80);
  writeFileSync(`${out}/preset${i}.stl`, buf);
  console.log(`${p.name}: ${tris} tris, ${(buf.length / 1e6).toFixed(1)} MB, ${(performance.now() - t0).toFixed(0)} ms`);
}
}
main();
