// PreferencePanel — the sliders ARE the product (Law 1, UX §4.2, §5 #3).
// Preset chips first (casuals never touch a slider), eight sliders second
// (power users drag), and a collapsible Pro block of satisficing floor
// constraints (the Genshin-Optimizer pattern). It emits raw 0–100 weights on
// every input; the parent re-scores the recommendation list client-side, so the
// ranking moves the instant a thumb moves.

"use client";

import { useState } from "react";
import { AXIS_LIST } from "@/lib/axes";
import type {
  AxisWeights,
  GoalPreset,
  PreferenceAxis,
  ScoreConstraints,
} from "@/lib/types";
import { compact } from "@/lib/format";
import { SectionLabel } from "./ui";

/** Convert a preset's fractional weights to 0–100 slider positions (ratio-preserving). */
export function presetToSliders(preset: GoalPreset): AxisWeights {
  const values = Object.values(preset.weights);
  const max = Math.max(...values, 0.0001);
  const out = {} as AxisWeights;
  for (const a of AXIS_LIST) {
    out[a.axis] = Math.round((preset.weights[a.axis] / max) * 100);
  }
  return out;
}

export function PreferencePanel({
  presets,
  activePresetId,
  weights,
  constraints,
  onSelectPreset,
  onWeightsChange,
}: {
  presets: GoalPreset[];
  activePresetId: string | null;
  weights: AxisWeights;
  constraints?: ScoreConstraints;
  onSelectPreset: (preset: GoalPreset) => void;
  onWeightsChange: (weights: AxisWeights) => void;
}) {
  const [proOpen, setProOpen] = useState(false);
  const floors = constraints?.floors ?? [];

  const setAxis = (axis: PreferenceAxis, value: number) => {
    onWeightsChange({ ...weights, [axis]: value });
  };

  return (
    <div className="card p-5">
      <SectionLabel>What do you want?</SectionLabel>

      {/* Preset chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.id === activePresetId;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPreset(p)}
              title={p.description}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-accent bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] text-accent-strong"
                  : "border-line-strong bg-surface-2 text-muted hover:border-accent-dim hover:text-ink"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Sliders */}
      <div className="mt-5 flex flex-col gap-3.5">
        {AXIS_LIST.map((meta) => {
          const v = weights[meta.axis] ?? 0;
          return (
            <div key={meta.axis}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-ink">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: meta.color }}
                  />
                  {meta.axis}
                </span>
                <span className="tabular text-xs font-semibold text-muted">
                  {v}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={v}
                onChange={(e) => setAxis(meta.axis, Number(e.target.value))}
                aria-label={meta.axis}
              />
            </div>
          );
        })}
      </div>

      {/* Pro: constraints */}
      <div className="mt-5 border-t border-line pt-4">
        <button
          onClick={() => setProOpen((o) => !o)}
          className="flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-faint hover:text-muted"
          aria-expanded={proOpen}
        >
          <span
            className="transition-transform duration-150"
            style={{ transform: proOpen ? "rotate(90deg)" : "none" }}
          >
            ▸
          </span>
          Pro · floor constraints
        </button>
        {proOpen ? (
          <div className="mt-3 flex flex-col gap-2">
            {floors.length === 0 ? (
              <p className="text-xs text-faint">
                No hard floors on this preset. Add one to switch from “maximize”
                to “satisfice, then maximize”.
              </p>
            ) : (
              floors.map((f) => (
                <div
                  key={f.metric}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-line bg-surface-2 px-3 py-2 text-xs"
                >
                  <span className="tabular text-muted">
                    {f.metric} ≥{" "}
                    <span className="text-ink">{compact(f.min)}</span>
                  </span>
                  <span
                    className="text-faint"
                    title="Constraint editing lands with the optimizer (Phase 2)."
                  >
                    ✎
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
