// GoalPresetCard — one card in the /goals preset gallery (UX §3 /goals).
// Shows a Goal Preset's identity: its axis-weight allocation as small horizontal
// bars (the "sliders, frozen"), its satisficing target bands, and any hard
// floors. Pure presentational — the numbers are the preset's own definition from
// GET /goals; nothing is invented here.
//
// The "use this preset" CTA deep-links into the build workspace using the
// documented pattern  /b/{buildId}?tab=tune&preset={id}  (the workspace agent
// reads `tab` + `preset` from the query and applies the preset to the sliders).
// With no build in context on the gallery, it links to "/" (paste a build first)
// and carries ?preset so the landing/import flow can forward it if it chooses.

import Link from "next/link";
import { AXIS_LIST, AXIS_META } from "@/lib/axes";
import { compact } from "@/lib/format";
import type { GoalPreset, PreferenceAxis } from "@/lib/types";
import { PREFERENCE_AXES } from "@/lib/types";

/** Humanize a floor metric key (e.g. "totalEHP" -> "Effective HP"). */
const FLOOR_LABELS: Record<string, string> = {
  totalEHP: "Effective HP",
  maximumHitTaken: "Max hit taken",
  fullDPS: "Full DPS",
  totalLife: "Life",
  totalEnergyShield: "Energy Shield",
};
function floorLabel(metric: string): string {
  return FLOOR_LABELS[metric] ?? metric;
}

function enoughLabel(enough: number | null): string {
  return enough === null ? "no cap" : `enough at ${compact(enough)}`;
}

export function GoalPresetCard({ preset }: { preset: GoalPreset }) {
  const maxWeight = Math.max(
    ...PREFERENCE_AXES.map((a) => preset.weights[a] ?? 0),
    0.0001,
  );
  const targets = preset.constraints.targets ?? {};
  const floors = preset.constraints.floors ?? [];
  const targetAxes = PREFERENCE_AXES.filter(
    (a) => targets[a] !== undefined,
  ) as PreferenceAxis[];

  return (
    <div className="card flex flex-col p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg tracking-tight text-ink">
          {preset.name}
        </h3>
        <span className="shrink-0 rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint">
          preset
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted">{preset.description}</p>

      {/* Axis-weight bars — the sliders, frozen. */}
      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Axis weights
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {AXIS_LIST.map((meta) => {
            const w = preset.weights[meta.axis] ?? 0;
            const pct = Math.round((w / maxWeight) * 100);
            return (
              <div
                key={meta.axis}
                className="grid grid-cols-[68px_1fr_34px] items-center gap-2"
              >
                <span className="truncate text-[11px] text-muted">
                  {meta.short}
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      background: meta.color,
                    }}
                  />
                </span>
                <span className="tabular text-right text-[11px] text-faint">
                  {Math.round(w * 100)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Satisficing bands (targets) — floor-first, then maximize (GLOSSARY). */}
      {targetAxes.length > 0 ? (
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Satisficing bands
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
            Each axis stops rewarding once it&apos;s &ldquo;enough&rdquo; — the
            engine satisfices, then maximizes the rest.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {targetAxes.map((a) => {
              const meta = AXIS_META[a];
              return (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: meta.color }}
                  />
                  {meta.short}
                  <span className="tabular text-faint">
                    {enoughLabel(targets[a]?.enough ?? null)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Hard floors (Pro-mode constraints) — candidates below are excluded. */}
      {floors.length > 0 ? (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Hard floors
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {floors.map((f) => (
              <span
                key={f.metric}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                style={{
                  color: "var(--color-sev-major)",
                  borderColor:
                    "color-mix(in oklab, var(--color-sev-major) 40%, transparent)",
                  background:
                    "color-mix(in oklab, var(--color-sev-major) 12%, transparent)",
                }}
              >
                {floorLabel(f.metric)}
                <span className="tabular">&ge; {compact(f.min)}</span>
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
            Any change dropping below a floor is excluded from ranking, not just
            penalized.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex-1" />
      <Link
        href={`/?preset=${encodeURIComponent(preset.id)}`}
        className="mt-2 inline-flex w-full items-center justify-center rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent-dim hover:bg-surface-2"
      >
        Use this preset
      </Link>
    </div>
  );
}
