"use client";

import { useMemo } from "react";
import { placeTexts, type ShapeParams, type TextMark } from "@/lib/shape";
import { TEXT_FONTS } from "@/lib/text";
import { useT } from "@/i18n/context";
import { Section, Slider } from "./Controls";
import type { MarkSel, MarkTool } from "./CutTools";

/** Sidebar list of the texts: what they say, in which letter, how big, raised or engraved, where. */
export default function TextsPanel({
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
  const all = useT();
  const t = all.texts;
  const { problems } = useMemo(() => placeTexts(params), [params]);
  const set = (i: number, patch: Partial<TextMark>) => onChange({ ...params, texts: params.texts.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const remove = (i: number) => {
    onChange({ ...params, texts: params.texts.filter((_, j) => j !== i) });
    onSelect(null);
  };
  const maxEngrave = params.mode === "shell" ? Math.max(0.3, Math.round((params.wall - 0.3) * 10) / 10) : 5;

  return (
    <Section title={t.title} open={params.texts.length > 0 || tool === "text"}>
      <p className="-mt-1 text-[11px] text-neutral-500">{t.hint}</p>
      <button
        className={`w-full rounded px-2 py-1 text-xs ${tool === "text" ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}
        onClick={() => onTool(tool === "text" ? null : "text")}
      >
        {t.tool}
      </button>
      {params.texts.length === 0 && <p className="text-xs text-neutral-500">{t.empty}</p>}
      <ul className="space-y-1.5">
        {params.texts.map((m, i) => {
          const open = selected?.kind === "text" && selected.i === i;
          const problem = problems[i];
          return (
            <li key={i} className={`rounded-md border ${open ? "border-amber-500/60 bg-neutral-900" : "border-neutral-800"}`}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <button className="flex flex-1 items-center gap-2 truncate text-left" onClick={() => onSelect(open ? null : { kind: "text", i })}>
                  <span className="text-neutral-500">T</span>
                  <span className="truncate text-neutral-200">{m.text || "…"}</span>
                  <span className="shrink-0 text-neutral-500">{m.raised ? t.relief.raised : t.relief.engraved}</span>
                </button>
                {problem && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title={t.problems[problem]} />}
                <button className="text-neutral-500 hover:text-red-400" title={all.cuts.remove} onClick={() => remove(i)}>
                  ✕
                </button>
              </div>
              {problem && <p className="px-2 pb-1 text-[11px] text-red-400">{t.problems[problem]}</p>}
              {open && (
                <div className="space-y-3 border-t border-neutral-800 p-2">
                  <label className="block text-xs text-neutral-400">
                    {t.text}
                    <input
                      className="mt-1 w-full rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
                      value={m.text}
                      maxLength={120}
                      autoFocus
                      onChange={(e) => set(i, { text: e.target.value })}
                    />
                  </label>
                  <div>
                    <div className="mb-1 text-xs text-neutral-400">{t.font}</div>
                    <div className="grid grid-cols-2 gap-1 rounded bg-neutral-800 p-1 text-xs">
                      {TEXT_FONTS.map((f) => (
                        <button
                          key={f}
                          className={`rounded px-2 py-1 ${m.font === f ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
                          style={{ fontFamily: f === "serif" ? "Georgia, serif" : f === "script" ? "cursive" : f === "condensed" ? "Impact, sans-serif" : undefined }}
                          onClick={() => set(i, { font: f })}
                        >
                          {t.fonts[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 rounded bg-neutral-800 p-1 text-xs">
                    {[true, false].map((raised) => (
                      <button
                        key={String(raised)}
                        className={`flex-1 rounded px-2 py-1 ${m.raised === raised ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
                        onClick={() => set(i, { raised, depth: raised ? m.depth : Math.min(m.depth, maxEngrave) })}
                      >
                        {raised ? t.relief.raised : t.relief.engraved}
                      </button>
                    ))}
                  </div>
                  <Slider label={t.size} value={m.size} min={3} max={80} step={0.5} unit="mm" onChange={(v) => set(i, { size: v })} />
                  <Slider
                    label={m.raised ? t.depth : t.depthEngraved}
                    value={m.depth}
                    min={0.2}
                    max={m.raised ? 5 : maxEngrave}
                    step={0.1}
                    unit="mm"
                    onChange={(v) => set(i, { depth: v })}
                  />
                  <CutsPositionSliders
                    z={m.z}
                    u={m.u}
                    height={params.height}
                    onZ={(z) => set(i, { z })}
                    onU={(u) => set(i, { u })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Height of the centre and position round the piece, shared by holes and texts. */
export function CutsPositionSliders({ z, u, height, onZ, onU }: { z: number; u: number; height: number; onZ: (z: number) => void; onU: (u: number) => void }) {
  const t = useT().cuts;
  return (
    <>
      <Slider label={t.at} value={Math.round(z * height * 2) / 2} min={0} max={height} step={0.5} unit="mm" onChange={(v) => onZ(Math.min(1, Math.max(0, v / height)))} />
      <Slider label={t.around} value={Math.round(u * 360)} min={0} max={360} step={1} unit="°" onChange={(v) => onU((((v / 360) % 1) + 1) % 1)} />
    </>
  );
}
