// ItemSwapPanel — the "paste an item" flow inside Upgrades (OPT-3, UX §4.4). A
// textarea takes raw PoE item text; POST /itemswap parses it deterministically,
// engine-evaluates the swap on this build, and returns a Weighted Score delta
// with a per-axis decomposition (Law 3 — every number computed, never invented).
// The parsed item renders as a canonical ItemTooltip; a below-floor swap wears a
// warning. Unparseable text returns a typed 422 → a calm inline message, never a
// wrong swap.

"use client";

import { useState } from "react";
import type { ItemSwapResponse, PreferenceAxis } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { AXIS_META } from "@/lib/axes";
import { signed } from "@/lib/format";
import { ItemTooltip } from "./ItemTooltip";
import { SectionLabel } from "@/components/ui";

export function ItemSwapPanel({ buildId }: { buildId: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ItemSwapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.itemSwap(buildId, text);
      setResult(res);
    } catch (e) {
      setResult(null);
      setError(
        e instanceof ApiError
          ? e.status === 422
            ? "Couldn't parse that as an item. Paste the full item text (copied in-game with Ctrl+C)."
            : e.message
          : "Something went wrong evaluating that item.",
      );
    } finally {
      setBusy(false);
    }
  }

  const contributions =
    result?.perAxis
      .filter((c) => Math.abs(c.weightedDelta) >= 0.05)
      .sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta)) ??
    [];

  return (
    <div className="card p-5">
      <SectionLabel>Test an item you found</SectionLabel>
      <p className="mt-1.5 text-xs leading-relaxed text-faint">
        Paste raw item text — we measure the swap on your build and score the
        change under your goal. Nothing is fetched; the item is parsed locally.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "Paste an item, e.g.\nItem Class: Rings\nRarity: Rare\nStorm Coil\n+42 to maximum Life\n+38% to Fire Resistance"
        }
        rows={5}
        disabled={busy}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        className="mt-3 w-full resize-none rounded-[var(--radius)] border border-line bg-surface-2 px-3 py-2.5 font-mono text-xs text-ink placeholder:text-faint focus:border-accent-dim focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-faint">⌘/Ctrl + Enter</span>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          {busy ? "Measuring…" : "Score this swap"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--color-loss)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-loss)_10%,transparent)] px-3 py-2.5 text-sm text-loss">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Δscore card */}
          <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-faint">
                Δ Weighted Score
              </span>
              <span
                className={`tabular text-3xl font-bold leading-none ${
                  result.delta >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {signed(result.delta)}
              </span>
            </div>

            {contributions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {contributions.map((c) => {
                  const meta = AXIS_META[c.axis as PreferenceAxis];
                  return (
                    <span
                      key={c.axis}
                      className="inline-flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: meta?.color ?? "var(--color-muted)",
                        }}
                      />
                      <span className="text-muted">{meta?.short ?? c.axis}</span>
                      <span
                        className={`tabular font-semibold ${
                          c.weightedDelta >= 0 ? "text-gain" : "text-loss"
                        }`}
                      >
                        {signed(c.weightedDelta)}
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-xs text-faint">
                No axis you weight moves measurably.
              </p>
            )}

            {result.belowFloor ? (
              <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--color-sev-major)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-sev-major)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-sev-major)]">
                <span aria-hidden>⚠</span>
                <span>
                  This swap drops you below a floor constraint on your active
                  preset — it satisfices worse even if the score looks fine.
                </span>
              </div>
            ) : null}
          </div>

          {/* Parsed item tooltip */}
          <ItemTooltip item={result.parsed} highlight="added" />
        </div>
      ) : null}
    </div>
  );
}
