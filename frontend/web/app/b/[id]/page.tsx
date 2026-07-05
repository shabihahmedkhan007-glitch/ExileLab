// The build workspace — one build, one URL (UX §3). A client shell that loads
// the measured build once and holds the shared tuning state (weights, active
// preset) so context persists across the Overview / Tune / Doctor tabs. Slider
// moves re-score client-side (Law 1); only preset changes and Doctor goal
// switches touch the API. Everything talks to the ExileLab API only (§7.5).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  AxisWeights,
  BuildDetailResponse,
  DoctorReport,
  GoalPreset,
  ScoreConstraints,
  TuneResponse,
} from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { goalFromPresetId, presetIdFromSuggestion } from "@/lib/format";
import { presetToSliders } from "@/components/PreferencePanel";
import { BuildHeader } from "@/components/workspace/BuildHeader";
import { Overview } from "@/components/workspace/Overview";
import { TuneView } from "@/components/workspace/TuneView";
import { DoctorView } from "@/components/workspace/DoctorView";
import { CompareView } from "@/components/workspace/CompareView";
import { UpgradesView } from "@/components/workspace/UpgradesView";
import { Skeleton } from "@/components/ui";

type Tab = "overview" | "tune" | "compare" | "upgrades" | "doctor";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tune", label: "Tune" },
  { id: "compare", label: "Compare" },
  { id: "upgrades", label: "Upgrades" },
  { id: "doctor", label: "Doctor" },
];

export default function BuildWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<BuildDetailResponse | null>(null);
  const [goals, setGoals] = useState<GoalPreset[]>([]);
  const [tune, setTune] = useState<TuneResponse | null>(null);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [weights, setWeights] = useState<AxisWeights | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [tuneConstraints, setTuneConstraints] = useState<
    ScoreConstraints | undefined
  >(undefined);
  const [tuning, setTuning] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Initial load --------------------------------------------------------
  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      try {
        const [detailRes, goalsRes] = await Promise.all([
          api.getBuild(id),
          api.goals(),
        ]);
        if (!alive) return;
        setDetail(detailRes);
        setGoals(goalsRes.presets);

        const presetId = presetIdFromSuggestion(
          detailRes.archetype.suggestedPreset,
        );
        const preset =
          goalsRes.presets.find((p) => p.id === presetId) ??
          goalsRes.presets[0];
        if (!preset) throw new Error("No Goal Presets available from the API.");

        const [tuneRes, doctorRes] = await Promise.all([
          api.tuneByPreset(id, preset.id),
          api.doctor(id, goalFromPresetId(preset.id), 10).catch(() => null),
        ]);
        if (!alive) return;
        setTune(tuneRes);
        setDoctor(doctorRes);
        setWeights(presetToSliders(preset));
        setActivePresetId(preset.id);
        setTuneConstraints(preset.constraints);
      } catch (e) {
        if (alive) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load this build.",
          );
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // --- Preset change: new satisficing bands → re-fetch tune ---------------
  const onSelectPreset = useCallback(
    async (preset: GoalPreset) => {
      setActivePresetId(preset.id);
      setWeights(presetToSliders(preset));
      setTuneConstraints(preset.constraints);
      setTuning(true);
      try {
        const res = await api.tuneByPreset(id, preset.id);
        setTune(res);
      } catch {
        /* keep prior recommendations; the client re-score still works */
      } finally {
        setTuning(false);
      }
    },
    [id],
  );

  // --- Slider drag: client re-score only (no fetch) — Law 1 ----------------
  const onWeightsChange = useCallback((next: AxisWeights) => {
    setWeights(next);
    setActivePresetId(null); // now a custom weighting
  }, []);

  // --- Apply a change: promote → a NEW snapshot at a NEW URL ---------------
  const onApply = useCallback(
    async (mutationId: string) => {
      setApplyingId(mutationId);
      try {
        const res = await api.promote(id, mutationId);
        router.push(`/b/${res.buildId}`);
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : "Could not apply that change.",
        );
        setApplyingId(null);
      }
    },
    [id, router],
  );

  const activePreset = useMemo(
    () => goals.find((g) => g.id === activePresetId) ?? null,
    [goals, activePresetId],
  );

  // --- Error / loading -----------------------------------------------------
  if (error && !detail) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg font-medium text-ink">Couldn&apos;t load build</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-2 text-sm text-ink hover:bg-surface-2"
        >
          ← Back to import
        </button>
      </div>
    );
  }

  if (!detail || !tune || !weights) {
    return <WorkspaceSkeleton />;
  }

  return (
    <div className="pb-10">
      <BuildHeader
        summary={detail.summary}
        provenance={detail.provenance}
        attribution={detail.attribution}
        archetype={detail.archetype}
      />

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "text-ink"
                : "text-faint hover:text-muted"
            }`}
          >
            {t.label}
            {tab === t.id ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--color-loss)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-loss)_10%,transparent)] px-4 py-3 text-sm text-loss">
          {error}
        </div>
      ) : null}

      {tab === "overview" ? (
        <Overview
          detail={detail}
          tune={tune}
          weights={weights}
          activePreset={activePreset}
          doctor={doctor}
          onNavigate={setTab}
        />
      ) : null}

      {tab === "tune" ? (
        <TuneView
          presets={goals}
          activePresetId={activePresetId}
          activeConstraints={tuneConstraints}
          weights={weights}
          tune={tune}
          tuning={tuning}
          applyingId={applyingId}
          onSelectPreset={onSelectPreset}
          onWeightsChange={onWeightsChange}
          onApply={onApply}
        />
      ) : null}

      {tab === "compare" ? (
        <CompareView
          buildId={id}
          presetId={activePresetId}
          weights={weights}
          onApply={onApply}
          applyingId={applyingId}
        />
      ) : null}

      {tab === "upgrades" ? (
        <UpgradesView
          buildId={id}
          activePresetId={activePresetId}
          weights={weights}
          onApply={onApply}
          applyingId={applyingId}
        />
      ) : null}

      {tab === "doctor" ? (
        <DoctorView
          buildId={id}
          initialReport={doctor}
          initialGoal={goalFromPresetId(activePresetId ?? "balanced")}
        />
      ) : null}
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="pb-10">
      <div className="flex flex-col gap-3 pt-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mt-5 flex gap-4 border-b border-line pb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Skeleton className="h-[420px] rounded-[var(--radius-lg)]" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </div>
  );
}
