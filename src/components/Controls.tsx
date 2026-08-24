"use client";

import { effectiveRadialSegments, type ShapeParams, type Waveform, type Mode } from "@/lib/shape";
import ProfileEditor from "./ProfileEditor";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group border-t border-neutral-800 pt-3">
      <summary className="cursor-pointer text-sm font-medium text-neutral-200">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export default function Controls({ params, onChange }: { params: ShapeParams; onChange: (p: ShapeParams) => void }) {
  const set = <K extends keyof ShapeParams>(k: K, v: ShapeParams[K]) => onChange({ ...params, [k]: v });
  const isShell = params.mode === "shell";

  return (
    <div className="space-y-4">
      <Section title="Forma">
        <Slider label="Altura" value={params.height} min={20} max={400} unit="mm" onChange={(v) => set("height", v)} />
        <Slider label="Radio" value={params.radius} min={10} max={150} step={0.5} unit="mm" onChange={(v) => set("radius", v)} />
        <Slider label="Cuadrado" value={params.squareness} min={0} max={1} step={0.01} onChange={(v) => set("squareness", v)} />
        <Slider label="Twist" value={params.twist} min={-360} max={360} unit="°" onChange={(v) => set("twist", v)} />
        <div>
          <div className="mb-1 text-xs text-neutral-400">Perfil (arrastrá los puntos · se enganchan entre sí, Alt para libre)</div>
          <ProfileEditor profile={params.profile} onChange={(p) => set("profile", p)} />
          <button
            className="mt-1 text-xs text-neutral-500 hover:text-neutral-300"
            onClick={() => set("profile", params.profile.map(() => 1))}
          >
            reset perfil
          </button>
        </div>
      </Section>

      <Section title="Estrías / Patrón">
        <Slider label="Cantidad" value={params.ribCount} min={0} max={200} onChange={(v) => set("ribCount", v)} />
        <Slider label="Profundidad" value={params.ribAmplitude} min={-10} max={10} step={0.1} unit="mm" onChange={(v) => set("ribAmplitude", v)} />
        <label className="block text-xs text-neutral-400">
          Onda
          <select
            className="mt-1 w-full rounded bg-neutral-800 px-2 py-1 text-neutral-100"
            value={params.ribWaveform}
            onChange={(e) => set("ribWaveform", e.target.value as Waveform)}
          >
            <option value="scallop">Estría redondeada (scallop)</option>
            <option value="sine">Seno (suave)</option>
            <option value="triangle">Triángulo</option>
            <option value="square">Cuadrada</option>
          </select>
        </label>
        {params.ribWaveform === "square" && (
          <Slider label="Filo" value={params.ribSharpness} min={0} max={1} step={0.01} onChange={(v) => set("ribSharpness", v)} />
        )}
        <Slider label="Desde" value={params.ribStart} min={0} max={1} step={0.01} onChange={(v) => set("ribStart", v)} />
        <Slider label="Hasta" value={params.ribEnd} min={0} max={1} step={0.01} onChange={(v) => set("ribEnd", v)} />
        <Slider label="Transición" value={params.ribFade} min={0} max={40} step={0.5} unit="mm" onChange={(v) => set("ribFade", v)} />
      </Section>

      <Section title="Pared / Hueco">
        <div className="flex gap-1 rounded bg-neutral-800 p-1 text-xs">
          {(["shell", "solid"] as Mode[]).map((m) => (
            <button
              key={m}
              className={`flex-1 rounded px-2 py-1 ${params.mode === m ? "bg-amber-500 text-black" : "text-neutral-300 hover:bg-neutral-700"}`}
              onClick={() => set("mode", m)}
            >
              {m === "shell" ? "Con pared" : "Sólido (vase mode)"}
            </button>
          ))}
        </div>
        {isShell ? (
          <>
            <Slider label="Espesor pared" value={params.wall} min={0.4} max={8} step={0.1} unit="mm" onChange={(v) => set("wall", v)} />
            <Slider label="Fondo (0 = abierto)" value={params.bottom} min={0} max={10} step={0.1} unit="mm" onChange={(v) => set("bottom", v)} />
            <Slider label="Tapa (0 = abierta)" value={params.top} min={0} max={10} step={0.1} unit="mm" onChange={(v) => set("top", v)} />
            {params.top > 0 && (
              <Slider label="Agujero tapa (radio)" value={params.topHole} min={0} max={60} step={0.5} unit="mm" onChange={(v) => set("topHole", v)} />
            )}
          </>
        ) : (
          <p className="text-xs text-neutral-500">
            Exporta el volumen lleno. Imprimilo en <em>vase mode / spiralize</em> en el slicer: una sola pared continua, sin
            costuras.
          </p>
        )}
      </Section>

      <Section title="Resolución preview">
        <Slider label="Segmentos radiales" value={params.radialSegments} min={32} max={720} step={8} onChange={(v) => set("radialSegments", v)} />
        <Slider label="Segmentos altura" value={params.heightSegments} min={8} max={400} step={4} onChange={(v) => set("heightSegments", v)} />
        <p className="text-xs text-neutral-500">
          Se usan {effectiveRadialSegments(params)} segmentos radiales (múltiplo de la cantidad de estrías, para que el patrón
          no se aliase). El STL se exporta siempre en alta resolución.
        </p>
      </Section>
    </div>
  );
}
