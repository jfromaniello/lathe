# Lathe

Generador paramétrico de objetos para imprimir en 3D — floreros estriados, lámparas con twist, tachos de escritorio — que corre 100% en el browser y exporta STL.

Todo es una superficie de revolución `r(θ, z)` construida directo como malla con three.js (sin OpenSCAD ni CSG), así que cada cambio de slider se ve al instante. El estado vive en la URL: compartir un diseño es copiar el link.

```sh
pnpm install
pnpm dev
```

- `src/lib/shape.ts` — generador de mallas (perfil, sección superelíptica, estrías, twist, pared/fondo/tapa)
- `src/lib/export.ts` — export STL binario
- `src/lib/url.ts` — codificación de parámetros en la URL
- `scripts/check-manifold.ts` — verifica que todas las configuraciones generen mallas cerradas (`pnpm dlx tsx scripts/check-manifold.ts`)
