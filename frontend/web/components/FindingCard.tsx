// FindingCard — one Doctor diagnosis row (UX §4.3, §5 #5): severity chip, a
// coach-voice statement (leads with the gain, never shames — Law 2), the exact
// deterministic evidence inline (Law 3), and expandable fix options. Evidence
// numbers are the engine's own — rendered tabular so they read as computed.

"use client";

import { useState } from "react";
import type { Finding } from "@/lib/types";
import { integer } from "@/lib/format";
import { SeverityChip } from "./chips";

function renderEvidenceValue(v: number | string | boolean): string {
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") {
    return Math.abs(v) >= 1000 ? integer(v) : String(v);
  }
  return v;
}

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const evidence = Object.entries(finding.evidence);
  const hasFixes = finding.fixTemplates.length > 0;

  return (
    <div className="card overflow-hidden">
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="pt-0.5">
          <SeverityChip severity={finding.severity} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-ink">
            {finding.statement}
          </p>
          {evidence.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {evidence.map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-baseline gap-1.5 text-xs"
                >
                  <span className="text-faint">{k}</span>
                  <span className="tabular font-semibold text-muted">
                    {renderEvidenceValue(v)}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 self-center text-xs text-faint">
          {finding.id}
        </span>
      </button>

      {open && hasFixes ? (
        <div className="border-t border-line bg-surface-2/50 px-4 py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            Fixes
          </div>
          <div className="flex flex-col gap-2">
            {finding.fixTemplates.map((fix) => (
              <div
                key={fix.id}
                className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2"
              >
                <div className="text-sm font-medium text-ink">{fix.label}</div>
                <div className="mt-0.5 text-xs text-muted">{fix.hint}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
