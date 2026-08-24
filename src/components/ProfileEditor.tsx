"use client";

import { useRef, useState } from "react";
import { profileAt } from "@/lib/shape";

const W = 220;
const H = 240;
const PAD = 16;
const MIN = 0.15;
const MAX = 1.6;

export default function ProfileEditor({ profile, onChange }: { profile: number[]; onChange: (p: number[]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const n = profile.length;
  const cx = W / 2;
  const scaleX = (W / 2 - PAD) / MAX;
  const yOf = (i: number) => H - PAD - ((H - 2 * PAD) * i) / (n - 1);
  const xOf = (m: number) => cx + m * scaleX;

  const curve: string[] = [];
  const steps = 60;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const m = profileAt(profile, t);
    curve.push(`${xOf(m).toFixed(1)},${(H - PAD - (H - 2 * PAD) * t).toFixed(1)}`);
  }
  const right = curve.join(" ");
  const left = curve
    .slice()
    .reverse()
    .map((pt) => {
      const [x, y] = pt.split(",").map(Number);
      return `${(2 * cx - x).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const move = (clientX: number) => {
    if (drag === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    let m = (Math.abs(x - cx)) / scaleX;
    m = Math.round(Math.min(MAX, Math.max(MIN, m)) * 100) / 100;
    const next = profile.slice();
    next[drag] = m;
    onChange(next);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full select-none rounded-md bg-neutral-900 touch-none"
      onPointerMove={(e) => move(e.clientX)}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="#444" strokeDasharray="3 3" />
      <line x1={xOf(1)} y1={PAD} x2={xOf(1)} y2={H - PAD} stroke="#3a3a3a" strokeDasharray="2 4" />
      <line x1={2 * cx - xOf(1)} y1={PAD} x2={2 * cx - xOf(1)} y2={H - PAD} stroke="#3a3a3a" strokeDasharray="2 4" />
      <polygon points={`${right} ${left}`} fill="#efe9df22" stroke="#efe9df" strokeWidth={1.5} strokeLinejoin="round" />
      {profile.map((m, i) => (
        <g key={i}>
          <line x1={2 * cx - xOf(m)} y1={yOf(i)} x2={xOf(m)} y2={yOf(i)} stroke="#f59e0b55" />
          <circle
            cx={xOf(m)}
            cy={yOf(i)}
            r={drag === i ? 7 : 5}
            fill="#f59e0b"
            stroke="#111"
            className="cursor-ew-resize"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag(i);
            }}
          />
        </g>
      ))}
    </svg>
  );
}
