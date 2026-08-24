"use client";

import { useMemo } from "react";
import type { ShapeParams } from "@/lib/shape";
import { renderThumbnail, thumbnailKey, type ThumbOptions } from "@/lib/thumbnail";

export default function Thumb({ params, options, className }: { params: ShapeParams; options?: ThumbOptions; className?: string }) {
  const key = thumbnailKey(params, options);
  // renderThumbnail is memoised by key internally; useMemo just avoids re-lookups per render
  const src = useMemo(() => renderThumbnail(params, options), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!src) return <div className={`bg-neutral-800 ${className ?? ""}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} className={`pointer-events-none select-none ${className ?? ""}`} />;
}
