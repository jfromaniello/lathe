import type { Metadata } from "next";
import { decodeParams } from "@/lib/url";
import { matchPattern, patternName } from "@/lib/patterns";
import { getDict, langPrefix, LANGS, type Lang } from "@/i18n";

/** Query string of a page's search params (single values only). */
export function queryOf(sp: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  return qs.toString();
}

/** Title, description, link preview image and language alternates for a design page (`page` "" = editor, "/view" = preview). */
export function designMetadata(lang: Lang, query: string, page: "" | "/view"): Metadata {
  const t = getDict(lang);
  const p = decodeParams(query);
  const pattern = matchPattern(p);
  const title = query ? `Lathe · ${Math.round(p.radius * 2)} × ${Math.round(p.height)} mm` : t.meta.title;
  const description = query
    ? t.meta.designDescription(pattern ? patternName(pattern, t) : t.meta.customPattern, p.twist ? t.meta.twist(p.twist) : "")
    : t.meta.description;
  const image = `/api/og?${query ? `${query}&` : ""}l=${lang}`;
  const href = (l: Lang) => `${langPrefix(l) + page || "/"}${query ? `?${query}` : ""}`;
  return {
    title,
    description,
    alternates: {
      canonical: href(lang),
      languages: Object.fromEntries(LANGS.map((l) => [l, href(l)])),
    },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }], type: "website", locale: lang },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
