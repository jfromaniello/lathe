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
          <div className="flex items-center gap-1.5">
            <a
              href="https://github.com/jfromaniello/lathe"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="Source on GitHub · MIT"
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
            <ShareButton params={params} view={view} />
          </div>
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
