// /goals — the Goal Preset gallery (UX §3). A card per built-in preset from
// GET /goals: its axis-weight visualization, satisficing bands, and hard floors.
// Server component: fetches once, renders static cards. No workspace state.
//
// A Goal Preset is a named, pre-tuned set of axis weights + floor constraints
// (GLOSSARY "Goal Preset"). Selecting one sets the sliders in the Tune screen;
// the "use this preset" CTA deep-links via /b/{id}?tab=tune&preset={id} once a
// build is in context (documented on GoalPresetCard for the workspace agent).

import type { Metadata } from "next";
import { api, ApiError } from "@/lib/api";
import type { GoalPreset } from "@/lib/types";
import { GoalPresetCard } from "@/components/GoalPresetCard";

export const metadata: Metadata = {
  title: "Goal Presets — ExileLab",
  description:
    "Pre-tuned bundles of preference-axis weights and satisficing constraints. Pick a goal; the sliders follow.",
};

export default async function GoalsPage() {
  let presets: GoalPreset[] = [];
  let error: string | null = null;
  try {
    presets = (await api.goals()).presets;
  } catch (e) {
    error =
      e instanceof ApiError
        ? e.message
        : "Couldn't load the Goal Presets right now.";
  }

  return (
    <div className="py-12 md:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          The sliders are the product
        </p>
        <h1 className="font-serif text-3xl leading-tight tracking-tight text-ink md:text-4xl">
          Goal Presets
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          Each preset is a pre-tuned set of{" "}
          <span className="text-ink">preference-axis weights</span> and{" "}
          <span className="text-ink">satisficing constraints</span>. Pick one and
          the Tune sliders snap to it — then adjust anything you like. The best
          build is the one that fits how <em>you</em> play, not a leaderboard.
        </p>
      </div>

      {error ? (
        <div className="mx-auto mt-10 max-w-lg rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--color-loss)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-loss)_10%,transparent)] px-4 py-3 text-center text-sm text-loss">
          {error}
        </div>
      ) : (
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => (
            <GoalPresetCard key={p.id} preset={p} />
          ))}
        </div>
      )}

      <p className="mx-auto mt-12 max-w-xl text-center text-xs leading-relaxed text-faint">
        Weights sum across the eight Preference Axes: Damage, Survivability,
        Movement Speed, Attack Speed, Cast Speed, Skill Mobility Efficiency,
        Resource Sustain, Currency Efficiency. Every ranking these presets drive
        is a Weighted Score ordering — never raw DPS.
      </p>
    </div>
  );
}
