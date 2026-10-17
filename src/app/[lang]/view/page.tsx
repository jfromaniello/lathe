import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClientApp from "@/components/ClientApp";
import { designMetadata, queryOf } from "@/lib/meta";
import { isLang } from "@/i18n";

// The same design as the editor, alone on the screen: to look at on a phone or from a link.
export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/view">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return designMetadata(lang, queryOf(await searchParams), "/view");
}

export default async function ViewPage({ params }: PageProps<"/[lang]/view">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ClientApp lang={lang} preview />;
}
