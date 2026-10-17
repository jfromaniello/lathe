import type { NextRequest } from "next/server";
import { decodeParams, decodeView, encodeAll } from "@/lib/url";
import { bounds, buildGeometry, hasSplit, placeCuts, placeTexts, sanitize, wallRange, type ShapeParams } from "@/lib/shape";
import { textOutline } from "@/lib/text";
import { getDict, isLang, langPrefix } from "@/i18n";

// What a design comes out as, for a program (an LLM writing Lathe URLs): the params after the limits are applied,
// what was changed to make it buildable, its size, which holes and texts can't be made and why, and its links.

const round = (n: number) => Math.round(n * 100) / 100;
const ADJUSTABLE: (keyof ShapeParams)[] = ["mode", "bottom", "top", "topHole", "topDome", "split", "slant"];

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const lang = search.get("l");
  const prefix = langPrefix(isLang(lang) ? lang : "en");
  const raw = decodeParams(req.nextUrl.search);
  const p = sanitize(raw);
  const view = decodeView(req.nextUrl.search);
  const t = getDict("en");

  const geo = buildGeometry({ ...p, radialSegments: 192, heightSegments: 64 });
  geo.computeBoundingBox();
  const size = bounds(geo);
  geo.dispose();

  const cuts = placeCuts(p).problems.map((problem, i) => ({ index: i, ok: !problem, problem: problem && { code: problem, message: t.cuts.problems[problem] } }));
  const texts = placeTexts(p).problems.map((problem, i) => {
    const m = p.texts[i];
    const o = textOutline(m.text, m.font, Math.max(1, m.size));
    return { index: i, ok: !problem, width: round(o.width), height: round(o.height), problem: problem && { code: problem, message: t.texts.problems[problem] } };
  });
  const adjusted = ADJUSTABLE.filter((k) => raw[k] !== p[k]).map((k) => ({ param: k, asked: raw[k], used: p[k] }));

  const qs = encodeAll(raw, view);
  const q = qs ? `?${qs}` : "";
  const origin = req.nextUrl.origin;
  const [wallMin, wallMax] = wallRange(p);
  return Response.json(
    {
      size: { width: round(size.x), depth: round(size.y), height: round(size.z), unit: "mm" },
      mode: p.mode,
      wall: p.mode === "shell" ? { min: round(wallMin), max: round(wallMax) } : null,
      pieces: hasSplit(p) ? 2 : 1,
      adjusted,
      cuts,
      texts,
      ok: adjusted.length === 0 && cuts.every((c) => c.ok) && texts.every((x) => x.ok),
      urls: {
        editor: `${origin}${prefix || "/"}${q}`,
        preview: `${origin}${prefix}/view${q}`,
        image: `${origin}/api/og${q}`,
      },
      params: p,
    },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
