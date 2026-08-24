import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { decodeParams, decodeView } from "@/lib/url";
import { renderColor } from "@/lib/view";
import { rasterize } from "@/lib/raster";
import { encodePNG } from "@/lib/png";
import { matchPattern } from "@/lib/patterns";
import { sanitize } from "@/lib/shape";

export const maxDuration = 30;

const W = 1200;
const H = 630;
const MODEL_W = 620;

export async function GET(req: NextRequest) {
  const p = sanitize(decodeParams(req.nextUrl.search));
  const view = decodeView(req.nextUrl.search);

  const px = rasterize(p, { width: MODEL_W, height: H, color: renderColor(view) });
  const png = encodePNG(px, MODEL_W, H);
  const src = `data:image/png;base64,${png.toString("base64")}`;

  const pattern = matchPattern(p);
  const dims = `${Math.round(p.radius * 2)} × ${Math.round(p.height)} mm`;
  const facts = [
    pattern ? (pattern.id === "smooth" ? "Liso" : `${pattern.name} · ${p.ribCount} estrías`) : `${p.ribCount} estrías`,
    p.twist ? `Twist ${p.twist}°` : null,
    p.squareness > 0.15 ? "Sección cuadrada" : null,
    p.mode === "solid" ? "Vase mode" : `Pared ${p.wall} mm`,
    view.material === "wood" ? "PLA madera" : view.material === "glass" ? "Translúcido" : null,
  ].filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          background: "linear-gradient(135deg, #f3eee6 0%, #e4ddd2 100%)",
          fontFamily: "sans-serif",
          color: "#2b2723",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={MODEL_W} height={H} style={{ position: "absolute", left: 20, top: 0 }} alt="" />
        <div
          style={{
            position: "absolute",
            left: 660,
            top: 0,
            width: W - 660 - 56,
            height: H,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 26, letterSpacing: 8, textTransform: "uppercase", color: "#8a7f72" }}>Lathe</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, marginTop: 10 }}>{dims}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 28, color: "#5a534b", gap: 8 }}>
            {facts.map((f) => (
              <div key={f} style={{ display: "flex" }}>
                {f}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 44, fontSize: 22, color: "#8a7f72" }}>Diseño paramétrico · listo para imprimir en 3D</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        // the image is a pure function of the query string: cache forever at the CDN
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    },
  );
}
