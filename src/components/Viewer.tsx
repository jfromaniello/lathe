"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildGeometry, type ShapeParams } from "@/lib/shape";

function Model({ params, onGeometry }: { params: ShapeParams; onGeometry?: (g: THREE.BufferGeometry) => void }) {
  const geometry = useMemo(() => buildGeometry(params), [params]);
  useEffect(() => {
    onGeometry?.(geometry);
    return () => geometry.dispose();
  }, [geometry, onGeometry]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#efe9df" roughness={0.55} metalness={0.02} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function Viewer({ params, onGeometry }: { params: ShapeParams; onGeometry?: (g: THREE.BufferGeometry) => void }) {
  const h = params.height;
  const r = params.radius;
  const dist = Math.max(h, r * 2) * 1.8;
  return (
    <Canvas shadows camera={{ position: [dist * 0.7, h * 0.9, dist * 0.7], fov: 40, near: 1, far: 5000 }} dpr={[1, 2]}>
      <color attach="background" args={["#1b1a19"]} />
      <hemisphereLight intensity={0.6} color="#ffffff" groundColor="#3a3632" />
      <directionalLight position={[200, 400, 250]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} />
      <directionalLight position={[-300, 150, -200]} intensity={0.7} />
      <Model params={params} onGeometry={onGeometry} />
      <Grid
        position={[0, -0.05, 0]}
        args={[600, 600]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#3a3835"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#5a5652"
        fadeDistance={900}
        infiniteGrid
      />
      <OrbitControls target={[0, h / 2, 0]} makeDefault enableDamping />
    </Canvas>
  );
}
