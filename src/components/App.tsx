"use client";

import { useCallback, useEffect, useState } from "react";
import type * as THREE from "three";
import Controls from "@/components/Controls";
import { DEFAULT_PARAMS, PRESETS, bounds, type ShapeParams } from "@/lib/shape";
import { downloadBlob, makeSTL } from "@/lib/export";
import { decodeParams, encodeParams } from "@/lib/url";
import ShareButton from "@/components/ShareButton";
import Viewer from "@/components/Viewer";

export default function App() {
  // rendered client-only (see page.tsx), so reading the URL in the initializer is safe
  const [params, setParams] = useState<ShapeParams>(() => decodeParams(window.location.search, DEFAULT_PARAMS));
  const [stats, setStats] = useState<{ tris: number; x: number; y: number; z: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  // keep the address bar in sync so the URL is always shareable
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = encodeParams(params);
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
    }, 300);
    return () => clearTimeout(t);
  }, [params]);

  const onGeometry = useCallback((g: THREE.BufferGeometry) => {
    const b = bounds(g);
    setStats({ tris: (g.index?.count ?? 0) / 3, ...b });
  }, []);

  const exportSTL = () => {
    setExporting(true);
    // let the button re-render before the (sync) mesh generation
    setTimeout(() => {
      try {
        const blob = makeSTL(params);
        downloadBlob(blob, `lathe-${Math.round(params.height)}x${Math.round(params.radius * 2)}.stl`);
      } finally {
        setExporting(false);
      }
    }, 20);
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-neutral-800">
        <div className="border-b border-neutral-800 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Lathe</h1>
              <p className="text-xs text-neutral-500">Objetos paramétricos para imprimir en 3D</p>
            </div>
            <ShareButton params={params} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-amber-500 hover:text-amber-400"
                onClick={() => setParams({ ...p.params, radialSegments: params.radialSegments, heightSegments: params.heightSegments })}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Controls params={params} onChange={setParams} />
        </div>
        <div className="border-t border-neutral-800 p-4">
          {stats && (
            <div className="mb-2 text-xs text-neutral-500 tabular-nums">
              {stats.x.toFixed(1)} × {stats.y.toFixed(1)} × {stats.z.toFixed(1)} mm · {stats.tris.toLocaleString()} tris (preview)
            </div>
          )}
          <button
            onClick={exportSTL}
            disabled={exporting}
            className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-60"
          >
            {exporting ? "Generando…" : "Exportar STL"}
          </button>
        </div>
      </aside>
      <section className="relative flex-1">
        <Viewer params={params} onGeometry={onGeometry} />
      </section>
    </main>
  );
}
