import type { Metadata } from "next";
import ClientApp from "@/components/ClientApp";
import { decodeParams } from "@/lib/url";
import { matchPattern } from "@/lib/patterns";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  const query = qs.toString();
  const p = decodeParams(query);
  const pattern = matchPattern(p);
  const title = query ? `Lathe · ${Math.round(p.radius * 2)} × ${Math.round(p.height)} mm` : "Lathe";
  const description = query
    ? `${pattern?.name ?? "Patrón personalizado"}${p.twist ? `, twist ${p.twist}°` : ""} — diseño paramétrico listo para imprimir en 3D.`
    : "Floreros, lámparas y tachos paramétricos para imprimir en 3D. Diseñá en el browser, exportá STL.";
  const image = `/api/og${query ? `?${query}` : ""}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function Page() {
  return <ClientApp />;
}
