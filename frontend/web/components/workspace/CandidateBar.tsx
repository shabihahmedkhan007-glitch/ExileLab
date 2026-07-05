// CandidateBar — the tune-style ScoreBar generalized for Compare and Upgrades
// (UX §5 #2, the Raidbots Top-Gear pattern). The prominent number is the ranking
// key — a Weighted Score delta on Compare ("steal one thing"), Δscore-per-Divine
// on Upgrades. Bar length is proportional to that key. Expand reveals the
// per-axis decomposition (server-computed AxisContribution.weightedDelta, on the
// 0-100 score scale, summing exactly to the headline) so every number is
// auditable (Law 3). An optional cost chip carries the (synthetic) Divine price;
// an optional action wires the "try this" / apply → promote flow.

"use client";

import { useState } from "react";
import { AXIS_META } from "@/lib/axes";
import type { AxisContribution, PreferenceAxis } from "@/lib/types";
import { costLabel, signed } from "@/lib/format";

export function CandidateBar({
  headline,
  headlineLabel,
  description,
  fraction,
  cost,
  perAxis,
  action,
  source,
}: {
  /** The ranking-key number rendered large (Δscore or Δscore/div). */
  headline: number;
  /** Tiny caption under the number, e.g. "score" or "score/div". */
  headlineLabel: string;
  description: string;
  /** Bar width as a fraction [0,1] of the list's max (parent computes it). */
  fraction: number;
  /** Divine cost → cost chip. Omit for no chip (e.g. Compare candidates). */
  cost?: number;
  perAxis: AxisContribution[];
  /** The "try this" / apply affordance — promotes to a new snapshot. */
  action?: { label: string; busy?: boolean; onClick: () => void };
  /** Attribution of the source build (Compare) — a small trailing note. */
  source?: string;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(2, Math.min(100, fraction * 100));

  // Per-axis contributions, largest magnitude first (already 0-100 scale).
  const contributions = perAxis
    .filter((c) => Math.abs(c.weightedDelta) >= 0.05)
    .sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta));

  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface transition-colors hover:border-line-strong">
      <button
        className="flex w-full items-stretch gap-3 p-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {/* The ranking number — typographically primary. */}
        <div className="flex w-16 shrink-0 flex-col items-end justify-center">
          <span className="tabular text-xl font-bold leading-none text-gain">
            {signed(headline)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-faint">
            {headlineLabel}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {description}
            </span>
            {cost !== undefined ? (
              <span
                className={`ml-auto shrink-0 rounded-md border px-2 py-0.5 text-[11px] tabular ${
                  cost > 0
                    ? "border-line-strong bg-surface-2 text-muted"
                    : "border-line bg-transparent text-faint"
                }`}
              >
                {costLabel(cost)}
              </span>
            ) : null}
          </div>
          {/* The bar. */}
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>

      {open ? (
        <div className="border-t border-line px-3 pb-3 pt-3">
          {contributions.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {contributions.map((c) => {
                const meta = AXIS_META[c.axis as PreferenceAxis];
                return (
                  <span
                    key={c.axis}
                    className="inline-flex items-center gap-1.5 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: meta?.color ?? "var(--color-muted)" }}
                    />
                    <span className="text-muted">{meta?.short ?? c.axis}</span>
                    <span
                      className={`tabular font-semibold ${
                        c.weightedDelta >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {signed(c.weightedDelta)}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mb-3 text-xs text-faint">
              No axis you weight moves measurably — a lateral change under these
              sliders.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {action ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                disabled={action.busy}
                className="rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
              >
                {action.busy ? "Applying…" : action.label}
              </button>
            ) : null}
            <span
              className="rounded-[var(--radius-sm)] border border-line px-3 py-1.5 text-xs text-faint"
              title="Deep-links to the official trade site are user-initiated (compliance charter §7.5)."
            >
              Export to PoB
            </span>
            {source ? (
              <span className="ml-auto truncate text-xs text-faint">
                {source}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
