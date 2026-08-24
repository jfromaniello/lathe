"use client";

import { DEFAULT_PARAMS, type ShapeParams } from "@/lib/shape";
import { PATTERNS, applyPattern, matchPattern, patternIntensity } from "@/lib/patterns";
import Thumb from "./Thumb";

// swatches are rendered on a short neutral cylinder so the pattern is what you compare
const SWATCH_BASE: ShapeParams = { ...DEFAULT_PARAMS, height: 70, radius: 40, squareness: 0, profile: [1, 1, 1, 1, 1, 1, 1], ribStart: 0, ribEnd: 1, twist: 0, mode: "solid" };

export default function PatternPicker({ params, onChange }: { params: ShapeParams; onChange: (p: ShapeParams) => void }) {
  const current = matchPattern(params);
  const intensity = current ? patternIntensity(params, current) : 1;

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-neutral-200">Textura</div>
      <div className="grid grid-cols-4 gap-1.5">
        {PATTERNS.map((pat) => {
          const active = current?.id === pat.id;
          const swatch = applyPattern(SWATCH_BASE, pat, 1);
          return (
            <button
              key={pat.id}
              onClick={() => onChange(applyPattern(params, pat, active ? intensity : 1))}
              className={`overflow-hidden rounded-md border text-center transition ${
                active ? "border-amber-500 bg-amber-500/10" : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-600"
              }`}
              title={pat.name}
            >
              <div className="aspect-square w-full p-0.5">
                <Thumb params={swatch} options={{ azimuth: 20 }} className="h-full w-full object-cover" />
              </div>
              <div className="truncate px-1 pb-1 text-[10px] leading-tight text-neutral-300">{pat.name}</div>
            </button>
          );
        })}
      </div>
      {current && current.id !== "smooth" && (
        <label className="mt-2 block">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Intensidad</span>
            <span className="tabular-nums">{intensity.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={2.5}
            step={0.1}
            value={intensity}
            onChange={(e) => onChange(applyPattern(params, current, Number(e.target.value)))}
            className="mt-1 w-full accent-amber-500"
          />
        </label>
      )}
      {!current && (
        <p className="mt-2 text-xs text-neutral-500">Patrón personalizado (ver Avanzado).</p>
      )}
    </div>
  );
}
