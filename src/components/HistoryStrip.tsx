"use client";

import { useDeferredValue } from "react";
import type { ShapeParams } from "@/lib/shape";
import Thumb from "./Thumb";

export default function HistoryStrip({
  past,
  current,
  onJump,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  past: ShapeParams[];
  current: ShapeParams;
  onJump: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const deferredCurrent = useDeferredValue(current); // don't re-render the thumbnail on every slider tick
  const MAX = 14;
  const start = Math.max(0, past.length - MAX);
  const shown = past.slice(start);
  return (
    <div className="pointer-events-auto flex items-end gap-1.5 rounded-xl border border-black/10 bg-white/70 p-1.5 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-1 pr-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-md bg-neutral-900/80 px-2 py-1 text-xs text-white hover:bg-neutral-900 disabled:opacity-30"
          title="Deshacer (⌘Z)"
        >
          ↶
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded-md bg-neutral-900/80 px-2 py-1 text-xs text-white hover:bg-neutral-900 disabled:opacity-30"
          title="Rehacer (⇧⌘Z)"
        >
          ↷
        </button>
      </div>
      <div className="flex max-w-[60vw] items-end gap-1 overflow-x-auto">
        {shown.map((p, i) => (
          <button
            key={start + i}
            onClick={() => onJump(start + i)}
            className="h-12 w-10 shrink-0 overflow-hidden rounded-md border border-black/10 bg-white/60 opacity-70 transition hover:opacity-100 hover:ring-2 hover:ring-amber-500"
            title={`Volver al paso ${start + i + 1}`}
          >
            <Thumb params={p} className="h-full w-full object-contain" />
          </button>
        ))}
        <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md border-2 border-amber-500 bg-white/80" title="Ahora">
          <Thumb params={deferredCurrent} className="h-full w-full object-contain" />
        </div>
      </div>
    </div>
  );
}
