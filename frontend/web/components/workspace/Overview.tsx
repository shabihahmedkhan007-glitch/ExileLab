// Overview — "the verdict screen" (UX §4.1). Verdict first (the Weighted Score
// under the active goal), evidence second (the measured engine stats, in PoE
// stat colors, typographically primary — Law 3), action third (top findings →
// Doctor). The radar is the centerpiece: delivers-polygon vs wants-polygon.

"use client";

import { useMemo } from "react";
import type {
  BuildDetailResponse,
  DoctorReport,
  GoalPreset,
  PreferenceAxis,
  TuneResponse,
} from "@/lib/types";
import { PREFERENCE_AXES } from "@/lib/types";
import { compact, integer, percentFromMult } from "@/lib/format";
import { deliversByAxis, liveBaseScore } from "@/lib/scoring";
import { RadarChart } from "@/components/RadarChart";
import { StatDelta } from "@/components/StatDelta";
import { SeverityDot } from "@/components/chips";
import { SectionLabel } from "@/components/ui";
import { WastedStats } from "./WastedStats";

export function Overview({
  detail,
  tune,
  weights,
  activePreset,
  doctor,
  onNavigate,
}: {
  detail: BuildDetailResponse;
  tune: TuneResponse;
  weights: Record<PreferenceAxis, number>;
  activePreset: GoalPreset | null;
  doctor: DoctorReport | null;
  onNavigate: (tab: "tune" | "doctor") => void;
}) {
  const m = detail.calculation.metrics;

  const delivers = useMemo(
    () => deliversByAxis(tune.recommendations),
    [tune],
  );
  const wants = useMemo(() => {
    const max = Math.max(...PREFERENCE_AXES.map((a) => weights[a] ?? 0), 1);
    const out = {} as Record<PreferenceAxis, number>;
    for (const a of PREFERENCE_AXES) out[a] = (weights[a] ?? 0) / max;
    return out;
  }, [weights]);

  const score = useMemo(
    () => liveBaseScore(tune.recommendations, weights),
    [tune, weights],
  );

  const topFindings = (doctor?.findings ?? [])
    .filter((f) => f.severity !== "pass")
    .slice(0, 3);

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Radar + verdict */}
      <div className="card flex flex-col items-center p-6">
        <div className="mb-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Weighted Score
            {activePreset ? ` · ${activePreset.name}` : " · custom"}
          </div>
          <div className="tabular mt-1 text-5xl font-bold text-ink">
            {score.toFixed(0)}
            <span className="text-2xl text-faint">/100</span>
          </div>
        </div>
        <RadarChart delivers={delivers} wants={wants} />
        <p className="mt-4 max-w-[30ch] text-center text-xs leading-relaxed text-faint">
          The gap between the polygons is what tuning can close — your build vs
          what your sliders want.
        </p>
      </div>

      {/* Measured stats + findings */}
      <div className="flex flex-col gap-6">
        <div className="card p-6">
          <SectionLabel>Your build, measured</SectionLabel>
          <div className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <StatDelta
              label="Full DPS"
              value={compact(m.fullDPS ?? 0)}
              valueColor="var(--color-fire)"
              emphasis="xl"
              note="combined"
            />
            <StatDelta
              label="Effective HP"
              value={integer(m.totalEHP ?? 0)}
              valueColor="var(--color-life)"
              emphasis="xl"
            />
            <StatDelta
              label="Movement"
              value={percentFromMult(m.effectiveMovementSpeedMod ?? 1)}
              valueColor="var(--color-cold)"
              emphasis="lg"
              note="incl. skill mobility"
            />
            <StatDelta
              label="Attack rate"
              value={`${(m.attackRate ?? 0).toFixed(1)}/s`}
              valueColor="var(--color-lightning)"
              emphasis="lg"
            />
            <StatDelta
              label="Max hit taken"
              value={integer(m.maximumHitTaken ?? 0)}
              valueColor="var(--color-es)"
              emphasis="lg"
            />
            <StatDelta
              label="Unreserved mana"
              value={integer(m.unreservedMana ?? 0)}
              valueColor="var(--color-mana)"
              emphasis="lg"
            />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <SectionLabel>Top findings</SectionLabel>
            <button
              onClick={() => onNavigate("doctor")}
              className="text-xs font-medium text-accent-strong hover:underline"
            >
              Full diagnosis →
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {topFindings.length === 0 ? (
              <p className="text-sm text-faint">
                No warnings for the active goal — nice and clean.
              </p>
            ) : (
              topFindings.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-line bg-surface-2 px-3 py-2.5"
                >
                  <span className="pt-1">
                    <SeverityDot severity={f.severity} />
                  </span>
                  <p className="text-sm leading-relaxed text-muted">
                    {f.statement}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recoverable inefficiencies, weighted for the active goal (OPT-1). */}
        <WastedStats
          buildId={detail.summary.buildId}
          presetId={activePreset?.id}
        />

        <div className="flex gap-3">
          <button
            onClick={() => onNavigate("tune")}
            className="flex-1 rounded-[var(--radius)] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Tune my build
          </button>
          <button
            onClick={() => onNavigate("doctor")}
            className="flex-1 rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            Full diagnosis
          </button>
        </div>
      </div>
    </div>
  );
}
