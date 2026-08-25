"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Lightformer, Html } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildGeometry, buildParts, type ShapeParams } from "@/lib/shape";
import Handles from "./Handles";

import { renderColor, type ViewSettings } from "@/lib/view";
import { useT } from "@/i18n/context";

function Material({ view }: { view: ViewSettings }) {
  if (view.material === "matte") return <meshStandardMaterial color={view.color} roughness={0.78} metalness={0} side={THREE.DoubleSide} />;
  if (view.material === "wood") return <meshStandardMaterial color={renderColor(view)} roughness={0.65} metalness={0} side={THREE.DoubleSide} />;
  return <meshPhysicalMaterial color={view.color} roughness={0.35} transmission={0.82} thickness={4} ior={1.4} side={THREE.DoubleSide} />;
}

function Model({ params, view, onGeometry }: { params: ShapeParams; view: ViewSettings; onGeometry?: (g: THREE.BufferGeometry[]) => void }) {
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
    <group rotation={[-Math.PI / 2, 0, 0]}>
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
}: {
  params: ShapeParams;
  view: ViewSettings;
  onChange: (p: ShapeParams) => void;
  onGeometry?: (g: THREE.BufferGeometry[]) => void;
}) {
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
      <Model params={params} view={view} onGeometry={onGeometry} />
      {lit && <pointLight position={[0, h * 0.5, 0]} color="#ffd39b" intensity={h * h * 0.9} decay={2} distance={h * 6} />}

      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={Math.max(h, r * 2) * 3} blur={2.4} far={h} resolution={1024} color="#3a3128" />
      <gridHelper args={[1000, 50, "#cfc8bd", "#d9d3ca"]} position={[0, -0.02, 0]} />

      {view.showMug && <Mug x={-(r * 1.35 + 65)} />}
      {view.showHandles && <Handles params={params} onChange={onChange} />}

      <OrbitControls target={[0, h / 2, 0]} makeDefault enableDamping maxPolarAngle={Math.PI / 2 + 0.05} />
    </Canvas>
  );
}
