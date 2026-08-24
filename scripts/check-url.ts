import { PRESETS, DEFAULT_PARAMS } from "../src/lib/shape";
import { encodeParams, decodeParams, encodeAll, decodeView } from "../src/lib/url";
let ok = true;
for (const p of PRESETS) {
  const qs = encodeParams(p.params);
  const back = decodeParams(qs);
  const same = JSON.stringify(back) === JSON.stringify(p.params);
  ok = ok && same;
  console.log(same ? "OK  " : "FAIL", p.name, "->", qs.length, "chars:", qs);
}
console.log(encodeParams(DEFAULT_PARAMS) === "" ? "OK   defaults -> empty" : "FAIL defaults");
console.log(JSON.stringify(decodeParams("?h=abc&rc=99999&rw=bogus&p=1,2,x")) !== "" ? "OK   garbage tolerated" : "");
const qv = encodeAll(PRESETS[1].params, { material: "glass", color: "#C47A5E" });
const v = decodeView(qv);
const vok = v.material === "glass" && v.color === "#c47a5e" && JSON.stringify(decodeParams(qv)) === JSON.stringify(PRESETS[1].params);
console.log(vok ? "OK   view round-trip:" : "FAIL view round-trip:", qv.slice(-20));
ok = ok && vok;
process.exit(ok ? 0 : 1);
