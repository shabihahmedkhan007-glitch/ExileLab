// CompareView — "the diff screen" (UX §4.4). Paste any build (code or ExileLab
// JSON) → POST /compare/import → GET /compare?with=. The pivot's whole thesis is
// the FIRST thing rendered: both builds re-scored under the USER'S sliders, so
// "the best build on paper may score below yours for what you want." Then the
// evidence — a gear/skill diff table (PoB green/red convention on changed mod
// lines), a passive-tree diff summary (counts + node-id chips: yours-only blue,
// theirs-only green, shared dim) — and finally the "steal one thing" candidates,
// each a tune-style CandidateBar with a Weighted Score delta, per-axis
// decomposition, and a [try this] that promotes to a new snapshot. The other
// build always carries its SourceChip attribution (a feature, not fine print).

"use client";

import { useEffect, useRef, useState } from "react";
import type { AxisWeights, CompareResponse } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { CandidateBar } from "./CandidateBar";
import { SourceChip } from "@/components/SourceChip";
import { SectionLabel, Skeleton } from "@/components/ui";
import { SAMPLE_BUILD } from "@/lib/sample";

const NODE_CHIP_CAP = 28; // cap tree-diff chips; the rest collapse to "+N more".
const RESCORE_DEBOUNCE_MS = 350; // slider settles → one re-score request (Law 1)

export function CompareView({
  buildId,
  presetId,
  weights,
  onApply,
  applyingId,
}: {
  buildId: string;
  presetId: string | null;
  /** The user's LIVE slider weights — used whenever presetId is null (custom). */
  weights: AxisWeights;
  onApply: (mutationId: string) => void;
  applyingId: string | null;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otherId, setOtherId] = useState<string | null>(null);

  // Law 1: the sliders are the product. The thesis row and candidate ranking are
  // scored under the user's ACTUAL weights — a preset when one is active, the
  // live slider vector when the user has dragged off-preset (never a silent
  // default-preset fallback).
  async function fetchCompare(withId: string) {
    return presetId !== null
      ? api.compare(buildId, withId, presetId)
      : api.compare(buildId, withId, undefined, weights as Record<string, number>);
  }

  async function runCompare() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { otherBuildId } = await api.compareImport(buildId, input);
      setOtherId(otherBuildId);
      const res = await fetchCompare(otherBuildId);
      setData(res);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't import or compare that build.",
      );
    } finally {
      setBusy(false);
    }
  }

  // Re-score the loaded comparison when the preset or sliders change (debounced
  // so a drag settles into one request; engine results are server-cached so the
  // round trip is sub-second).
  const weightsKey = JSON.stringify(weights);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (otherId === null || data === null) return;
    const t = setTimeout(() => {
      fetchCompare(otherId)
        .then(setData)
        .catch(() => {
          /* keep the last good comparison; transient re-score failure is non-fatal */
        });
    }, RESCORE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, weightsKey, otherId]);

  function reset() {
    setData(null);
    setInput("");
    setError(null);
    setOtherId(null);
  }

  // --- Paste state (no comparison loaded yet) ------------------------------
  if (!data) {
    return (
      <div className="py-6">
        <div className="mx-auto max-w-2xl">
          <SectionLabel>Compare against any build</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Paste a rival build — a Path of Building code or ExileLab JSON. We
            import it, then re-score <em>both</em> builds under{" "}
            <span className="text-ink">your</span> current sliders. The best
            build on paper often scores below yours for what you actually want.
          </p>

          <div className="card mt-4 p-1.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Compare against any build — code or ExileLab JSON."
              rows={5}
              disabled={busy}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runCompare();
              }}
              className="w-full resize-none rounded-[var(--radius)] bg-transparent px-4 py-3 text-sm text-ink placeholder:text-faint focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-1.5">
              <button
                onClick={() => setInput(SAMPLE_BUILD)}
                disabled={busy}
                className="text-xs text-muted underline-offset-4 transition-colors hover:text-ink hover:underline disabled:opacity-40"
              >
                Use a sample rival
              </button>
              <button
                onClick={runCompare}
                disabled={busy || !input.trim()}
                className="rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
              >
                {busy ? "Comparing…" : "Compare →"}
              </button>
            </div>
          </div>

          {busy ? (
            <div className="mt-4 flex flex-col gap-2.5">
              <Skeleton className="h-20 rounded-[var(--radius)]" />
              <Skeleton className="h-32 rounded-[var(--radius)]" />
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--color-loss)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-loss)_10%,transparent)] px-4 py-3 text-sm text-loss">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // --- Loaded comparison ---------------------------------------------------
  const { scoreRow, other, diff, candidates } = data;
  const youWin = scoreRow.userScore >= scoreRow.otherScoreUnderUserWeights;
  const gap = Math.abs(scoreRow.userScore - scoreRow.otherScoreUnderUserWeights);
  const changedGear = diff.gear.filter((g) => g.status !== "unchanged");
  const candidateScale = Math.max(...candidates.map((c) => c.delta), 0.0001);

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* (a) THE SCORE ROW — the pivot's thesis, rendered first. */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Under your sliders</SectionLabel>
          <button
            onClick={reset}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent-dim hover:text-ink"
          >
            Compare another
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <ScorePillar
            label="You"
            score={scoreRow.userScore}
            win={youWin}
          />
          <div className="text-center">
            <div className="tabular text-xs font-semibold text-faint">vs</div>
          </div>
          <ScorePillar
            label="Them"
            score={scoreRow.otherScoreUnderUserWeights}
            win={!youWin}
            align="right"
          />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          {youWin ? (
            <>
              Your build scores{" "}
              <span className="tabular font-semibold text-gain">
                {gap.toFixed(1)}
              </span>{" "}
              higher for what <span className="text-ink">you</span> want — even
              if theirs looks better on a leaderboard. Still, there may be one
              thing worth stealing below.
            </>
          ) : (
            <>
              Their build edges yours by{" "}
              <span className="tabular font-semibold text-accent-strong">
                {gap.toFixed(1)}
              </span>{" "}
              under your current sliders. The candidates below are the specific
              differences that would close that gap for your goal.
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-faint">Rival build:</span>
          <SourceChip
            provenance={other.provenance}
            attribution={other.provenance.attribution ?? other.provenance.source}
          />
          <span className="text-xs text-faint">
            {other.ascendancy ?? other.class} · lvl {other.level}
          </span>
        </div>
      </div>

      {/* (c) Tree diff summary. */}
      <div className="card p-5">
        <SectionLabel>Passive tree diff</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <TreeCount
            label="shared"
            n={diff.nodes.shared.length}
            color="var(--color-faint)"
          />
          <TreeCount
            label="only yours"
            n={diff.nodes.onlyInUser.length}
            color="var(--color-accent-strong)"
          />
          <TreeCount
            label="only theirs"
            n={diff.nodes.onlyInOther.length}
            color="var(--color-gain)"
          />
        </div>

        {diff.nodes.onlyInUser.length > 0 ? (
          <NodeChips
            title="Nodes only you allocate"
            ids={diff.nodes.onlyInUser}
            color="var(--color-accent-strong)"
          />
        ) : null}
        {diff.nodes.onlyInOther.length > 0 ? (
          <NodeChips
            title="Nodes only they allocate"
            ids={diff.nodes.onlyInOther}
            color="var(--color-gain)"
          />
        ) : null}
      </div>

      {/* (b) Gear / skill / config diff table. */}
      <div className="card p-5">
        <SectionLabel>Gear &amp; setup diff</SectionLabel>
        {changedGear.length === 0 &&
        diff.skills.every((s) => s.status === "unchanged") ? (
          <p className="mt-3 text-sm text-faint">
            Identical gear and skill setups — the difference is all in the tree
            and config above.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[420px] divide-y divide-line">
              {changedGear.map((g) => (
                <div
                  key={g.slot}
                  className="grid grid-cols-[120px_1fr] gap-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium text-ink">
                      {g.slot}
                    </span>
                    <GearStatus status={g.status} />
                  </div>
                  <div className="flex flex-col gap-1">
                    {g.removedModLines.map((line, i) => (
                      <span
                        key={`r${i}`}
                        className="tabular text-xs leading-snug text-loss"
                      >
                        − {line}
                      </span>
                    ))}
                    {g.addedModLines.map((line, i) => (
                      <span
                        key={`a${i}`}
                        className="tabular text-xs leading-snug text-gain"
                      >
                        + {line}
                      </span>
                    ))}
                    {g.removedModLines.length === 0 &&
                    g.addedModLines.length === 0 ? (
                      <span className="text-xs text-faint">
                        {g.status === "added"
                          ? "they run this slot, you don't"
                          : g.status === "removed"
                            ? "you run this slot, they don't"
                            : "no mod-line differences"}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill / config summary rows. */}
        {(diff.skills.some((s) => s.status !== "unchanged") ||
          diff.config.some((c) => c.status !== "unchanged")) ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-muted">
            {diff.skills
              .filter((s) => s.status !== "unchanged")
              .map((s) => (
                <span key={s.setupId} className="inline-flex items-center gap-1.5">
                  <span className="text-faint">skill</span>
                  <span className="text-ink">{s.setupId}</span>
                  <span className="text-faint">{s.status}</span>
                </span>
              ))}
            {diff.config
              .filter((c) => c.status !== "unchanged")
              .map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5">
                  <span className="text-faint">config</span>
                  <span className="text-ink">{c.key}</span>
                  <span className="text-faint">{c.status}</span>
                </span>
              ))}
          </div>
        ) : null}
      </div>

      {/* (d) "Steal one thing" candidates → tune-style CandidateBars. */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Steal one thing</SectionLabel>
          <span className="text-xs text-faint">
            ranked by Δ score under your sliders
          </span>
        </div>
        {candidates.length === 0 ? (
          <p className="card p-6 text-sm text-faint">
            No single difference from their build improves yours under your
            current weights — you&apos;re already ahead where it counts.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {candidates.map((c) => (
              <CandidateBar
                key={c.mutationId}
                headline={c.delta}
                headlineLabel="score"
                description={c.description}
                fraction={c.delta / candidateScale}
                perAxis={c.perAxis}
                source={c.source}
                action={{
                  label: "Try this",
                  busy: applyingId === c.mutationId,
                  onClick: () => onApply(c.mutationId),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScorePillar({
  label,
  score,
  win,
  align = "left",
}: {
  label: string;
  score: number;
  win: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
      <div
        className={`tabular text-4xl font-bold leading-none ${
          win ? "text-gain" : "text-muted"
        }`}
      >
        {score.toFixed(0)}
        <span className="text-lg text-faint">/100</span>
      </div>
    </div>
  );
}

function TreeCount({
  label,
  n,
  color,
}: {
  label: string;
  n: number;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
      <span className="tabular text-lg font-bold text-ink">{n}</span>
      <span className="text-xs text-muted">{label}</span>
    </span>
  );
}

function NodeChips({
  title,
  ids,
  color,
}: {
  title: string;
  ids: number[];
  color: string;
}) {
  const shown = ids.slice(0, NODE_CHIP_CAP);
  const rest = ids.length - shown.length;
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-xs text-faint">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((id) => (
          <span
            key={id}
            className="tabular rounded-md border px-1.5 py-0.5 text-[11px]"
            style={{
              color,
              borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
              background: `color-mix(in oklab, ${color} 10%, transparent)`,
            }}
          >
            {id}
          </span>
        ))}
        {rest > 0 ? (
          <span className="tabular rounded-md border border-line px-1.5 py-0.5 text-[11px] text-faint">
            +{rest} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GearStatus({ status }: { status: string }) {
  const UNCHANGED = { color: "var(--color-faint)", label: "same" };
  const map: Record<string, { color: string; label: string }> = {
    added: { color: "var(--color-gain)", label: "theirs" },
    removed: { color: "var(--color-loss)", label: "yours" },
    changed: { color: "var(--color-sev-minor)", label: "changed" },
    unchanged: UNCHANGED,
  };
  const s = map[status] ?? UNCHANGED;
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        color: s.color,
        background: `color-mix(in oklab, ${s.color} 14%, transparent)`,
      }}
    >
      {s.label}
    </span>
  );
}
