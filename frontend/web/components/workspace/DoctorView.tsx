// DoctorView — "the report screen" (UX §4.3). Goal-aware: a goal switcher
// re-fetches and visibly re-grades (the grade is honest about its scope). Per-
// category letter grades, then severity-sorted FindingCard rows with inline
// deterministic evidence and expandable fixes. The report FOOTER is the single
// AICallout — the Build Coach's optional narration of the findings above it,
// default-expanded here (Law 3, UX §7). Absent narration renders nothing.

"use client";

import { useEffect, useState } from "react";
import type { DoctorReport, Goal } from "@/lib/types";
import { api } from "@/lib/api";
import { GOAL_LABELS, GOALS } from "@/lib/format";
import { FindingCard } from "@/components/FindingCard";
import { GradeChip } from "@/components/chips";
import { AICallout } from "@/components/AICallout";
import { SectionLabel, Skeleton } from "@/components/ui";

const CATEGORIES = ["Offense", "Defense", "Sustain", "QoL"] as const;

export function DoctorView({
  buildId,
  initialReport,
  initialGoal,
}: {
  buildId: string;
  initialReport: DoctorReport | null;
  initialGoal: Goal;
}) {
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const [tier, setTier] = useState(10);
  const [report, setReport] = useState<DoctorReport | null>(
    initialReport && initialReport.goal === initialGoal ? initialReport : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Skip the fetch if the seeded report already matches the requested view.
    if (report && report.goal === goal && report.tier === tier) return;
    setLoading(true);
    setError(null);
    api
      .doctor(buildId, goal, tier)
      .then((r) => {
        if (alive) setReport(r);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId, goal, tier]);

  return (
    <div className="py-6">
      {/* Goal switcher + tier */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SectionLabel>Graded for</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                g === goal
                  ? "border-accent bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] text-accent-strong"
                  : "border-line-strong bg-surface-2 text-muted hover:border-accent-dim hover:text-ink"
              }`}
            >
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className="text-faint">map tier</span>
          <div className="flex items-center rounded-md border border-line-strong bg-surface-2">
            <button
              onClick={() => setTier((t) => Math.max(0, t - 1))}
              className="px-2 py-1 text-muted hover:text-ink"
              aria-label="Lower tier"
            >
              –
            </button>
            <span className="tabular w-7 text-center font-semibold text-ink">
              {tier}
            </span>
            <button
              onClick={() => setTier((t) => Math.min(16, t + 1))}
              className="px-2 py-1 text-muted hover:text-ink"
              aria-label="Raise tier"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="card p-6 text-sm text-loss">{error}</div>
      ) : loading && !report ? (
        <DoctorSkeleton />
      ) : report ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          {/* Category grades */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <GradeChip key={c} category={c} grade={report.grades[c]} />
            ))}
          </div>

          {/* Verdict statement */}
          <p className="mt-4 text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Verdict · </span>
            {report.verdict.statement}
          </p>

          {/* Findings, severity-sorted */}
          <div className="mt-5 flex flex-col gap-2.5">
            {report.findings
              .filter((f) => f.id !== report.verdict.id)
              .map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
          </div>

          {/* Report FOOTER: the one home for generated prose (UX §4.3). Default
              expanded on Doctor. Absent narration → renders nothing (kill-switch). */}
          <div className="mt-5">
            <AICallout narration={report.narration} defaultOpen />
          </div>

          <p className="mt-6 text-xs text-faint">
            Graded against tier-{report.tier} content for{" "}
            {GOAL_LABELS[report.goal]} · rulebook {report.rulebookVersion}.
            Numbers are computed by the deterministic engine.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DoctorSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
