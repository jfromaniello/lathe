"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useCursor } from "@react-three/drei";
import * as THREE from "three";
import type { ShapeParams } from "@/lib/shape";

const UP = new THREE.Vector3(0, 1, 0);
const SNAP = 0.04;
const MIN_M = 0.15;
const MAX_M = 1.6;

interface Drag {
  id: string;
  startX: number;
  startY: number;
  ux: number; // screen-space unit vector of the drag axis
  uy: number;
  pxPerMm: number;
  start: ShapeParams;
}

const COLORS = {
  profile: "#f59e0b",
  height: "#38bdf8",
  radius: "#4ade80",
  twist: "#c084fc",
};

/**
 * Direct-manipulation handles drawn on the model's silhouette (the side facing the camera):
 * profile points (drag radially), height (drag up/down), radius (drag radially) and a twist ring.
 */
export default function Handles({ params, onChange }: { params: ShapeParams; onChange: (p: ShapeParams) => void }) {
  const { camera, size, controls } = useThree();
  // OrbitControls must be paused while dragging a handle; mutate through a ref (event handlers only)
  const controlsRef = useRef<{ enabled: boolean } | null>(null);
  useEffect(() => {
    controlsRef.current = controls as unknown as { enabled: boolean } | null;
  }, [controls]);
  const group = useRef<THREE.Group>(null);
  const dir = useRef(new THREE.Vector3(1, 0, 0));
  const drag = useRef<Drag | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [label, setLabel] = useState<{ text: string; pos: THREE.Vector3 } | null>(null);
  useCursor(hover !== null || active !== null, active ? "grabbing" : "grab");

  const H = params.height;
  const R = params.radius;
  const hs = Math.max(2.5, Math.max(H, R * 2) * 0.022); // handle size in mm

  // keep the handle group on the silhouette facing the camera
  useFrame(() => {
    const v = new THREE.Vector3();
    camera.getWorldDirection(v);
    v.y = 0;
    if (v.lengthSq() < 1e-4) return;
    v.normalize();
    const d = new THREE.Vector3().crossVectors(v, UP).normalize();
    dir.current.copy(d);
    if (group.current) group.current.rotation.y = Math.atan2(-d.z, d.x);
  });

  const worldOf = (x: number, y: number) => new THREE.Vector3(dir.current.x * x, y, dir.current.z * x);
  const toScreen = (p: THREE.Vector3) => {
    const v = p.clone().project(camera);
    return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
  };

  const begin = (e: ThreeEvent<PointerEvent>, id: string, origin: THREE.Vector3, axis: THREE.Vector3 | null) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (controlsRef.current) controlsRef.current.enabled = false;
    let ux = 1;
    let uy = 0;
    let pxPerMm = 1;
    if (axis) {
      const a = toScreen(origin);
      const b = toScreen(origin.clone().add(axis));
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      ux = dx / len;
      uy = dy / len;
      pxPerMm = len;
    }
    drag.current = { id, startX: e.clientX, startY: e.clientY, ux, uy, pxPerMm, start: params };
    setActive(id);
  };

  const end = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    setActive(null);
    setLabel(null);
    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  const deltaMm = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current!;
    return ((e.clientX - d.startX) * d.ux + (e.clientY - d.startY) * d.uy) / d.pxPerMm;
  };

  const round = (n: number, step: number) => Math.round(n / step) * step;

  // ----- per-handle move logic -----
  const moveProfile = (e: ThreeEvent<PointerEvent>, i: number) => {
    const d = drag.current;
    if (!d || d.id !== `p${i}`) return;
    const start = d.start;
    let m = (start.radius * start.profile[i] + deltaMm(e)) / start.radius;
    m = Math.min(MAX_M, Math.max(MIN_M, m));
    let snapped = false;
    if (!e.altKey) {
      const candidates = [1, ...start.profile.filter((_, j) => j !== i)];
      let best = SNAP;
      for (const c of candidates) {
        const dd = Math.abs(m - c);
        if (dd < best) {
          best = dd;
          m = c;
          snapped = true;
        }
      }
    }
    if (!snapped) m = round(m, 0.01);
    const profile = start.profile.slice();
    profile[i] = m;
    onChange({ ...start, profile });
    setLabel({ text: `${(m * start.radius).toFixed(0)} mm${snapped ? " ⌖" : ""}`, pos: worldOf(m * start.radius + hs * 2, (H * i) / 6) });
  };

  const moveHeight = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || d.id !== "height") return;
    const h = round(Math.min(400, Math.max(20, d.start.height + deltaMm(e))), 1);
    onChange({ ...d.start, height: h });
    setLabel({ text: `${h} mm`, pos: new THREE.Vector3(0, h + hs * 4, 0) });
  };

  const moveRadius = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || d.id !== "radius") return;
    const r = round(Math.min(150, Math.max(10, d.start.radius + deltaMm(e))), 0.5);
    onChange({ ...d.start, radius: r });
    setLabel({ text: `Ø ${(r * 2).toFixed(0)} mm`, pos: worldOf(r * d.start.profile[0] + hs * 5, hs * 3) });
  };

  const moveTwist = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || d.id !== "twist") return;
    const t = round(Math.min(360, Math.max(-360, d.start.twist + (e.clientX - d.startX) * 0.5)), 1);
    onChange({ ...d.start, twist: t });
    setLabel({ text: `twist ${t}°`, pos: new THREE.Vector3(0, H + hs * 4, 0) });
  };

  const mat = (id: string, color: string) => (
    <meshBasicMaterial color={hover === id || active === id ? "#ffffff" : color} depthTest={false} transparent opacity={active && active !== id ? 0.25 : 0.9} />
  );
  const over = (id: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(id);
  };
  const out = () => setHover(null);

  return (
    <>
      <group ref={group}>
        {/* profile points */}
        {params.profile.map((m, i) => {
          const y = (H * i) / (params.profile.length - 1);
          const x = R * m;
          const id = `p${i}`;
          return (
            <mesh
              key={id}
              position={[x, y, 0]}
              renderOrder={10}
              onPointerOver={over(id)}
              onPointerOut={out}
              onPointerDown={(e) => begin(e, id, worldOf(x, y), dir.current.clone())}
              onPointerMove={(e) => moveProfile(e, i)}
              onPointerUp={end}
            >
              <sphereGeometry args={[hs * 0.8, 16, 16]} />
              {mat(id, COLORS.profile)}
            </mesh>
          );
        })}
        {/* radius (whole silhouette) */}
        <mesh
          position={[R * params.profile[0] + hs * 3.5, hs, 0]}
          renderOrder={10}
          onPointerOver={over("radius")}
          onPointerOut={out}
          onPointerDown={(e) => begin(e, "radius", worldOf(R * params.profile[0] + hs * 3.5, hs), dir.current.clone())}
          onPointerMove={moveRadius}
          onPointerUp={end}
        >
          <boxGeometry args={[hs * 1.6, hs * 1.6, hs * 1.6]} />
          {mat("radius", COLORS.radius)}
        </mesh>
      </group>

      {/* height */}
      <mesh
        position={[0, H + hs * 1.5, 0]}
        renderOrder={10}
        onPointerOver={over("height")}
        onPointerOut={out}
        onPointerDown={(e) => begin(e, "height", new THREE.Vector3(0, H, 0), UP.clone())}
        onPointerMove={moveHeight}
        onPointerUp={end}
      >
        <coneGeometry args={[hs * 0.9, hs * 2, 16]} />
        {mat("height", COLORS.height)}
      </mesh>

      {/* twist ring */}
      <mesh
        position={[0, H, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={9}
        onPointerOver={over("twist")}
        onPointerOut={out}
        onPointerDown={(e) => begin(e, "twist", new THREE.Vector3(0, H, 0), null)}
        onPointerMove={moveTwist}
        onPointerUp={end}
      >
        <torusGeometry args={[R * params.profile[params.profile.length - 1] * 1.12 + hs, hs * 0.35, 8, 96]} />
        {mat("twist", COLORS.twist)}
      </mesh>

      {label && (
        <Html position={label.pos} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md bg-neutral-900/90 px-2 py-1 font-mono text-xs text-white shadow">{label.text}</div>
        </Html>
      )}
    </>
  );
}
