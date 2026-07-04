// The build workspace header (UX §4.1 top zone): class / level / ascendancy,
// the archetype context badge (rendered before any judgment — Law 2), the
// persistent source-attribution chip (a feature, not fine print — UX §3), patch,
// and import time.

import Link from "next/link";
import type {
  ArchetypeDetection,
  ProvenanceView,
  SnapshotSummary,
} from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { SourceChip } from "@/components/SourceChip";
import { ContextBadge } from "./ContextBadge";

export function BuildHeader({
  summary,
  provenance,
  attribution,
  archetype,
}: {
  summary: SnapshotSummary;
  provenance: ProvenanceView;
  attribution: string;
  archetype: ArchetypeDetection;
}) {
  return (
    <div className="flex flex-col gap-3 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md border border-line-strong bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular text-muted">
          Lvl {summary.level}
        </span>
        <h1 className="font-serif text-2xl tracking-tight text-ink">
          {summary.ascendancy ?? summary.class}
        </h1>
        <span className="text-sm text-muted">{summary.class}</span>
        <ContextBadge archetype={archetype} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-faint">
        <SourceChip provenance={provenance} attribution={attribution} />
        <span>patch {summary.gamePatch}</span>
        <span className="text-line-strong">·</span>
        <span>imported {relativeTime(provenance.importedAt)}</span>
        {summary.mainSkill ? (
          <>
            <span className="text-line-strong">·</span>
            <span>
              main skill{" "}
              <span className="text-muted">{summary.mainSkill}</span>
            </span>
          </>
        ) : null}
        <Link
          href="/"
          className="ml-auto rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent-dim hover:text-ink"
        >
          Re-import
        </Link>
      </div>
    </div>
  );
}
