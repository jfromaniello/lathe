import type { Dictionary } from "@/i18n/dictionaries";
import type { HoleShape, Mode, RibAlign, ShapeParams, Waveform } from "./shape";

// ---------- command palette: every setting (and a few actions) as something you can find by typing ----------

interface Base {
  id: string;
  group: string;
  label: string;
  /** Extra words to match, in both languages (people search with whatever word comes to mind). */
  keywords: string;
}
export interface NumberCommand extends Base {
  kind: "number";
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  set: (v: number) => void;
}
export interface ChoiceCommand extends Base {
  kind: "choice";
  value: string;
  options: { value: string; label: string; aliases?: string }[];
  set: (v: string) => void;
}
export interface ActionCommand extends Base {
  kind: "action";
  run: () => void;
}
export type Command = NumberCommand | ChoiceCommand | ActionCommand;

const WAVEFORMS: Waveform[] = ["scallop", "sine", "triangle", "square"];

/** The shape settings, reading `params` and writing through `onChange`. */
export function shapeCommands(t: Dictionary, params: ShapeParams, onChange: (p: ShapeParams) => void): Command[] {
  const c = t.controls;
  const set = <K extends keyof ShapeParams>(k: K) => (v: ShapeParams[K]) => onChange({ ...params, [k]: v });
  const num = (
    id: keyof ShapeParams,
    group: string,
    label: string,
    keywords: string,
    min: number,
    max: number,
    step: number,
    unit = "",
  ): NumberCommand => ({ kind: "number", id, group, label, keywords, value: params[id] as number, min, max, step, unit, set: set(id) as (v: number) => void });
  const choice = <V extends string>(id: keyof ShapeParams, group: string, label: string, keywords: string, options: { value: V; label: string; aliases?: string }[]): ChoiceCommand => ({
    kind: "choice",
    id,
    group,
    label,
    keywords,
    value: params[id] as string,
    options,
    set: set(id) as (v: string) => void,
  });
  const waves = WAVEFORMS.map((w) => ({ value: w, label: c.waveforms[w] }));
  const shape = c.shape;
  const wall = c.wall;
  const lobes = c.lobes;
  const ribs = c.advancedPattern;
  const res = c.advancedResolution;

  return [
    num("height", shape, c.height, "height tall alto altura", 20, 400, 1, "mm"),
    num("radius", shape, c.radius, "radius width diameter size wide ancho radio diámetro tamaño", 10, 150, 0.5, "mm"),
    num("squareness", shape, c.squareness, "square squareness corners box cuadrado cuadratura esquinas", 0, 1, 0.01),
    num("twist", shape, c.twist, "twist rotate spiral swirl turn giro torsión retorcer espiral girar", -360, 360, 1, "°"),
    num("slant", shape, c.slant, "slant slanted mouth bevel tilt oblique cut rim bisel boca corte inclinado pendiente sesgo borde", 0, Math.round(params.height / 2), 0.5, "mm"),
    num("slantAngle", shape, c.slantAngle, "slant direction low side angle bisel dirección lado bajo ángulo", 0, 360, 5, "°"),
    choice<Mode>("mode", wall, c.wall, "mode solid shell hollow vase mode spiralize macizo hueco lleno modo", [
      { value: "shell", label: c.shell, aliases: "hollow hueco" },
      { value: "solid", label: c.solid, aliases: "macizo lleno vase spiralize" },
    ]),
    num("wall", wall, c.wallThickness, "wall thickness thick thin pared espesor grosor fina gruesa", 0.4, 8, 0.1, "mm"),
    {
      kind: "number",
      id: "innerRib",
      group: wall,
      label: c.innerRib,
      keywords: "inside inner pattern ribs interior adentro estrías dentro",
      value: Math.round(params.innerRib * 100),
      min: 0,
      max: 100,
      step: 5,
      unit: "%",
      set: (v) => onChange({ ...params, innerRib: Math.min(1, Math.max(0, v / 100)) }),
    },
    num("bottom", wall, c.bottom, "bottom floor base fondo piso base", 0, 10, 0.1, "mm"),
    num("top", wall, c.top, "top lid cap close tapa cerrar", 0, 10, 0.1, "mm"),
    num("topHole", wall, c.topHole, "top hole opening lamp agujero abertura lámpara", 0, 60, 0.5, "mm"),
    choice<HoleShape>("topHoleShape", wall, c.topHoleShape, "hole shape circle agujero forma círculo", [
      { value: "follow", label: c.topHoleShapes.follow },
      { value: "circle", label: c.topHoleShapes.circle },
    ]),
    num("topDome", wall, c.topDome, "dome dish curvature bulge cúpula curvatura plato domo", -30, 30, 0.5, "mm"),
    {
      kind: "number",
      id: "split",
      group: c.split,
      label: c.splitAt,
      keywords: "two pieces split cut joint snap fit dos piezas encastre corte partir dividir",
      value: Math.round(params.split * params.height * 2) / 2,
      min: 0,
      max: params.height - 5,
      step: 0.5,
      unit: "mm",
      set: (v) => onChange({ ...params, split: v <= 0 ? 0 : Math.min(1, Math.max(0.01, v / params.height)) }),
    },
    num("splitLip", c.split, c.splitLip, "neck lip joint two pieces cuello encastre dos piezas", 2, 20, 0.5, "mm"),
    num("splitGap", c.split, c.splitGap, "gap clearance tolerance fit huelgo tolerancia juego", 0, 1, 0.05, "mm"),
    num("lobeCount", lobes, c.lobeCount, "lobes count petals waves lóbulos cantidad pétalos ondas", 0, 12, 1),
    num("lobeAmplitude", lobes, c.lobeAmplitude, "lobes depth amplitude lóbulos profundidad amplitud", -30, 30, 0.5, "mm"),
    choice<Waveform>("lobeWaveform", lobes, c.waveform, "lobes wave waveform lóbulos onda forma", waves),
    num("ribCount", ribs, c.ribCount, "ribs count number flutes stripes estrías cantidad número rayas", 0, 200, 1),
    num("ribAmplitude", ribs, c.ribAmplitude, "ribs depth amplitude estrías profundidad amplitud", -10, 10, 0.1, "mm"),
    choice<Waveform>("ribWaveform", ribs, c.waveform, "ribs wave waveform estrías onda forma", waves),
    num("ribSharpness", ribs, c.sharpness, "ribs sharpness square estrías filo nitidez", 0, 1, 0.01),
    num("ribStart", ribs, c.ribStart, "ribs start from begin estrías desde inicio empiezan", 0, 1, 0.01),
    num("ribEnd", ribs, c.ribEnd, "ribs end to stop estrías hasta fin terminan", 0, 1, 0.01),
    num("ribFade", ribs, c.ribFade, "ribs fade transition blend estrías transición fundido", 0, 40, 0.5, "mm"),
    choice<RibAlign>("ribAlign", ribs, c.ribAlign, "ribs align crest valley estrías alinear cresta valle", [
      { value: "center", label: c.ribAligns.center },
      { value: "crest", label: c.ribAligns.crest },
      { value: "valley", label: c.ribAligns.valley },
    ]),
    num("radialSegments", res, c.radialSegments, "resolution segments quality resolución segmentos calidad", 32, 720, 8),
    num("heightSegments", res, c.heightSegments, "resolution segments quality resolución segmentos calidad", 8, 400, 4),
  ];
}

// ---------- fuzzy search ----------

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const words = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean);

function isSubsequence(needle: string, hay: string) {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
}

/** How well one query token matches a command (0 = not at all). */
function tokenScore(token: string, cmd: Command): number {
  const label = words(cmd.label);
  const extra = [...words(cmd.group), ...words(cmd.keywords), ...(cmd.kind === "choice" ? cmd.options.flatMap((o) => words(`${o.label} ${o.aliases ?? ""}`)) : [])];
  if (label.includes(token)) return 100;
  if (label.some((w) => w.startsWith(token))) return 80;
  if (extra.includes(token)) return 60;
  if (extra.some((w) => w.startsWith(token))) return 45;
  if (token.length >= 3 && [...label, ...extra].some((w) => w.includes(token))) return 30;
  if (token.length >= 2 && isSubsequence(token, normalize(cmd.label).replace(/\s+/g, ""))) return 10;
  return 0;
}

export interface ParsedQuery {
  text: string[];
  /** A number typed (or said) after the words: "twist 90", "altura 150mm", "giro -45°". */
  value?: number;
}

export function parseQuery(query: string): ParsedQuery {
  const tokens = normalize(query)
    .replace(/,(?=\d)/g, ".") // "1,5" said or typed the Spanish way
    .split(/\s+/)
    .filter(Boolean);
  const text: string[] = [];
  let value: ParsedQuery["value"];
  for (const tok of tokens) {
    const m = tok.match(/^([+-]?)(\d+(?:\.\d+)?|\.\d+)(mm|°|%|deg|grados)?$/);
    if (m) value = Number(m[1] === "-" ? -m[2] : m[2]);
    else text.push(...words(tok));
  }
  return { text, value };
}

/** Commands matching every word of the query, best first. */
export function searchCommands(cmds: Command[], query: string): Command[] {
  const { text } = parseQuery(query);
  if (text.length === 0) return query.trim() ? [] : cmds;
  const scored: { cmd: Command; score: number; i: number }[] = [];
  cmds.forEach((cmd, i) => {
    let score = 0;
    for (const tok of text) {
      const s = tokenScore(tok, cmd);
      if (s === 0) return;
      score += s;
    }
    scored.push({ cmd, score, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((s) => s.cmd);
}

/** The option of a choice command the query names, if any ("wave sine", "modo macizo"). */
export function matchOption(cmd: ChoiceCommand, query: string): string | undefined {
  // words naming the setting itself ("wave", "pared") don't pick an option
  const label = words(cmd.label);
  const text = parseQuery(query).text.filter((tok) => !label.some((w) => w.startsWith(tok)));
  let best: { value: string; score: number } | undefined;
  for (const o of cmd.options) {
    const ow = [...words(o.label), ...words(o.aliases ?? ""), normalize(o.value)];
    const score = text.filter((tok) => ow.some((w) => w.startsWith(tok))).length;
    if (score > 0 && (!best || score > best.score)) best = { value: o.value, score };
  }
  return best?.value;
}

export const clampStep = (cmd: NumberCommand, v: number) => {
  const snapped = Math.round(v / cmd.step) * cmd.step;
  return Math.min(cmd.max, Math.max(cmd.min, Math.round(snapped * 1e6) / 1e6));
};
