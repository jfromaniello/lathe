# Lathe

**[lathe3d.com](https://lathe3d.com)** · [github.com/jfromaniello/lathe](https://github.com/jfromaniello/lathe) — design fluted vases, twisted lamp shades and ribbed desk bins in the browser and export a print-ready STL.

Every object Lathe makes is a surface of revolution:

```
r(θ, z) = radius · profile(z) · section(θ) + ribs(θ, z)
```

- **profile(z)** — the silhouette, seven draggable control points (Catmull-Rom).
- **section(θ)** — a superellipse: circle → rounded square, sampled by arc length so ribs stay even on flat faces.
- **ribs** — count, depth, waveform (scallop, sine, triangle, square), vertical range, twist.
- **shell** — wall thickness, closed/open bottom, closed/open top, hole for a lamp socket; or a solid for *vase mode* printing.

The mesh is built directly as a three.js `BufferGeometry` — no OpenSCAD, no CSG — so every slider change is instant, and it is constructed as closed loops of outer wall / inner wall / caps so it is always watertight. Designs live entirely in the URL; sharing one is copying the link, and the link preview is rendered server-side from the same parameters.

## Features

- Direct manipulation in 3D: drag profile points (with snapping), height, radius and a twist ring on the model itself.
- Pattern swatches with a single intensity slider; raw parameters under *Advanced*.
- Gallery of starting points and a random generator constrained to printable ranges.
- Undo/redo (⌘Z / ⇧⌘Z) with a visual history strip.
- PLA / wood / translucent materials (the translucent one lights up like a lamp), colour palette, a 90 mm mug for scale.
- Binary STL export at high resolution, watertight, Z-up.
- Open Graph images (`/api/og?…`) rendered with a dependency-free software rasterizer, cached at the CDN per design.

## Development

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # lint + typecheck + tests
pnpm test:watch
```

### Layout

| Path | What |
|---|---|
| `src/lib/shape.ts` | Parameters, presets and the mesh generator |
| `src/lib/patterns.ts` | Rib patterns, gallery, random designs |
| `src/lib/url.ts` | Design ⇄ query-string encoding |
| `src/lib/export.ts` | STL export |
| `src/lib/raster.ts`, `src/lib/png.ts` | Software renderer + PNG encoder used by `/api/og` |
| `src/lib/thumbnail.ts` | Shared offscreen WebGL renderer for gallery/history thumbnails |
| `src/hooks/useHistory.ts` | Undo/redo with grouped changes |
| `src/components/` | Viewer (react-three-fiber), 3D handles, editor panels |
| `src/test/mesh.ts` | Watertightness analysis used by the tests |
| `scripts/render.ts` | Software-render presets or a params JSON to PPM (`PARAMS=file.json pnpm dlx tsx scripts/render.ts outdir`) |
| `scripts/export-stl.ts` | Export the presets to STL from the command line |

### Tests

`pnpm test` runs Vitest over the pure parts: every preset, gallery item and forty random designs must produce a closed mesh with consistently outward normals (edges welded by position, as a slicer sees them); URL encoding round-trips and rejects garbage; pattern apply/match round-trips; the PNG encoder decodes back to its input; the rasterizer is deterministic and paints where expected; the history hook groups, undoes, redoes and jumps.

## Printing notes

- *Shell* designs print as normal parts. *Solid* designs are meant for the slicer's **vase mode / spiralize**: one continuous wall, no seams.
- The inner surface carries the same ribs as the outer one (radial offset), so a 1.2 mm wall stays 1.2 mm in the grooves.
- Very deep ribs combined with a strong twist and a thin wall can self-intersect; the app does not validate that yet — check the preview.

## Deployment

Pushes to `main` deploy to Vercel. `NEXT_PUBLIC_SITE_URL` sets the canonical origin used in Open Graph tags; `www.lathe3d.com` redirects to the apex in `next.config.ts`.

## License

[MIT](LICENSE) © José F. Romaniello
