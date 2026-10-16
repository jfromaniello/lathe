"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { placeCuts, wallSurface, type Cut, type CutShape, type ShapeParams } from "@/lib/shape";
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

const round = (n: number, step: number) => Math.round(n / step) * step;

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
  tool: CutShape | null;
  selected: number | null;
  onSelect: (i: number | null) => void;
  handleRef: React.RefObject<CutToolsHandle | null>;
}) {
  const t = useT().cuts;
  const { camera, controls, gl } = useThree();
  const surface = useMemo(() => wallSurface(params), [params]);
  const { problems } = useMemo(() => placeCuts(params), [params]);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
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
        latest.current.onSelect(index);
        setDragging(index);
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

  // moving a hole by its dot
  const beginMove = (e: ThreeEvent<PointerEvent>, i: number) => {
    e.stopPropagation();
    onSelect(i);
    setDragging(i);
    const { params: base } = latest.current;
    const c0 = base.cuts[i];
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
        const cuts = base.cuts.slice();
        cuts[i] = { ...c0, u: u - Math.floor(u), z: z / base.height };
        latest.current.onChange({ ...base, cuts });
      },
      () => setDragging(null),
    );
  };

  const dot = Math.max(1.6, Math.max(params.height, params.radius * 2) * 0.012);

  return (
    <>
      {params.cuts.map((c, i) => {
        const bad = problems[i] !== null;
        const active = selected === i || hover === i || dragging === i;
        const color = bad ? "#ef4444" : active ? "#f59e0b" : "#1f2937";
        const zc = c.z * surface.height;
        const centre = toWorld(surface.over(c.u, zc, 0.6));
        return (
          <group key={i}>
            <Line points={outlinePoints(surface, c, c.u)} color={color} lineWidth={active ? 2.5 : 1.5} />
            {c.mode === "both" && <Line points={outlinePoints(surface, c, surface.opposite(c.u))} color={color} lineWidth={1.5} dashed dashSize={2} gapSize={1.5} />}
            <mesh
              position={centre}
              renderOrder={11}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(i);
              }}
              onPointerOut={() => setHover(null)}
              onPointerDown={(e) => beginMove(e, i)}
            >
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
