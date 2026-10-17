"use client";

import { useEffect, useState } from "react";
import type { ShapeParams } from "@/lib/shape";
import { shareUrl, type ShareableView } from "@/lib/url";
import { useT } from "@/i18n/context";

/** Copies a link to the design: the editor, or (`preview`) the look-only page. */
export default function ShareButton({ params, view, preview = false }: { params: ShapeParams; view: ShareableView; preview?: boolean }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (state === "copied") {
      const t = setTimeout(() => setState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const share = async () => {
    const u = shareUrl(params, view, preview ? "/view" : "");
    setUrl(u);
    try {
      await navigator.clipboard.writeText(u);
      setState("copied");
    } catch {
      setState("manual"); // clipboard blocked (e.g. http on a LAN address): show the link to copy by hand
    }
  };

  return (
    <div className="relative">
      {preview ? (
        <button
          onClick={share}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white"
          title={t.share.previewHint}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {state === "copied" ? `✓ ${t.share.preview}` : t.share.preview}
        </button>
      ) : (
        <button
          onClick={share}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white"
          title={t.share.hint}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
          </svg>
          {state === "copied" ? t.share.copied : t.share.button}
        </button>
      )}
      {state === "manual" && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-md border border-neutral-700 bg-neutral-900 p-2 shadow-xl">
          <div className="mb-1 text-xs text-neutral-400">{t.share.copyThis}</div>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            autoFocus
            className="w-full rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
          />
          <button className="mt-1 text-xs text-neutral-500 hover:text-neutral-300" onClick={() => setState("idle")}>
            {t.share.close}
          </button>
        </div>
      )}
    </div>
  );
}
