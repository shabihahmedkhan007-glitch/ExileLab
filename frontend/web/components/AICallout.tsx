// AICallout — the ONLY container generated text may ever appear in (UX §5, §7,
// Law 3: "math wears the crown, the LLM holds the coat"). Distinct dashed accent
// border, ✨ icon, a permanent "generated" label, and a collapse control. The
// prose is typographically SECONDARY to the deterministic numbers around it
// (muted, small) so the user is never unsure which is computed and which is
// narrated (UX §7.5).
//
// Kill-switch invisibility (UX §7.4): the `narration` field is present on an API
// response ONLY when the Build Coach returned non-null. Absent (or empty text) →
// this renders `null`: no empty frame, no loading state, zero layout shift. The
// narration arrives with the same response it narrates — there is NEVER a
// separate fetch or spinner for it.

"use client";

import { useState } from "react";
import type { NarrationResult } from "@/lib/types";
import { relativeTime } from "@/lib/format";

// The exact affordance copy from UX §7.2 — surfaced on hover of the callout.
const HOVER_AFFORDANCE =
  "Narration is AI-generated from the deterministic results above. The numbers are computed, not generated.";

export function AICallout({
  narration,
  defaultOpen = true,
}: {
  narration?: NarrationResult | null;
  /** Doctor footer defaults expanded; Tune defaults collapsed (task rule 1). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Kill-switch: no narration (or empty) → render nothing (invisible degradation).
  if (!narration || narration.text.trim().length === 0) return null;

  return (
    <div
      title={HOVER_AFFORDANCE}
      className="rounded-[var(--radius-lg)] border border-dashed border-accent-dim bg-[color-mix(in_oklab,var(--color-accent)_7%,transparent)]"
    >
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
        <span className="text-faint" aria-hidden>
          {open ? "–" : "+"}
        </span>
      </button>
      {open ? (
        <div className="px-4 pb-4">
          <p className="text-sm leading-relaxed text-muted">{narration.text}</p>
          {/* Provenance stamp — faint, secondary; reinforces "not computed". */}
          <p className="mt-2 text-[11px] text-faint">
            AI-generated from the deterministic results above · {narration.model}{" "}
            · {relativeTime(narration.cachedAt)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
