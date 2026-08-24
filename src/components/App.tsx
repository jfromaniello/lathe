"use client";

import { useCallback, useEffect, useState } from "react";
import type * as THREE from "three";
import Controls from "@/components/Controls";
import Gallery from "@/components/Gallery";
import PatternPicker from "@/components/PatternPicker";
import HistoryStrip from "@/components/HistoryStrip";
import ShareButton from "@/components/ShareButton";
import Viewer from "@/components/Viewer";
import { COLORS, DEFAULT_VIEW, type MaterialKind, type ViewSettings } from "@/lib/view";
import { DEFAULT_PARAMS, bounds, type ShapeParams } from "@/lib/shape";
import { downloadBlob, makeSTL } from "@/lib/export";
import { decodeParams, decodeView, encodeAll } from "@/lib/url";
import { useHistory } from "@/hooks/useHistory";
import { useT } from "@/i18n/context";

export default function App() {
  // rendered client-only (see page.tsx), so reading the URL in the initializer is safe
  const history = useHistory<ShapeParams>(() => decodeParams(window.location.search, DEFAULT_PARAMS));
  const params = history.state;
  const setParams = history.set;
  const [view, setView] = useState<ViewSettings>(() => decodeView(window.location.search, DEFAULT_VIEW));
  const [stats, setStats] = useState<{ tris: number; x: number; y: number; z: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const t = useT();

  // keep the address bar in sync so the URL is always shareable
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = encodeAll(params, view);
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
    }, 300);
    return () => clearTimeout(t);
  }, [params, view]);

  // keyboard: ⌘Z / ⌘⇧Z (or ctrl)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (e.shiftKey) history.redo();
      else history.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history]);

  const onGeometry = useCallback((g: THREE.BufferGeometry) => {
    const b = bounds(g);
    setStats({ tris: (g.index?.count ?? 0) / 3, ...b });
  }, []);

  const exportSTL = () => {
    setExporting(true);
    setTimeout(() => {
      try {
        const blob = makeSTL(params);
        downloadBlob(blob, `lathe-${Math.round(params.height)}x${Math.round(params.radius * 2)}.stl`);
      } finally {
        setExporting(false);
      }
    }, 20);
  };

  const setV = <K extends keyof ViewSettings>(k: K, v: ViewSettings[K]) => setView((s) => ({ ...s, [k]: v }));

  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100 md:flex-row">
      <aside className="flex min-h-0 flex-1 flex-col border-b border-neutral-800 md:w-[380px] md:flex-none md:border-b-0 md:border-r">
        <div className="flex items-start justify-between gap-2 border-b border-neutral-800 p-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Lathe</h1>
            <p className="text-xs text-neutral-500">{t.app.tagline}</p>
          </div>
          <ShareButton params={params} view={view} />
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <Gallery onPick={setParams} />
          <PatternPicker params={params} onChange={setParams} />
          <Controls params={params} onChange={setParams} />
        </div>
        <div className="border-t border-neutral-800 p-4">
          {stats && (
            <div className="mb-2 text-xs text-neutral-500 tabular-nums">
              {stats.x.toFixed(1)} × {stats.y.toFixed(1)} × {stats.z.toFixed(1)} mm · {stats.tris.toLocaleString()} {t.app.trisPreview}
            </div>
          )}
          <button
            onClick={exportSTL}
            disabled={exporting}
            className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-60"
          >
            {exporting ? t.app.generating : t.app.exportStl}
          </button>
        </div>
      </aside>

      <section className="relative h-[45dvh] shrink-0 md:h-auto md:flex-1">
        <Viewer params={params} view={view} onChange={setParams} onGeometry={onGeometry} />

        {/* floating view toolbar */}
        <div className="pointer-events-none absolute right-2 top-2 flex max-w-[calc(100%-1rem)] flex-col items-end gap-1.5 md:right-3 md:top-3 md:gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 rounded-xl border border-black/10 bg-white/70 p-1 shadow-lg backdrop-blur md:p-1.5">
            {(["matte", "wood", "glass"] as MaterialKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setV("material", k)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition md:px-2.5 md:py-1 md:text-xs ${
                  view.material === k ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-black/5"
                }`}
              >
                {t.materials[k]}
              </button>
            ))}
            <div className="mx-1 h-5 w-px bg-black/10" />
            {COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setV("color", c.hex)}
                title={t.colors[c.id]}
                className={`h-5 w-5 rounded-full border-2 transition md:h-6 md:w-6 ${view.color === c.hex ? "border-neutral-900 scale-110" : "border-white/70 hover:scale-110"}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-black/10 bg-white/70 p-1.5 shadow-lg backdrop-blur">
            <button
              onClick={() => setV("showHandles", !view.showHandles)}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition md:px-2.5 md:py-1 md:text-xs ${view.showHandles ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-black/5"}`}
              title={t.viewer.handlesHint}
            >
              {t.viewer.handles}
            </button>
            <button
              onClick={() => setV("showMug", !view.showMug)}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition md:px-2.5 md:py-1 md:text-xs ${view.showMug ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-black/5"}`}
              title={t.viewer.scaleHint}
            >
              {t.viewer.scale}
            </button>
          </div>
        </div>

        {/* history */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
          <HistoryStrip
            past={history.past}
            current={params}
            onJump={history.jumpTo}
            onUndo={history.undo}
            onRedo={history.redo}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
        </div>
      </section>
    </main>
  );
}
