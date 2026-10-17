"use client";

import { useState } from "react";
import Viewer from "@/components/Viewer";
import { DEFAULT_PARAMS } from "@/lib/shape";
import { DEFAULT_VIEW } from "@/lib/view";
import { decodeParams, decodeView } from "@/lib/url";
import { langPrefix } from "@/i18n";
import { useLang, useT } from "@/i18n/context";

const noop = () => {};

/** The design alone, to turn round and look at (a phone, a link in a chat): no tools, one button to the editor. */
export default function Preview() {
  // rendered client-only (see page.tsx), so reading the URL in the initializer is safe
  const [params] = useState(() => decodeParams(window.location.search, DEFAULT_PARAMS));
  const [view] = useState(() => ({ ...decodeView(window.location.search, DEFAULT_VIEW), showHandles: false, showMug: false }));
  const lang = useLang();
  const t = useT();
  const editor = `${langPrefix(lang) || "/"}${window.location.search}`;

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#e6e1d9]">
      <Viewer params={params} view={view} onChange={noop} readOnly />
      <a
        href={editor}
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-neutral-800"
      >
        {t.preview.edit}
      </a>
    </main>
  );
}
