// ScoreBar — a ranked recommendation as a horizontal gain bar (UX §4.2, §5 #2,
// the Raidbots Top-Gear pattern). Bar length = Weighted Score delta (the ranking
// key). Hover/expand reveals the per-axis decomposition ("+11 move, −2 damage")
// so every number is auditable (Law 3). A cost chip carries the Divine price.
// Length + ordering come from client-side re-scoring, so a slider drag re-ranks
// this list in well under a second (Law 1).

"use client";

import { useState } from "react";
import { AXIS_META } from "@/lib/axes";
import type { PreferenceAxis } from "@/lib/types";
import { costLabel, signed } from "@/lib/format";
import type { ScoredRecommendation } from "@/lib/scoring";

export function ScoreBar({
  rec,
  scale,
  onApply,
  applying,
}: {
  rec: ScoredRecommendation;
  /** Largest liveDelta in the list, for proportional bar width. */
  scale: number;
  onApply: (mutationId: string) => void;
  applying: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pct = scale > 0 ? Math.max(2, (rec.liveDelta / scale) * 100) : 2;

  // Per-axis contributions under the live weights, largest magnitude first.
  const contributions = Object.entries(rec.liveByAxis)
    .filter(([, v]) => Math.abs(v) >= 0.05)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface transition-colors hover:border-line-strong">
      <button
        className="flex w-full items-stretch gap-3 p-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {/* The gain number — typographically primary. */}
        <div className="flex w-16 shrink-0 flex-col items-end justify-center">
          <span className="tabular text-xl font-bold text-gain leading-none">
            {signed(rec.liveDelta)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-faint">
            score
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {rec.description}
            </span>
            <span
              className={`ml-auto shrink-0 rounded-md border px-2 py-0.5 text-[11px] tabular ${
                rec.cost > 0
                  ? "border-line-strong bg-surface-2 text-muted"
                  : "border-line bg-transparent text-faint"
              }`}
            >
              {costLabel(rec.cost)}
            </span>
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
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {contributions.map(([axis, v]) => {
              const meta = AXIS_META[axis as PreferenceAxis];
              return (
                <span
                  key={axis}
                  className="inline-flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: meta?.color ?? "var(--color-muted)" }}
                  />
                  <span className="text-muted">{meta?.short ?? axis}</span>
                  <span
                    className={`tabular font-semibold ${
                      v >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {signed(v)}
                  </span>
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApply(rec.mutationId);
              }}
              disabled={applying}
              className="rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
            >
              {applying ? "Applying…" : "Apply"}
            </button>
            <span
              className="rounded-[var(--radius-sm)] border border-line px-3 py-1.5 text-xs text-faint"
              title="Deep-links to the official trade site are user-initiated (compliance charter §7.5)."
            >
              Export to PoB
            </span>
            <span className="ml-auto tabular text-xs text-faint">
              {rec.liveBaseScore.toFixed(1)} →{" "}
              <span className="text-ink">
                {rec.liveCandidateScore.toFixed(1)}
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
