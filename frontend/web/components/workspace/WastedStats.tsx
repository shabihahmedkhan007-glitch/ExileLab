// WastedStats — the recoverable-inefficiency section on Overview (OPT-1, UX
// §4.1). GET /wasted returns overcapped resistances, dead config toggles and
// unused supports, each with an axis-weighted severity: an overcapped resist
// matters MORE under a Survivability-heavy preset, so the severity chip reflects
// the ACTIVE weighting, not a flat rulebook value. Coach voice — every finding
// leads with what's recoverable, never "you wasted" (Law 2). Renders nothing on
// error or when the build is clean (kill-switch-style silent degradation).

"use client";

import { useEffect, useState } from "react";
import type { Severity, WastedFinding } from "@/lib/types";
import { api } from "@/lib/api";
import { integer } from "@/lib/format";
import { SeverityChip } from "@/components/chips";
import { SectionLabel } from "@/components/ui";

const TOP_N = 4;

/** Map an axis-weighted severity [0,1] to a Doctor severity band for the chip. */
function severityBand(s: number): Severity {
  if (s >= 0.5) return "critical";
  if (s >= 0.3) return "major";
  if (s >= 0.12) return "minor";
  return "pass";
}

function renderEvidenceValue(v: number | string | boolean): string {
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Math.abs(v) >= 1000 ? integer(v) : String(v);
  return v;
}

export function WastedStats({
  buildId,
  presetId,
}: {
  buildId: string;
  presetId?: string;
}) {
  const [findings, setFindings] = useState<WastedFinding[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .wasted(buildId, presetId)
      .then((r) => {
        if (alive) setFindings(r.findings);
      })
      .catch(() => {
        if (alive) setFindings([]); // silent degradation — never a broken state
      });
    return () => {
      alive = false;
    };
  }, [buildId, presetId]);

  // Nothing to show (still loading, errored, or genuinely clean) → render nothing.
  if (!findings || findings.length === 0) return null;

  const top = [...findings]
    .sort((a, b) => b.axisWeightedSeverity - a.axisWeightedSeverity)
    .slice(0, TOP_N);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Recoverable stats</SectionLabel>
        <span className="text-xs text-faint">weighted for your goal</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-faint">
        Points and mods doing nothing for what you want — recover and reallocate.
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {top.map((f) => {
          const evidence = Object.entries(f.evidence);
          const pct = Math.round(f.axisWeightedSeverity * 100);
          return (
            <div
              key={f.id}
              className="rounded-[var(--radius)] border border-line bg-surface-2 p-3.5"
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <SeverityChip severity={severityBand(f.axisWeightedSeverity)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-ink">
                    {f.statement}
                  </p>
                  {evidence.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {evidence.map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-baseline gap-1.5 text-xs"
                        >
                          <span className="text-faint">{k}</span>
                          <span className="tabular font-semibold text-muted">
                            {renderEvidenceValue(v)}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span
                  className="tabular shrink-0 self-center text-xs text-faint"
                  title="Severity is scaled by your weight on the axis this touches."
                >
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
