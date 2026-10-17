import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClientApp from "@/components/ClientApp";
import { designMetadata, queryOf } from "@/lib/meta";
import { isLang } from "@/i18n";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return designMetadata(lang, queryOf(await searchParams), "");
}

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ClientApp lang={lang} />;
}
