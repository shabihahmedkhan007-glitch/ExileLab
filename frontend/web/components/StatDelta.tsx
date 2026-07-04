// StatDelta — the atom of the evidence layer (UX §5 #1). A row of
// `label · value · signed colored delta`, numbers tabular + monospaced so
// columns align and read as computed truth (Law 3). Value may wear a PoE
// stat-color; a delta follows the PoB green/red convention.

import type { ReactNode } from "react";

export function StatDelta({
  label,
  value,
  valueColor,
  delta,
  deltaSign,
  note,
  emphasis = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  /** CSS color for the value (PoE stat dialect). Defaults to ink. */
  valueColor?: string;
  /** Pre-formatted signed delta text, e.g. "+1,240" / "−312". */
  delta?: string;
  /** Direction drives green/red; inferred from delta text when omitted. */
  deltaSign?: "up" | "down" | "flat";
  /** Small trailing context, e.g. "68th pct" or "vs archetype". */
  note?: ReactNode;
  emphasis?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes: Record<string, string> = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl",
  };
  const sign =
    deltaSign ??
    (delta?.startsWith("+")
      ? "up"
      : delta?.startsWith("−") || delta?.startsWith("-")
        ? "down"
        : "flat");
  const deltaColor =
    sign === "up"
      ? "text-gain"
      : sign === "down"
        ? "text-loss"
        : "text-faint";

  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={`tabular font-semibold leading-none ${sizes[emphasis]}`}
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </span>
        {delta ? (
          <span className={`tabular text-sm font-semibold ${deltaColor}`}>
            {delta}
          </span>
        ) : null}
        {note ? (
          <span className="text-xs text-faint whitespace-nowrap">{note}</span>
        ) : null}
      </span>
    </div>
  );
}
