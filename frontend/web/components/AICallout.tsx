// AICallout — the ONLY container generated text may ever appear in (UX §5, §7,
// Law 3: "math wears the crown, the LLM holds the coat"). No LLM exists in this
// build (deterministic-systems principle), so this renders nothing by default.
// It is built now so that when the Build Coach lands, generated prose has exactly
// one distinctly-styled, labelled, collapsible home — and never leaks inline with
// engine numbers. Passing no `text` (the current, permanent-for-now state) yields
// null: no broken empty state, invisible kill-switch degradation (UX §7.4).

"use client";

import { useState } from "react";

export function AICallout({ text }: { text?: string | null }) {
  const [open, setOpen] = useState(true);
  // No generated text exists yet → render nothing (invisible degradation).
  if (!text || text.trim().length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-accent-dim bg-[color-mix(in_oklab,var(--color-accent)_7%,transparent)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-accent-strong">
          <span aria-hidden>✨</span>
          Summary
          <span className="rounded-full border border-accent-dim px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent-strong/80">
            generated
          </span>
        </span>
        <span className="text-faint">{open ? "–" : "+"}</span>
      </button>
      {open ? (
        <p
          className="px-4 pb-4 text-sm leading-relaxed text-muted"
          title="Narration is AI-generated from the deterministic results above. The numbers are computed, not generated."
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}
