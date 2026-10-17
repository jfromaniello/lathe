"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { placeCuts, placeTexts, wallSurface, type Cut, type CutShape, type ShapeParams, type TextMark } from "@/lib/shape";
import { textOutline } from "@/lib/text";
import { useT } from "@/i18n/context";

type Surface = ReturnType<typeof wallSurface>;

/** Model coordinates (z up) → world (y up): the model group is turned -90° about x. */
const toWorld = ([x, y, z]: [number, number, number]) => new THREE.Vector3(x, z, -y);

/** Outline of a cut on the outer surface, a hair outside it so the line doesn't sink into the wall. */
function outlinePoints(s: Surface, c: Cut, u: number): THREE.Vector3[] {
  const zc = c.z * s.height;
  const perim = s.perimeterAt(zc);
  const pts: [number, number][] = [];
  if (c.shape === "circle") {
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      pts.push([(Math.cos(a) * c.w) / 2, (Math.sin(a) * c.w) / 2]);
    }
  } else {
    const corners: [number, number][] = [
      [-c.w / 2, -c.h / 2],
      [c.w / 2, -c.h / 2],
      [c.w / 2, c.h / 2],
      [-c.w / 2, c.h / 2],
    ];
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e];
      const [bx, by] = corners[(e + 1) % 4];
      for (let k = 0; k < 16; k++) pts.push([ax + ((bx - ax) * k) / 16, ay + ((by - ay) * k) / 16]);
    }
    pts.push(corners[0]);
  }
  return pts.map(([x, y]) => toWorld(s.over(u + x / perim, zc + y)));
}

/** Box round a text on the outer surface (the letters themselves are in the mesh). */
function boxPoints(s: Surface, u: number, zMm: number, w: number, h: number): THREE.Vector3[] {
  const perim = s.perimeterAt(zMm);
  const corners: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  const pts: THREE.Vector3[] = [];
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = corners[e];
    const [bx, by] = corners[(e + 1) % 4];
    for (let k = 0; k < 16; k++) pts.push(toWorld(s.over(u + (ax + ((bx - ax) * k) / 16) / perim, zMm + ay + ((by - ay) * k) / 16, 1.2)));
  }
  pts.push(pts[0].clone());
  return pts;
}

const round = (n: number, step: number) => Math.round(n / step) * step;

/** What the punch / lettering tool is set to, and which mark is picked. */
export type MarkTool = CutShape | "text";
export interface MarkSel {
  kind: "cut" | "text";
  i: number;
}
const same = (a: MarkSel | null, b: MarkSel | null) => !!a && !!b && a.kind === b.kind && a.i === b.i;

export interface CutToolsHandle {
  /** The model was pressed (with a punch selected): start drawing a hole there. */
  onModelDown: (e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Hole punch, inside the canvas: draws the outline and size of every hole, lets you drag one by its dot, and (with a
 * punch picked) draws a new one: press where its centre goes, drag out to its size.
 */
export default function CutTools({
  params,
  onChange,
  tool,
  selected,
  onSelect,
  handleRef,
}: {
  params: ShapeParams;
  onChange: (p: ShapeParams) => void;
  tool: MarkTool | null;
  selected: MarkSel | null;
  onSelect: (s: MarkSel | null) => void;
  handleRef: React.RefObject<CutToolsHandle | null>;
}) {
  const tt = useT();
  const t = tt.cuts;
  const { camera, controls, gl } = useThree();
  const surface = useMemo(() => wallSurface(params), [params]);
  const { problems } = useMemo(() => placeCuts(params), [params]);
  const textProblems = useMemo(() => placeTexts(params).problems, [params]);
  const [hover, setHover] = useState<MarkSel | null>(null);
  const [dragging, setDragging] = useState<MarkSel | null>(null);
  useCursor(hover !== null || dragging !== null, dragging !== null ? "grabbing" : "grab");

  // event handlers outlive renders: read the latest state from a ref
  const latest = useRef({ params, onChange, surface, onSelect });
  useEffect(() => {
    latest.current = { params, onChange, surface, onSelect };
  });
  // OrbitControls must be paused while drawing or dragging; mutate through a ref (event handlers only)
  const controlsRef = useRef<{ enabled: boolean } | null>(null);
  useEffect(() => {
    controlsRef.current = controls as unknown as { enabled: boolean } | null;
  }, [controls]);
  const setOrbit = (on: boolean) => {
    if (controlsRef.current) controlsRef.current.enabled = on;
  };

  /** Where the pointer's ray meets the (smooth) outer surface: holes don't let it fall through to the far wall. */
  const hitAt = (ev: { clientX: number; clientY: number }) => {
    const r = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const { origin: o, direction: d } = ray.ray;
    // world (y up) → model (z up)
    return latest.current.surface.raycast([o.x, -o.z, o.y], [d.x, -d.z, d.y]);
  };

  /** Follows the pointer until it is released, calling `move` with the drag in px since the press. */
  const track = (e: { clientX: number; clientY: number; pointerId: number }, move: (dx: number, dy: number, ev: PointerEvent) => void, done: (moved: boolean) => void) => {
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    setOrbit(false);
    const el = gl.domElement;
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 3) moved = true;
      if (moved) move(ev.clientX - x0, ev.clientY - y0, ev);
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setOrbit(true);
      done(moved);
    };
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // drawing a new hole: centre where pressed, size from the drag
  useEffect(() => {
    handleRef.current = {
      onModelDown: (e) => {
        if (!tool || e.button !== 0) return;
        e.stopPropagation();
        const { params: base, surface: s } = latest.current;
        const m = new THREE.Vector3(e.point.x, -e.point.z, e.point.y); // world → model
        const at = s.locate(m.x, m.y, m.z);
        if (tool === "text") {
          // lettering: drop it where pressed (and keep following the pointer while held)
          const index = base.texts.length;
          const mark: TextMark = { text: tt.texts.sample, font: "sans", u: at.u, z: at.z / base.height, size: 14, depth: 0.8, raised: true };
          const next = { ...base, texts: [...base.texts, mark] };
          latest.current.onChange(next);
          latest.current.onSelect({ kind: "text", i: index });
          setDragging({ kind: "text", i: index });
          track(
            e.nativeEvent,
            (_dx, _dy, ev) => {
              const hit = hitAt(ev);
              if (!hit) return;
              const texts = next.texts.slice();
              texts[index] = { ...mark, u: hit.u - Math.floor(hit.u), z: Math.min(1, Math.max(0, hit.z / base.height)) };
              latest.current.onChange({ ...next, texts });
            },
            () => setDragging(null),
          );
          return;
        }
        const perim = s.perimeterAt(at.z);
        const index = base.cuts.length;
        const make = (w: number, h: number): Cut => ({
          shape: tool,
          mode: "through",
          u: at.u,
          z: at.z / base.height,
          w: Math.max(1, w),
          h: Math.max(1, tool === "circle" ? w : h),
          depth: round(base.wall / 2, 0.1),
        });
        latest.current.onSelect({ kind: "cut", i: index });
        setDragging({ kind: "cut", i: index });
        track(
          e.nativeEvent,
          (_dx, _dy, ev) => {
            // the edge follows the pointer: size from the centre to where the pointer is on the surface
            const hit = hitAt(ev);
            if (!hit) return;
            let du = hit.u - at.u;
            du -= Math.round(du);
            const a = du * perim;
            const b = hit.z - at.z;
            let w = tool === "circle" ? 2 * Math.hypot(a, b) : 2 * Math.abs(a);
            let h = tool === "circle" ? w : 2 * Math.abs(b);
            if (ev.shiftKey) w = h = Math.max(w, h);
            w = round(w, 0.5);
            h = round(h, 0.5);
            latest.current.onChange({ ...base, cuts: [...base.cuts, make(w, h)] });
          },
          (moved) => {
            if (!moved) latest.current.onChange({ ...base, cuts: [...base.cuts, make(20, 20)] });
            setDragging(null);
          },
        );
      },
    };
  });

  // moving a hole or a text by its dot
  const beginMove = (e: ThreeEvent<PointerEvent>, sel: MarkSel) => {
    e.stopPropagation();
    onSelect(sel);
    setDragging(sel);
    const { params: base } = latest.current;
    const c0 = sel.kind === "cut" ? base.cuts[sel.i] : base.texts[sel.i];
    // keep the spot that was grabbed under the pointer
    const grab = hitAt(e.nativeEvent);
    const off = grab ? { u: grab.u - c0.u, z: grab.z - c0.z * base.height } : { u: 0, z: 0 };
    off.u -= Math.round(off.u);
    track(
      e.nativeEvent,
      (_dx, _dy, ev) => {
        const hit = hitAt(ev);
        if (!hit) return;
        const u = hit.u - off.u;
        const z = Math.min(base.height, Math.max(0, hit.z - off.z));
        const moved = { u: u - Math.floor(u), z: z / base.height };
        if (sel.kind === "cut") {
          const cuts = base.cuts.slice();
          cuts[sel.i] = { ...base.cuts[sel.i], ...moved };
          latest.current.onChange({ ...base, cuts });
        } else {
          const texts = base.texts.slice();
          texts[sel.i] = { ...base.texts[sel.i], ...moved };
          latest.current.onChange({ ...base, texts });
        }
      },
      () => setDragging(null),
    );
  };

  const dot = Math.max(1.6, Math.max(params.height, params.radius * 2) * 0.012);

  const handlers = (sel: MarkSel) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHover(sel);
    },
    onPointerOut: () => setHover(null),
    onPointerDown: (e: ThreeEvent<PointerEvent>) => beginMove(e, sel),
  });

  return (
    <>
      {params.texts.map((m, i) => {
        const sel: MarkSel = { kind: "text", i };
        const problem = textProblems[i];
        const active = same(selected, sel) || same(hover, sel) || same(dragging, sel);
        const color = problem ? "#ef4444" : active ? "#f59e0b" : "#1f2937";
        const out = textOutline(m.text, m.font, Math.max(1, m.size));
        const zc = m.z * surface.height;
        const w = Math.max(out.width, 4);
        const h = Math.max(out.height, 4);
        return (
          <group key={`t${i}`}>
            {(active || problem) && <Line points={boxPoints(surface, m.u, zc, w + 2, h + 2)} color={color} lineWidth={1.5} dashed dashSize={1.5} gapSize={1.2} />}
            <mesh position={toWorld(surface.over(m.u, zc, m.raised ? m.depth + 1 : 1))} renderOrder={11} {...handlers(sel)}>
              <sphereGeometry args={[dot, 16, 16]} />
              <meshBasicMaterial color={active ? "#ffffff" : color} depthTest={false} transparent opacity={0.9} />
            </mesh>
            {(active || problem) && (
              <Html position={toWorld(surface.over(m.u, zc + h / 2 + 1 + dot * 2.5, 1))} center style={{ pointerEvents: "none" }}>
                <div className={`whitespace-nowrap rounded-md px-2 py-1 font-mono text-xs text-white shadow ${problem ? "bg-red-600/90" : "bg-neutral-900/90"}`}>
                  {tt.texts.label(out.width, out.height, m.raised, m.depth)}
                  {problem && <div className="font-sans text-[10px] opacity-90">{tt.texts.problems[problem]}</div>}
                </div>
              </Html>
            )}
          </group>
        );
      })}
      {params.cuts.map((c, i) => {
        const sel: MarkSel = { kind: "cut", i };
        const bad = problems[i] !== null;
        const active = same(selected, sel) || same(hover, sel) || same(dragging, sel);
        const color = bad ? "#ef4444" : active ? "#f59e0b" : "#1f2937";
        const zc = c.z * surface.height;
        const centre = toWorld(surface.over(c.u, zc, 0.6));
        return (
          <group key={i}>
            <Line points={outlinePoints(surface, c, c.u)} color={color} lineWidth={active ? 2.5 : 1.5} />
            {c.mode === "both" && <Line points={outlinePoints(surface, c, surface.opposite(c.u))} color={color} lineWidth={1.5} dashed dashSize={2} gapSize={1.5} />}
            <mesh position={centre} renderOrder={11} {...handlers(sel)}>
              <sphereGeometry args={[dot, 16, 16]} />
              <meshBasicMaterial color={active ? "#ffffff" : color} depthTest={false} transparent opacity={0.9} />
            </mesh>
            {(active || bad) && (
              <Html position={toWorld(surface.over(c.u, zc + (c.shape === "circle" ? c.w : c.h) / 2 + dot * 2.5, 1))} center style={{ pointerEvents: "none" }}>
                <div className={`whitespace-nowrap rounded-md px-2 py-1 font-mono text-xs text-white shadow ${bad ? "bg-red-600/90" : "bg-neutral-900/90"}`}>
                  {t.size(c.shape, c.w, c.h)} · {t.modeShort(c.mode, c.depth)}
                  {bad && <div className="font-sans text-[10px] opacity-90">{t.problems[problems[i]!]}</div>}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
