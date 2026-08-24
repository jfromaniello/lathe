"use client";

import { GALLERY, galleryName, randomParams } from "@/lib/patterns";
import { useT } from "@/i18n/context";
import type { ShapeParams } from "@/lib/shape";
import Thumb from "./Thumb";

export default function Gallery({ onPick }: { onPick: (p: ShapeParams) => void }) {
  const t = useT();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-200">{t.gallery.title}</span>
        <button
          onClick={() => onPick(randomParams())}
          className="rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-3 py-1 text-xs font-semibold text-black shadow hover:from-amber-400 hover:to-pink-400"
          title={t.gallery.randomHint}
        >
          {t.gallery.random}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {GALLERY.map((g) => (
          <button
            key={g.id}
            onClick={() => onPick(g.params)}
            className="group overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/60 text-left transition hover:border-amber-500/70 hover:bg-neutral-800"
            title={galleryName(g, t)}
          >
            <div className="aspect-[4/5] w-full bg-gradient-to-b from-neutral-800/40 to-neutral-900/80 p-1">
              <Thumb params={g.params} className="h-full w-full object-contain transition group-hover:scale-105" />
            </div>
            <div className="truncate px-2 py-1 text-[11px] text-neutral-300">{galleryName(g, t)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
