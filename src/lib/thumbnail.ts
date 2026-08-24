import * as THREE from "three";
import { buildGeometry, type ShapeParams } from "./shape";

/**
 * Offscreen renderer for small preview thumbnails (gallery, pattern swatches, history).
 * One shared WebGL context, results cached as data URLs.
 */

const W = 160;
const H = 200;

interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  mesh: THREE.Mesh;
}

let ctx: Ctx | null = null;
const cache = new Map<string, string>();

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(2);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8078, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1, 2, 1.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-2, 1, -1);
    scene.add(fill);
    const camera = new THREE.PerspectiveCamera(28, W / H, 1, 5000);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xefe9df, roughness: 0.7 }));
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    ctx = { renderer, scene, camera, mesh };
    return ctx;
  } catch {
    return null;
  }
}

export interface ThumbOptions {
  /** hex color of the material */
  color?: string;
  /** azimuth in degrees */
  azimuth?: number;
}

export function thumbnailKey(p: ShapeParams, o: ThumbOptions = {}) {
  const { radialSegments: _r, heightSegments: _h, ...rest } = p;
  void _r;
  void _h;
  return JSON.stringify([rest, o.color ?? "", o.azimuth ?? 30]);
}

export function renderThumbnail(p: ShapeParams, o: ThumbOptions = {}): string | null {
  const key = thumbnailKey(p, o);
  const hit = cache.get(key);
  if (hit) return hit;
  const c = getCtx();
  if (!c) return null;

  const geo = buildGeometry({ ...p, radialSegments: 192, heightSegments: 48 });
  c.mesh.geometry.dispose();
  c.mesh.geometry = geo;
  (c.mesh.material as THREE.MeshStandardMaterial).color.set(o.color ?? "#efe9df");

  const bb = geo.boundingBox!;
  const w = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
  const h = bb.max.z - bb.min.z;
  const target = new THREE.Vector3(0, h / 2, 0);
  const fit = Math.max(h * 1.05, w * 1.35);
  const dist = fit / 2 / Math.tan((c.camera.fov * Math.PI) / 360) + w / 2;
  const az = ((o.azimuth ?? 30) * Math.PI) / 180;
  const el = 0.42;
  c.camera.position.set(dist * Math.cos(el) * Math.sin(az), h / 2 + dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
  c.camera.lookAt(target);
  c.camera.updateProjectionMatrix();
  c.renderer.render(c.scene, c.camera);
  const url = c.renderer.domElement.toDataURL("image/png");

  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(key, url);
  return url;
}
