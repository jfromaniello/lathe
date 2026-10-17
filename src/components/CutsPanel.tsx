"use client";

import { useMemo } from "react";
import { placeCuts, wallSurface, type Cut, type CutMode, type CutShape, type ShapeParams } from "@/lib/shape";
import { useT } from "@/i18n/context";
import { Section, Slider } from "./Controls";
import type { MarkSel, MarkTool } from "./CutTools";
import { CutsPositionSliders } from "./TextsPanel";

const MODES: CutMode[] = ["pocket", "through", "both"];

/** Sidebar list of the holes: pick a punch, and edit each hole's size, place and depth by the numbers. */
export default function CutsPanel({
  params,
  onChange,
  tool,
  onTool,
  selected,
  onSelect,
}: {
  params: ShapeParams;
  onChange: (p: ShapeParams) => void;
  tool: MarkTool | null;
  onTool: (t: MarkTool | null) => void;
  selected: MarkSel | null;
  onSelect: (s: MarkSel | null) => void;
}) {
  const t = useT().cuts;
  const { problems } = useMemo(() => placeCuts(params), [params]);
  const surface = useMemo(() => wallSurface(params), [params]);
  const set = (i: number, patch: Partial<Cut>) => onChange({ ...params, cuts: params.cuts.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const remove = (i: number) => {
    onChange({ ...params, cuts: params.cuts.filter((_, j) => j !== i) });
    onSelect(null);
  };

  return (
    <Section title={t.title} open={params.cuts.length > 0 || tool !== null}>
      <p className="-mt-1 text-[11px] text-neutral-500">{params.mode === "shell" ? t.hint : t.shellOnly}</p>
      <div className="flex gap-1 rounded bg-neutral-800 p-1 text-xs">
        {(["circle", "square"] as CutShape[]).map((s) => (
          <button
            key={s}
            className={`flex-1 rounded px-2 py-1 ${tool === s ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
            onClick={() => onTool(tool === s ? null : s)}
          >
            {t[s]}
          </button>
        ))}
      </div>
      {params.cuts.length === 0 && <p className="text-xs text-neutral-500">{t.empty}</p>}
      <ul className="space-y-1.5">
        {params.cuts.map((c, i) => {
          const open = selected?.kind === "cut" && selected.i === i;
          const problem = problems[i];
          const perim = surface.perimeterAt(c.z * params.height);
          return (
            <li key={i} className={`rounded-md border ${open ? "border-amber-500/60 bg-neutral-900" : "border-neutral-800"}`}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <button className="flex flex-1 items-center gap-2 text-left" onClick={() => onSelect(open ? null : { kind: "cut", i })}>
                  <span className="text-neutral-500">{c.shape === "circle" ? "○" : "□"}</span>
                  <span className="tabular-nums text-neutral-200">{t.size(c.shape, c.w, c.h)}</span>
                  <span className="truncate text-neutral-500">{t.modeShort(c.mode, c.depth)}</span>
                </button>
                {problem && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title={t.problems[problem]} />}
                <button className="text-neutral-500 hover:text-red-400" title={t.remove} onClick={() => remove(i)}>
                  ✕
                </button>
              </div>
              {problem && <p className="px-2 pb-1 text-[11px] text-red-400">{t.problems[problem]}</p>}
              {open && (
                <div className="space-y-3 border-t border-neutral-800 p-2">
                  <div className="flex gap-1 rounded bg-neutral-800 p-1 text-xs">
                    {MODES.map((m) => (
                      <button
                        key={m}
                        className={`flex-1 rounded px-1 py-1 ${c.mode === m ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
                        onClick={() => set(i, { mode: m })}
                      >
                        {t.modes[m]}
                      </button>
                    ))}
                  </div>
                  {c.mode === "pocket" && (
                    <Slider label={t.depth} value={c.depth} min={0.2} max={Math.max(0.3, Math.round((params.wall - 0.3) * 10) / 10)} step={0.1} unit="mm" onChange={(v) => set(i, { depth: v })} />
                  )}
                  <Slider
                    label={c.shape === "circle" ? t.diameter : t.width}
                    value={c.w}
                    min={1}
                    max={Math.round(perim * 0.4)}
                    step={0.5}
                    unit="mm"
                    onChange={(v) => set(i, c.shape === "circle" ? { w: v, h: v } : { w: v })}
                  />
                  {c.shape === "square" && <Slider label={t.height} value={c.h} min={1} max={params.height} step={0.5} unit="mm" onChange={(v) => set(i, { h: v })} />}
                  <CutsPositionSliders z={c.z} u={c.u} height={params.height} onZ={(z) => set(i, { z })} onU={(u) => set(i, { u })} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
