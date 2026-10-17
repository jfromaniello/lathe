"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Lightformer, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildGeometry, buildParts, type ShapeParams } from "@/lib/shape";
import Handles from "./Handles";
import CutTools, { type CutToolsHandle, type MarkSel, type MarkTool } from "./CutTools";

import { renderColor, type CamView, type ViewSettings } from "@/lib/view";
import { useT } from "@/i18n/context";

function Material({ view }: { view: ViewSettings }) {
  if (view.material === "matte") return <meshStandardMaterial color={view.color} roughness={0.78} metalness={0} side={THREE.DoubleSide} />;
  if (view.material === "wood") return <meshStandardMaterial color={renderColor(view)} roughness={0.65} metalness={0} side={THREE.DoubleSide} />;
  return <meshPhysicalMaterial color={view.color} roughness={0.35} transmission={0.82} thickness={4} ior={1.4} side={THREE.DoubleSide} />;
}

function Model({
  params,
  view,
  onGeometry,
  onPointerDown,
}: {
  params: ShapeParams;
  view: ViewSettings;
  onGeometry?: (g: THREE.BufferGeometry[]) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  // a split design is rendered as its two pieces so they can be shown apart
  const geometries = useMemo(() => {
    const parts = buildParts(params);
    return parts ? [parts.body, parts.top] : [buildGeometry(params)];
  }, [params]);
  useEffect(() => {
    onGeometry?.(geometries);
    return () => geometries.forEach((g) => g.dispose());
  }, [geometries, onGeometry]);
  const lift = view.exploded && geometries.length > 1 ? params.splitLip + 12 : 0;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onPointerDown}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0, i === 1 ? lift : 0]} castShadow receiveShadow>
          <Material view={view} />
        </mesh>
      ))}
    </group>
  );
}

/** Pull the camera back on narrow (portrait/mobile) viewports so the whole object stays framed. */
function FitCamera({ dist, h }: { dist: number; h: number }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    const k = Math.max(1, 1.4 / Math.max(aspect, 0.3));
    camera.position.set(dist * 0.75 * k, h * 0.75, dist * 0.75 * k);
    camera.lookAt(0, h / 2, 0);
    camera.updateProjectionMatrix();
    // only re-frame when the viewport shape changes (not on every param tweak) so orbiting is not reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);
  return null;
}

/** Polar (from +y) and azimuth (from +z towards +x) angles of each preset view; the iso one is FitCamera's. */
const VIEW_ANGLES: Record<Exclude<CamView, "iso">, [number, number]> = {
  front: [Math.PI / 2, 0],
  back: [Math.PI / 2, Math.PI],
  right: [Math.PI / 2, Math.PI / 2],
  left: [Math.PI / 2, -Math.PI / 2],
  top: [1e-4, 0], // not exactly at the pole: the orbit controls lose their heading there
  bottom: [Math.PI - 1e-4, 0],
};

interface Controls {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: "start", fn: () => void) => void;
  removeEventListener: (type: "start", fn: () => void) => void;
}

/** Swings the camera around the object to a preset view, and reports when it goes below the floor. */
function CameraRig({ request, dist, h, onBelow }: { request: { view: CamView; n: number } | null; dist: number; h: number; onBelow: (below: boolean) => void }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const anim = useRef<{ from: THREE.Spherical; to: THREE.Spherical; t0: number } | null>(null);
  const below = useRef(false);

  useEffect(() => {
    if (!request) return;
    const target = new THREE.Vector3(0, h / 2, 0);
    const k = Math.max(1, 1.4 / Math.max(aspect, 0.3));
    const iso = new THREE.Vector3(dist * 0.75 * k, h * 0.25, dist * 0.75 * k);
    const to = new THREE.Spherical().setFromVector3(iso);
    if (request.view !== "iso") [to.phi, to.theta] = VIEW_ANGLES[request.view];
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    // turn the short way round
    while (to.theta - from.theta > Math.PI) to.theta -= 2 * Math.PI;
    while (to.theta - from.theta < -Math.PI) to.theta += 2 * Math.PI;
    anim.current = { from, to, t0: performance.now() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  // grabbing the view cancels the swing
  useEffect(() => {
    if (!controls) return;
    const stop = () => (anim.current = null);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame(() => {
    const a = anim.current;
    if (a) {
      const t = Math.min(1, (performance.now() - a.t0) / 500);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const sph = new THREE.Spherical(a.from.radius + (a.to.radius - a.from.radius) * e, a.from.phi + (a.to.phi - a.from.phi) * e, a.from.theta + (a.to.theta - a.from.theta) * e);
      camera.position.setFromSpherical(sph).add(new THREE.Vector3(0, h / 2, 0));
      controls?.target.set(0, h / 2, 0);
      camera.lookAt(0, h / 2, 0);
      controls?.update();
      if (t >= 1) anim.current = null;
    }
    const isBelow = camera.position.y < 0;
    if (isBelow !== below.current) {
      below.current = isBelow;
      onBelow(isBelow);
    }
  });
  return null;
}

/** A standard 90 mm coffee mug, for scale. */
function Mug({ x }: { x: number }) {
  const t = useT();
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 45, 0]}>
        <cylinderGeometry args={[40, 37, 90, 48, 1, true]} />
        <meshStandardMaterial color="#8d867d" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[37, 48]} />
        <meshStandardMaterial color="#8d867d" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[44, 48, 0]}>
        <torusGeometry args={[22, 5, 12, 40]} />
        <meshStandardMaterial color="#8d867d" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <Html position={[0, -6, 0]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap text-[10px] text-neutral-500">{t.viewer.mug}</div>
      </Html>
    </group>
  );
}

export default function Viewer({
  params,
  view,
  onChange,
  onGeometry,
  camRequest = null,
  cutTool = null,
  selectedCut = null,
  onSelectCut = () => {},
}: {
  params: ShapeParams;
  view: ViewSettings;
  onChange: (p: ShapeParams) => void;
  onGeometry?: (g: THREE.BufferGeometry[]) => void;
  /** Preset view to swing to; bump `n` to ask for the same view again. */
  camRequest?: { view: CamView; n: number } | null;
  /** Hole punch picked: pressing the model starts drawing a hole. */
  cutTool?: MarkTool | null;
  selectedCut?: MarkSel | null;
  onSelectCut?: (s: MarkSel | null) => void;
}) {
  const cutHandle = useRef<CutToolsHandle | null>(null);
  // looking from under the floor: hide the floor so the base shows
  const [below, setBelow] = useState(false);
  const h = params.height;
  const r = params.radius;
  const dist = Math.max(h, r * 2) * 1.9;
  const lit = view.material === "glass";

  return (
    <Canvas
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ position: [dist * 0.75, h * 0.75, dist * 0.75], fov: 35, near: 1, far: 6000 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#e6e1d9"]} />
      <fog attach="fog" args={["#e6e1d9", dist * 3, dist * 8]} />

      {/* soft studio lighting, no network assets */}
      <Environment resolution={256}>
        <Lightformer intensity={3} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
        <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[10, 2, 1]} />
        <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[10, 2, 1]} />
        <Lightformer intensity={1} color="#ffe6c8" position={[0, -1, 5]} scale={[10, 4, 1]} />
      </Environment>
      <hemisphereLight intensity={0.35} color="#ffffff" groundColor="#b8ae9f" />
      <directionalLight position={[250, 500, 300]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003}>
        <orthographicCamera attach="shadow-camera" args={[-400, 400, 400, -400, 1, 2000]} />
      </directionalLight>

      <FitCamera dist={dist} h={h} />
      <CameraRig request={camRequest} dist={dist} h={h} onBelow={setBelow} />
      <Model params={params} view={view} onGeometry={onGeometry} onPointerDown={cutTool ? (e) => cutHandle.current?.onModelDown(e) : undefined} />
      <CutTools params={params} onChange={onChange} tool={cutTool} selected={selectedCut} onSelect={onSelectCut} handleRef={cutHandle} />
      {lit && <pointLight position={[0, h * 0.5, 0]} color="#ffd39b" intensity={h * h * 0.9} decay={2} distance={h * 6} />}

      {!below && (
        <>
          <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={Math.max(h, r * 2) * 3} blur={2.4} far={h} resolution={1024} color="#3a3128" />
          <gridHelper args={[1000, 50, "#cfc8bd", "#d9d3ca"]} position={[0, -0.02, 0]} />
        </>
      )}

      {view.showMug && <Mug x={-(r * 1.35 + 65)} />}
      {view.showHandles && <Handles params={params} onChange={onChange} />}

      <OrbitControls target={[0, h / 2, 0]} makeDefault enableDamping maxPolarAngle={Math.PI} />
    </Canvas>
  );
}
