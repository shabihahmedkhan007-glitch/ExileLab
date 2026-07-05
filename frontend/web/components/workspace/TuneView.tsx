// TuneView — "the slider screen", the flagship (UX §4.2). Split view: controls
// left (PreferencePanel, always visible — Law 1), consequences right (the ranked
// ScoreBar list). The list re-ranks client-side on every slider move; only a
// preset change (new satisficing bands) re-fetches. Refused suggestions sit
// below a labeled floor cut-line, greyed with their reason — showing what we
// refused builds more trust than the recommendations (UX §4.2).

"use client";

import { useMemo } from "react";
import type {
  AxisWeights,
  GoalPreset,
  ScoreConstraints,
  TuneResponse,
} from "@/lib/types";
import { compact } from "@/lib/format";
import { rescoreAndRank } from "@/lib/scoring";
import { PreferencePanel } from "@/components/PreferencePanel";
import { ScoreBar } from "@/components/ScoreBar";
import { AICallout } from "@/components/AICallout";
import { SectionLabel } from "@/components/ui";

export function TuneView({
  presets,
  activePresetId,
  activeConstraints,
  weights,
  tune,
  tuning,
  applyingId,
  onSelectPreset,
  onWeightsChange,
  onApply,
}: {
  presets: GoalPreset[];
  activePresetId: string | null;
  activeConstraints?: ScoreConstraints;
  weights: AxisWeights;
  tune: TuneResponse;
  tuning: boolean;
  applyingId: string | null;
  onSelectPreset: (preset: GoalPreset) => void;
  onWeightsChange: (weights: AxisWeights) => void;
  onApply: (mutationId: string) => void;
}) {
  const scored = useMemo(
    () => rescoreAndRank(tune.recommendations, weights),
    [tune, weights],
  );
  const top = scored[0];
  const base = top?.liveBaseScore ?? tune.baseScore;
  const projected = base + (top?.liveDelta ?? 0);
  const scale = Math.max(...scored.map((s) => s.liveDelta), 0.0001);

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <PreferencePanel
          presets={presets}
          activePresetId={activePresetId}
          weights={weights}
          constraints={activeConstraints}
          onSelectPreset={onSelectPreset}
          onWeightsChange={onWeightsChange}
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <SectionLabel>Recommended changes</SectionLabel>
          <div className="tabular flex items-baseline gap-2 text-sm">
            <span className="text-faint">score</span>
            <span className="font-semibold text-muted">
              {base.toFixed(0)}
            </span>
            <span className="text-faint">→</span>
            <span className="text-lg font-bold text-gain">
              {projected.toFixed(0)}
            </span>
          </div>
        </div>

        <div
          className={`flex flex-col gap-2.5 transition-opacity ${
            tuning ? "opacity-50" : "opacity-100"
          }`}
        >
          {scored.length === 0 ? (
            <p className="card p-6 text-sm text-faint">
              No candidate changes improve this build under the current weights.
            </p>
          ) : (
            scored.map((rec) => (
              <ScoreBar
                key={rec.mutationId}
                rec={rec}
                scale={scale}
                onApply={onApply}
                applying={applyingId === rec.mutationId}
              />
            ))
          )}
        </div>

        {/* Build Coach narration of the top changes — below the ranked list
            (UX §4.2). Default COLLAPSED on Tune; the numbers lead, the prose
            follows. Absent narration renders nothing (kill-switch, UX §7.4). */}
        <div className="mt-5">
          <AICallout narration={tune.narration} defaultOpen={false} />
        </div>

        {/* Honest labeling: any Divine cost chip above is a synthetic estimate
            until the real price layer ships (charter §7.5) — same disclaimer
            contract as the Upgrades tab. */}
        {tune.priceDisclaimer ? (
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            {tune.priceDisclaimer}
          </p>
        ) : null}

        {/* The floor cut line — refused suggestions (UX §4.2). */}
        {tune.belowFloor.length > 0 ? (
          <div className="mt-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-line-strong" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
                won&apos;t suggest — drops you below your floor
              </span>
              <div className="h-px flex-1 bg-line-strong" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {tune.belowFloor.map((cut) => (
                <div
                  key={cut.mutationId}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-line bg-surface/60 px-4 py-2.5 opacity-60"
                >
                  <span className="truncate text-sm text-muted">
                    {cut.description}
                  </span>
                  <span className="shrink-0 text-xs text-loss">
                    {cut.violatedFloors
                      .map(
                        (v) =>
                          `${v.metric} ${compact(v.actual)} < ${compact(v.min)}`,
                      )
                      .join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
