// ContextBadge — Law 2 made visible. The product proves it understood the build
// (its Archetype) BEFORE it dares to advise. Renders the detected archetype with
// the mechanic rationale on hover ("attack speed detected as mobility"), the
// suggested Goal Preset, and a "wrong?" correction affordance. Coach tone, never
// judgment.

"use client";

import { useState } from "react";
import type { ArchetypeDetection } from "@/lib/types";

export function ContextBadge({
  archetype,
}: {
  archetype: ArchetypeDetection;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center gap-2 rounded-full border border-accent-dim bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] px-3 py-1 text-xs font-medium text-accent-strong"
      >
        <span aria-hidden>⚡</span>
        <span className="text-faint">archetype:</span>
        <span className="text-accent-strong">{archetype.archetype}</span>
        <span className="text-accent-strong/60">ⓘ</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-[var(--radius)] border border-line-strong bg-elevated p-3 shadow-xl">
          <p className="text-xs leading-relaxed text-muted">
            {archetype.rationale}
          </p>
          {archetype.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {archetype.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-faint"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11px]">
            <span className="text-faint">
              suggests{" "}
              <span className="text-muted">{archetype.suggestedPreset}</span>
            </span>
            <span className="text-accent-strong/70">wrong? pick archetype</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
