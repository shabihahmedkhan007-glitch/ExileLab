// RadarChart — the identity picture (UX §2.2, §4.1, §5 #4). Two polygons over
// the eight Preference Axes: what the build DELIVERS vs what the sliders say the
// player WANTS. The gap between them is the product's value proposition drawn as
// a shape. Pure SVG, no dependencies. Values tween on preset/weight change, so
// the polygons visibly morph — the hero moment of the demo (Law 1).

"use client";

import { useEffect, useRef, useState } from "react";
import { AXIS_LIST } from "@/lib/axes";
import type { PreferenceAxis } from "@/lib/types";

const DELIVERS = "var(--color-cold)";
const WANTS = "var(--color-accent)";

/** RAF tween toward a target vector so polygon changes animate smoothly. */
function useTween(target: number[], ms = 450): number[] {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / ms);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = target.map(
        (to, i) => (from[i] ?? 0) + (to - (from[i] ?? 0)) * eased,
      );
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.join(",")]);

  return value;
}

export function RadarChart({
  delivers,
  wants,
  size = 320,
}: {
  delivers: Record<PreferenceAxis, number>;
  wants: Record<PreferenceAxis, number>;
  size?: number;
}) {
  const axes = AXIS_LIST;
  const n = axes.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;

  const deliverTarget = axes.map((a) => clamp01(delivers[a.axis]));
  const wantTarget = axes.map((a) => clamp01(wants[a.axis]));
  const dv = useTween(deliverTarget);
  const wv = useTween(wantTarget);

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, r: number): [number, number] => [
    cx + Math.cos(angle(i)) * R * r,
    cy + Math.sin(angle(i)) * R * r,
  ];
  const poly = (vals: number[]) =>
    vals.map((v, i) => point(i, v).join(",")).join(" ");

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Build delivers versus wants across eight preference axes"
      >
        {/* Grid rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={poly(new Array(n).fill(r))}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={1}
          />
        ))}
        {/* Spokes + axis labels */}
        {axes.map((a, i) => {
          const [x, y] = point(i, 1);
          const [lx, ly] = point(i, 1.2);
          return (
            <g key={a.axis}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={lx}
                y={ly}
                fontSize={10}
                fontWeight={600}
                fill="var(--color-faint)"
                textAnchor={anchor(lx, cx)}
                dominantBaseline="middle"
              >
                {a.short}
              </text>
            </g>
          );
        })}

        {/* Delivers polygon */}
        <polygon
          points={poly(dv)}
          fill={DELIVERS}
          fillOpacity={0.14}
          stroke={DELIVERS}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Wants polygon */}
        <polygon
          points={poly(wv)}
          fill={WANTS}
          fillOpacity={0.12}
          stroke={WANTS}
          strokeWidth={2}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
        {/* Delivers vertices */}
        {dv.map((v, i) => {
          const [x, y] = point(i, v);
          return (
            <circle key={i} cx={x} cy={y} r={2.5} fill={DELIVERS} />
          );
        })}
      </svg>

      <div className="mt-2 flex items-center gap-5 text-xs">
        <Legend color={DELIVERS} label="Delivers" dashed={false} />
        <Legend color={WANTS} label="Wants" dashed />
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <svg width="18" height="8" aria-hidden>
        <line
          x1="0"
          y1="4"
          x2="18"
          y2="4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

function clamp01(v: number | undefined): number {
  if (v === undefined || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
function anchor(x: number, cx: number): "start" | "middle" | "end" {
  if (Math.abs(x - cx) < 8) return "middle";
  return x > cx ? "start" : "end";
}
