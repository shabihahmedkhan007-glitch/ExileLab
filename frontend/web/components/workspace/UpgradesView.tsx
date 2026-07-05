// UpgradesView — "the shopping screen" (UX §4.5), the Raidbots Droptimizer
// analog. A budget stepper ("I have __ div to spend") drives POST /upgrades; the
// result is a bar chart of candidate changes where bar length = Δscore-per-Divine
// (the ranking key, never raw DPS — Law 3) with a cost chip per bar and a per-axis
// decomposition on expand. Prices are SYNTHETIC until the real price layer ships,
// and that is stated visibly (honest labeling). When the price layer is switched
// off, the API returns a typed 503 and we degrade to a calm "price layer
// unavailable" empty state — never an error screen (the price kill-switch mirrors
// the Coach kill-switch). The ItemSwap panel (OPT-3) sits below the chart.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { AxisWeights, UpgradesResponse } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { CandidateBar } from "./CandidateBar";
import { ItemSwapPanel } from "./ItemSwapPanel";
import { SectionLabel, Skeleton } from "@/components/ui";

/** Free tier: top results visible, the rest blurred-with-count (UX §6). */
const FREE_VISIBLE = 3;

export function UpgradesView({
  buildId,
  activePresetId,
  weights,
  onApply,
  applyingId,
}: {
  buildId: string;
  activePresetId: string | null;
  weights: AxisWeights;
  onApply: (mutationId: string) => void;
  applyingId: string | null;
}) {
  const [budget, setBudget] = useState(10);
  const [data, setData] = useState<UpgradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceLayerOff, setPriceLayerOff] = useState(false);

  const load = useCallback(
    async (budgetDivines: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.upgrades(buildId, {
          budgetDivines,
          ...(activePresetId
            ? { presetId: activePresetId }
            : { weights: weights as Partial<AxisWeights> }),
        });
        setData(res);
        setPriceLayerOff(false);
      } catch (e) {
        setData(null);
        if (e instanceof ApiError && e.status === 503) {
          setPriceLayerOff(true);
        } else {
          setError(
            e instanceof ApiError ? e.message : "Couldn't load upgrades.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    // weights/preset are read at fetch time; the tab remounts with current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildId],
  );

  useEffect(() => {
    load(budget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget]);

  const candidates = data?.candidates ?? [];
  const scale = Math.max(...candidates.map((c) => c.scorePerDivine), 0.0001);

  return (
    <div className="py-6">
      {/* Budget stepper */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SectionLabel>Your budget</SectionLabel>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="text-faint">I have</span>
          <div className="flex items-center rounded-md border border-line-strong bg-surface-2">
            <button
              onClick={() => setBudget((b) => Math.max(1, b - 1))}
              className="px-2.5 py-1 text-muted transition-colors hover:text-ink"
              aria-label="Lower budget"
            >
              –
            </button>
            <span className="tabular w-10 text-center font-semibold text-ink">
              {budget}
            </span>
            <button
              onClick={() => setBudget((b) => Math.min(1000, b + 1))}
              className="px-2.5 py-1 text-muted transition-colors hover:text-ink"
              aria-label="Raise budget"
            >
              +
            </button>
          </div>
          <span className="text-faint">div to spend</span>
        </div>
        {data ? (
          <span className="ml-auto text-xs text-faint">
            {candidates.length} upgrade{candidates.length === 1 ? "" : "s"} under
            budget · ranked by score / divine
          </span>
        ) : null}
      </div>

      {priceLayerOff ? (
        <PriceLayerOff />
      ) : error ? (
        <div className="card p-6 text-sm text-loss">{error}</div>
      ) : loading && !data ? (
        <UpgradesSkeleton />
      ) : (
        <>
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            {candidates.length === 0 ? (
              <p className="card p-6 text-sm text-faint">
                Nothing improves this build within {budget} div under your
                current goal. Raise the budget or retune your sliders.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {candidates.map((c, i) => {
                  const gated = i >= FREE_VISIBLE;
                  return (
                    <div
                      key={c.mutationId}
                      className={
                        gated
                          ? "pointer-events-none select-none opacity-55 blur-[3px]"
                          : ""
                      }
                      aria-hidden={gated}
                    >
                      <CandidateBar
                        headline={c.scorePerDivine}
                        headlineLabel="score / div"
                        description={c.description}
                        fraction={c.scorePerDivine / scale}
                        cost={c.costDivines}
                        perAxis={c.perAxis}
                        action={{
                          label: "Apply",
                          busy: applyingId === c.mutationId,
                          onClick: () => onApply(c.mutationId),
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Freemium line — blur-with-count, honest about what exists (UX §6). */}
            {candidates.length > FREE_VISIBLE ? (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-line-strong bg-surface-2/50 px-4 py-3 text-sm">
                <span className="text-muted">
                  +{candidates.length - FREE_VISIBLE} more upgrade
                  {candidates.length - FREE_VISIBLE === 1 ? "" : "s"} ranked below
                </span>
                <span className="rounded-full border border-accent-dim bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
                  Pro
                </span>
              </div>
            ) : null}
          </div>

          {/* Synthetic-price disclaimer — always visibly rendered (honest
              labeling, charter §7.5). */}
          {data ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--color-sev-minor)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-sev-minor)_10%,transparent)] px-4 py-3 text-xs leading-relaxed text-muted">
              <span className="mt-px shrink-0 text-[var(--color-sev-minor)]" aria-hidden>
                ⚑
              </span>
              <span>
                <span className="font-semibold text-[var(--color-sev-minor)]">
                  Synthetic prices.{" "}
                </span>
                {data.priceDisclaimer}
              </span>
            </div>
          ) : null}
        </>
      )}

      {/* Item-swap panel (OPT-3) — always available, independent of prices. */}
      <div className="mt-6">
        <ItemSwapPanel buildId={buildId} />
      </div>
    </div>
  );
}

function PriceLayerOff() {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-2xl" aria-hidden>
        ⏸
      </div>
      <p className="text-sm font-medium text-ink">Price layer unavailable</p>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
        The upgrade shopping list needs prices, and the price provider is
        currently switched off. We won&apos;t invent prices — the ranked engine
        results return the moment the compliance-reviewed price layer is back on.
      </p>
      <p className="mt-1 text-xs text-faint">
        Item testing below still works — it scores a swap without needing a price.
      </p>
    </div>
  );
}

function UpgradesSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[70px] rounded-[var(--radius)]" />
      ))}
    </div>
  );
}
