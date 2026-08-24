import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClientApp from "@/components/ClientApp";
import { decodeParams } from "@/lib/url";
import { matchPattern, patternName } from "@/lib/patterns";
import { getDict, isLang, langHref, LANGS } from "@/i18n";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDict(lang);
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  const query = qs.toString();
  const p = decodeParams(query);
  const pattern = matchPattern(p);
  const title = query ? `Lathe · ${Math.round(p.radius * 2)} × ${Math.round(p.height)} mm` : t.meta.title;
  const description = query
    ? t.meta.designDescription(pattern ? patternName(pattern, t) : t.meta.customPattern, p.twist ? t.meta.twist(p.twist) : "")
    : t.meta.description;
  const image = `/api/og?${query ? `${query}&` : ""}l=${lang}`;
  return {
    title,
    description,
    alternates: {
      canonical: langHref(lang, query),
      languages: Object.fromEntries(LANGS.map((l) => [l, langHref(l, query)])),
    },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }], type: "website", locale: lang },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ClientApp lang={lang} />;
}
