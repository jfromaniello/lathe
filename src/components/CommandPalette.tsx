"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clampStep, matchOption, parseQuery, searchCommands, shapeCommands, type ChoiceCommand, type Command, type NumberCommand } from "@/lib/commands";
import { GALLERY, PATTERNS, applyPattern, galleryName, patternName, randomParams } from "@/lib/patterns";
import { COLORS, MATERIALS, type ViewSettings } from "@/lib/view";
import type { ShapeParams } from "@/lib/shape";
import { useLang, useT } from "@/i18n/context";

// minimal Web Speech API surface (not in the TS DOM lib)
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
const speechCtor = (): (new () => Recognition) | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const fmtNum = (cmd: NumberCommand, v: number) => {
  const decimals = cmd.step >= 1 ? 0 : cmd.step >= 0.1 ? 1 : 2;
  return `${v.toFixed(decimals)}${cmd.unit ? ` ${cmd.unit}` : ""}`;
};
const display = (cmd: Command) =>
  cmd.kind === "number" ? fmtNum(cmd, cmd.value) : cmd.kind === "choice" ? (cmd.options.find((o) => o.value === cmd.value)?.label ?? cmd.value) : "";

/** Mounted only while open (so it starts fresh every time). */
export default function CommandPalette({
  onClose,
  params,
  onChange,
  view,
  onView,
  onExport,
}: {
  onClose: () => void;
  params: ShapeParams;
  onChange: (p: ShapeParams) => void;
  view: ViewSettings;
  onView: (v: ViewSettings) => void;
  onExport: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const tp = t.palette;
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [buffer, setBuffer] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const original = useRef<{ params: ShapeParams; view: ViewSettings } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<Recognition | null>(null);

  const commands = useMemo<Command[]>(() => {
    const viewChoice = (id: "material" | "color", label: string, keywords: string, options: { value: string; label: string }[]): ChoiceCommand => ({
      kind: "choice",
      id,
      group: tp.view,
      label,
      keywords,
      value: view[id],
      options,
      set: (v) => onView({ ...view, [id]: v }),
    });
    const toggle = (id: "showHandles" | "showMug", label: string, keywords: string): ChoiceCommand => ({
      kind: "choice",
      id,
      group: tp.view,
      label,
      keywords,
      value: view[id] ? "on" : "off",
      options: [
        { value: "on", label: tp.on },
        { value: "off", label: tp.off },
      ],
      set: (v) => onView({ ...view, [id]: v === "on" }),
    });
    return [
      ...shapeCommands(t, params, onChange),
      ...PATTERNS.map(
        (pat): Command => ({
          kind: "action",
          id: `pattern:${pat.id}`,
          group: t.patterns.title,
          label: patternName(pat, t),
          keywords: `pattern texture textura patrón ${pat.name}`,
          run: () => onChange(applyPattern(params, pat, 1)),
        }),
      ),
      ...GALLERY.map(
        (g): Command => ({
          kind: "action",
          id: `preset:${g.id}`,
          group: t.gallery.title,
          label: galleryName(g, t),
          keywords: `preset example start ejemplo plantilla ${g.name}`,
          run: () => onChange(g.params),
        }),
      ),
      {
        kind: "action",
        id: "random",
        group: t.gallery.title,
        label: t.gallery.random.replace(/^✦\s*/, ""),
        keywords: "random surprise aleatorio sorprendeme azar",
        run: () => onChange(randomParams()),
      },
      viewChoice("material", tp.material, "material finish wood glass translucent acabado madera vidrio", MATERIALS.map((m) => ({ value: m, label: t.materials[m] }))),
      viewChoice("color", tp.color, "color colour paint pintar", COLORS.map((c) => ({ value: c.hex, label: t.colors[c.id] }))),
      toggle("showHandles", t.viewer.handles.replace(/^\S+\s*/, ""), "handles drag manijas arrastrar"),
      toggle("showMug", t.viewer.scale.replace(/^\S+\s*/, ""), "scale mug size cup taza escala tamaño"),
      { kind: "action", id: "export", group: tp.actions, label: t.app.exportStl, keywords: "export download stl 3mf print exportar descargar imprimir", run: onExport },
    ];
  }, [t, tp, params, onChange, view, onView, onExport]);

  // the speech callbacks outlive renders: they read the latest commands / state from here
  const latest = useRef({ commands, params, view });
  useEffect(() => {
    latest.current = { commands, params, view };
  });

  const results = useMemo(() => searchCommands(commands, query).slice(0, 8), [commands, query]);
  const current = editing ? commands.find((c) => c.id === editing) : undefined;

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(id);
  }, [flash]);

  // clicking anywhere else (the 3D view, the sidebar) closes it, unless the mic is on
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node) && !recRef.current) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  useEffect(() => () => recRef.current?.stop(), []);

  const startEdit = (cmd: Command, q: string) => {
    original.current = { params: latest.current.params, view: latest.current.view };
    setEditing(cmd.id);
    setBuffer("");
    if (cmd.kind === "choice") {
      const opt = matchOption(cmd, q);
      if (opt && opt !== cmd.value) cmd.set(opt);
    }
  };
  const endEdit = () => {
    setEditing(null);
    setBuffer("");
    setQuery("");
    setSel(0);
  };

  /** "altura 150", "wave sine", "fluted": applies straight away. Returns a message, or null when it needs more input. */
  const applyDirect = (cmd: Command, q: string): string | null => {
    const { value } = parseQuery(q);
    if (cmd.kind === "number" && value !== undefined) {
      const v = clampStep(cmd, value);
      cmd.set(v);
      return `${cmd.label} → ${fmtNum(cmd, v)}`;
    }
    if (cmd.kind === "choice") {
      const opt = matchOption(cmd, q);
      if (opt) {
        cmd.set(opt);
        return `${cmd.label} → ${cmd.options.find((o) => o.value === opt)?.label}`;
      }
    }
    if (cmd.kind === "action") {
      cmd.run();
      return cmd.label;
    }
    return null;
  };

  const choose = (cmd: Command) => {
    const msg = applyDirect(cmd, query);
    if (msg) {
      setFlash(msg);
      setQuery("");
      setSel(0);
      if (cmd.id === "export") onClose();
    } else startEdit(cmd, query);
  };

  const nudge = (cmd: Command, dir: 1 | -1, big: boolean) => {
    if (cmd.kind === "number") cmd.set(clampStep(cmd, cmd.value + dir * cmd.step * (big ? 10 : 1)));
    else if (cmd.kind === "choice") {
      const i = cmd.options.findIndex((o) => o.value === cmd.value);
      cmd.set(cmd.options[(i + dir + cmd.options.length) % cmd.options.length].value);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (current) {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        nudge(current, 1, e.shiftKey);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        nudge(current, -1, e.shiftKey);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const n = Number(buffer.replace(",", "."));
        if (buffer && Number.isFinite(n) && current.kind === "number") current.set(clampStep(current, n));
        endEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (original.current) {
          onChange(original.current.params);
          onView(original.current.view);
        }
        endEdit();
      } else if (e.key === "Backspace" && buffer === "") {
        e.preventDefault();
        endEdit();
      } else if (current.kind === "choice" && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const o = current.options[Number(e.key) - 1];
        if (o) current.set(o.value);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[sel];
      if (cmd) choose(cmd);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // ---------- voice: say "altura ciento cincuenta", "giro 90", "estriado"… ----------
  const Speech = speechCtor();
  const toggleMic = () => {
    if (recRef.current) {
      recRef.current.stop();
      return;
    }
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = lang === "es" ? "es-AR" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = e.results[i][0].transcript.trim();
        if (!e.results[i].isFinal) {
          setEditing(null);
          setQuery(said);
          continue;
        }
        const best = searchCommands(latest.current.commands, said)[0];
        const msg = best ? applyDirect(best, said) : null;
        if (msg) {
          setFlash(`🎙 ${msg}`);
          setQuery("");
        } else if (best) {
          startEdit(best, said);
        } else {
          setFlash(`🎙 ${tp.notUnderstood(said)}`);
          setQuery("");
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setFlash(tp.micBlocked);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={boxRef} className="pointer-events-auto absolute left-2 top-2 z-20 w-[min(400px,calc(100%-1rem))] md:left-3 md:top-3 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/90 text-neutral-100 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-white/10 px-3">
        <span className="text-neutral-500">{current ? "✎" : "⌘"}</span>
        <input
          ref={inputRef}
          autoFocus
          value={current ? buffer : query}
          onChange={(e) => {
            if (current) setBuffer(e.target.value.replace(/[^0-9.,-]/g, ""));
            else {
              setQuery(e.target.value);
              setSel(0);
            }
          }}
          onKeyDown={onKeyDown}
          placeholder={current ? (current.kind === "number" ? tp.typeValue : tp.pickOption) : listening ? tp.listening : tp.placeholder}
          className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
          spellCheck={false}
          autoComplete="off"
        />
        {Speech && (
          <button
            onClick={toggleMic}
            title={listening ? tp.micStop : tp.micStart}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${listening ? "animate-pulse bg-red-500 text-white" : "text-neutral-400 hover:bg-white/10 hover:text-white"}`}
          >
            🎙
          </button>
        )}
      </div>

      {current ? (
        <EditView cmd={current} buffer={buffer} />
      ) : (
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <li className="px-3 py-3 text-xs text-neutral-500">{tp.empty}</li>}
          {results.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => {
                  choose(cmd);
                  inputRef.current?.focus();
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === sel ? "bg-amber-500/15 text-white" : "text-neutral-300"}`}
              >
                <span className="truncate">{cmd.label}</span>
                <span className="truncate text-[11px] text-neutral-500">{cmd.group}</span>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-neutral-400">{display(cmd)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-1.5 text-[11px] text-neutral-500">
        <span className="truncate">{flash ?? (current ? (current.kind === "number" ? tp.hintEditNumber : tp.hintEditChoice) : tp.hintSearch)}</span>
      </div>
    </div>
  );
}

function EditView({ cmd, buffer }: { cmd: Command; buffer: string }) {
  if (cmd.kind === "number") {
    const f = (cmd.value - cmd.min) / (cmd.max - cmd.min || 1);
    return (
      <div className="px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-neutral-300">
            {cmd.label} <span className="text-[11px] text-neutral-500">{cmd.group}</span>
          </span>
          <span className="text-2xl font-semibold tabular-nums text-amber-400">{buffer ? `${buffer}${cmd.unit ? ` ${cmd.unit}` : ""}` : fmtNum(cmd, cmd.value)}</span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-amber-500" style={{ width: `${Math.min(1, Math.max(0, f)) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-500">
          <span>{fmtNum(cmd, cmd.min)}</span>
          <span>{fmtNum(cmd, cmd.max)}</span>
        </div>
      </div>
    );
  }
  if (cmd.kind === "choice") {
    return (
      <div className="px-4 py-3">
        <div className="text-sm text-neutral-300">
          {cmd.label} <span className="text-[11px] text-neutral-500">{cmd.group}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {cmd.options.map((o, i) => (
            <button
              key={o.value}
              onClick={() => cmd.set(o.value)}
              className={`rounded-md px-2 py-1 text-xs ${o.value === cmd.value ? "bg-amber-500 text-black" : "bg-white/5 text-neutral-300 hover:bg-white/10"}`}
            >
              <span className="mr-1 opacity-50">{i + 1}</span>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
