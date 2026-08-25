"use client";

import { effectiveRadialSegments, type ShapeParams, type Waveform, type Mode, type RibAlign, type HoleShape } from "@/lib/shape";
import { useT } from "@/i18n/context";
import ProfileEditor from "./ProfileEditor";

const WAVEFORMS: Waveform[] = ["scallop", "sine", "triangle", "square"];
const ALIGNS: RibAlign[] = ["center", "crest", "valley"];
const HOLE_SHAPES: HoleShape[] = ["circle", "follow"];

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            className="w-16 rounded bg-neutral-800 px-1 py-0.5 text-right text-neutral-100 tabular-nums"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="w-6 text-neutral-500">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        className="mt-1 w-full accent-amber-500"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Section({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-t border-neutral-800 pt-3">
      <summary className="cursor-pointer text-sm font-medium text-neutral-200">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export default function Controls({ params, onChange }: { params: ShapeParams; onChange: (p: ShapeParams) => void }) {
  const t = useT().controls;
  const set = <K extends keyof ShapeParams>(k: K, v: ShapeParams[K]) => onChange({ ...params, [k]: v });
  const isShell = params.mode === "shell";

  return (
    <div className="space-y-4">
      <Section title={t.shape}>
        <p className="-mt-1 text-[11px] text-neutral-500">
          {t.tip.prefix} <span className="text-amber-400">●</span> {t.tip.profile} <span className="text-sky-400">▲</span> {t.tip.height}{" "}
          <span className="text-green-400">■</span> {t.tip.radius} <span className="text-purple-400">○</span> {t.tip.twist}
        </p>
        <Slider label={t.height} value={params.height} min={20} max={400} unit="mm" onChange={(v) => set("height", v)} />
        <Slider label={t.radius} value={params.radius} min={10} max={150} step={0.5} unit="mm" onChange={(v) => set("radius", v)} />
        <Slider label={t.squareness} value={params.squareness} min={0} max={1} step={0.01} onChange={(v) => set("squareness", v)} />
        <Slider label={t.twist} value={params.twist} min={-360} max={360} unit="°" onChange={(v) => set("twist", v)} />
        <div>
          <div className="mb-1 text-xs text-neutral-400">{t.profile}</div>
          <ProfileEditor profile={params.profile} onChange={(p) => set("profile", p)} />
          <button className="mt-1 text-xs text-neutral-500 hover:text-neutral-300" onClick={() => set("profile", params.profile.map(() => 1))}>
            {t.resetProfile}
          </button>
        </div>
      </Section>

      <Section title={t.wall}>
        <div className="flex gap-1 rounded bg-neutral-800 p-1 text-xs">
          {(["shell", "solid"] as Mode[]).map((m) => (
            <button
              key={m}
              className={`flex-1 rounded px-2 py-1 ${params.mode === m ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
              onClick={() => set("mode", m)}
            >
              {m === "shell" ? t.shell : t.solid}
            </button>
          ))}
        </div>
        {isShell ? (
          <>
            <Slider label={t.wallThickness} value={params.wall} min={0.4} max={8} step={0.1} unit="mm" onChange={(v) => set("wall", v)} />
            <Slider label={t.bottom} value={params.bottom} min={0} max={10} step={0.1} unit="mm" onChange={(v) => set("bottom", v)} />
            <Slider label={t.top} value={params.top} min={0} max={10} step={0.1} unit="mm" onChange={(v) => set("top", v)} />
            {params.top > 0 && (
              <>
                <Slider label={t.topHole} value={params.topHole} min={0} max={60} step={0.5} unit="mm" onChange={(v) => set("topHole", v)} />
                <div>
                  <div className="mb-1 text-xs text-neutral-400">{t.topHoleShape}</div>
                  <div className="flex gap-1 rounded bg-neutral-800 p-1 text-xs">
                    {HOLE_SHAPES.map((s) => (
                      <button
                        key={s}
                        className={`flex-1 rounded px-2 py-1 ${params.topHoleShape === s ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
                        onClick={() => set("topHoleShape", s)}
                      >
                        {t.topHoleShapes[s]}
                      </button>
                    ))}
                  </div>
                  {params.topHoleShape === "follow" && <p className="mt-1 text-[11px] text-neutral-500">{t.topHoleFollowHint}</p>}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-xs text-neutral-500">
            {t.solidHint.before} <em>{t.solidHint.em}</em> {t.solidHint.after}
          </p>
        )}
      </Section>

      <Section title={t.advancedPattern} open={false}>
        <Slider label={t.ribCount} value={params.ribCount} min={0} max={200} onChange={(v) => set("ribCount", v)} />
        <Slider label={t.ribAmplitude} value={params.ribAmplitude} min={-10} max={10} step={0.1} unit="mm" onChange={(v) => set("ribAmplitude", v)} />
        <label className="block text-xs text-neutral-400">
          {t.waveform}
          <select
            className="mt-1 w-full rounded bg-neutral-800 px-2 py-1 text-neutral-100"
            value={params.ribWaveform}
            onChange={(e) => set("ribWaveform", e.target.value as Waveform)}
          >
            {WAVEFORMS.map((w) => (
              <option key={w} value={w}>
                {t.waveforms[w]}
              </option>
            ))}
          </select>
        </label>
        {params.ribWaveform === "square" && (
          <Slider label={t.sharpness} value={params.ribSharpness} min={0} max={1} step={0.01} onChange={(v) => set("ribSharpness", v)} />
        )}
        <Slider label={t.ribStart} value={params.ribStart} min={0} max={1} step={0.01} onChange={(v) => set("ribStart", v)} />
        <Slider label={t.ribEnd} value={params.ribEnd} min={0} max={1} step={0.01} onChange={(v) => set("ribEnd", v)} />
        <Slider label={t.ribFade} value={params.ribFade} min={0} max={40} step={0.5} unit="mm" onChange={(v) => set("ribFade", v)} />
        <div>
          <div className="mb-1 text-xs text-neutral-400">{t.ribAlign}</div>
          <div className="flex gap-1 rounded bg-neutral-800 p-1 text-xs">
            {ALIGNS.map((a) => (
              <button
                key={a}
                className={`flex-1 rounded px-2 py-1 ${params.ribAlign === a ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
                onClick={() => set("ribAlign", a)}
              >
                {t.ribAligns[a]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">{t.ribAlignHint}</p>
        </div>
      </Section>

      <Section title={t.advancedResolution} open={false}>
        <Slider label={t.radialSegments} value={params.radialSegments} min={32} max={720} step={8} onChange={(v) => set("radialSegments", v)} />
        <Slider label={t.heightSegments} value={params.heightSegments} min={8} max={400} step={4} onChange={(v) => set("heightSegments", v)} />
        <p className="text-xs text-neutral-500">{t.resolutionHint(effectiveRadialSegments(params))}</p>
      </Section>
    </div>
  );
}
