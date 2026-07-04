// Doctor chrome: severity chips (✅🟡🟠🔴 of UX §4.3) and per-category letter
// grades. Color is the signal; the glyph backs it for colorblind safety.

import type { Grade, Severity } from "@/lib/types";

const SEV: Record<Severity, { color: string; glyph: string; label: string }> = {
  pass: { color: "var(--color-sev-pass)", glyph: "✓", label: "Pass" },
  minor: { color: "var(--color-sev-minor)", glyph: "!", label: "Minor" },
  major: { color: "var(--color-sev-major)", glyph: "!!", label: "Major" },
  critical: { color: "var(--color-sev-critical)", glyph: "✕", label: "Critical" },
};

export function SeverityChip({ severity }: { severity: Severity }) {
  const s = SEV[severity];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: s.color,
        background: `color-mix(in oklab, ${s.color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${s.color} 40%, transparent)`,
      }}
    >
      <span className="tabular text-[10px]">{s.glyph}</span>
      {s.label}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: SEV[severity].color }}
    />
  );
}

const GRADE_COLOR: Record<Grade, string> = {
  A: "var(--color-sev-pass)",
  B: "var(--color-sev-pass)",
  C: "var(--color-sev-minor)",
  D: "var(--color-sev-major)",
  F: "var(--color-sev-critical)",
};

export function GradeChip({
  category,
  grade,
}: {
  category: string;
  grade: Grade;
}) {
  const color = GRADE_COLOR[grade];
  return (
    <div className="flex items-center justify-between rounded-[var(--radius)] border border-line bg-surface-2 px-3 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {category}
      </span>
      <span
        className="tabular grid h-8 w-8 place-items-center rounded-md text-lg font-bold"
        style={{
          color,
          background: `color-mix(in oklab, ${color} 12%, transparent)`,
        }}
      >
        {grade}
      </span>
    </div>
  );
}
