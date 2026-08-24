"use client";

import dynamic from "next/dynamic";
import { I18nProvider, useT } from "@/i18n/context";
import type { Lang } from "@/i18n";

function Loading() {
  const t = useT();
  return <div className="flex h-dvh w-screen items-center justify-center bg-neutral-950 text-sm text-neutral-500">{t.loading}</div>;
}

// The whole app is client-only: it depends on WebGL and reads its state from the URL.
const App = dynamic(() => import("@/components/App"), { ssr: false, loading: Loading });

export default function ClientApp({ lang }: { lang: Lang }) {
  return (
    <I18nProvider lang={lang}>
      <App />
    </I18nProvider>
  );
}
