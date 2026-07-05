// FrozenBar — a read-only ranked change on a shared report (the static twin of
// the interactive ScoreBar). Bar length = frozen Weighted Score delta (the
// ranking key — never raw DPS). No apply / export affordances: a frozen report
// is a snapshot, not a workspace. A trailing chip carries either the Divine cost
// (Tune) or the source build it was stolen from (Compare).

import { signed, costLabel } from "@/lib/format";

export function FrozenBar({
  description,
  delta,
  scale,
  cost,
  source,
}: {
  description: string;
  /** Frozen Weighted Score delta. */
  delta: number;
  /** Largest delta in the list, for proportional width. */
  scale: number;
  /** Divine cost chip (Tune). Omit for Compare. */
  cost?: number;
  /** Source-build attribution chip (Compare). Omit for Tune. */
  source?: string;
}) {
  const pct = scale > 0 ? Math.max(2, (delta / scale) * 100) : 2;
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-3">
      <div className="flex items-stretch gap-3">
        <div className="flex w-16 shrink-0 flex-col items-end justify-center">
          <span className="tabular text-xl font-bold leading-none text-gain">
            {signed(delta)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-faint">
            score
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {description}
            </span>
            {cost !== undefined ? (
              <span className="ml-auto shrink-0 rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 text-[11px] tabular text-muted">
                {costLabel(cost)}
              </span>
            ) : null}
            {source ? (
              <span className="ml-auto shrink-0 truncate rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                via {source}
              </span>
            ) : null}
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
