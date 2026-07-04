// Source-attribution chip. Attribution is a FEATURE, not fine print
// (UX §3, compliance charter §7.5). Always renders — the API guarantees a
// non-empty attribution string on every build. When a reference exists it reads
// "via <source> ↗"; the ↗ signals the original guide, never a data fetch we make.

import type { ProvenanceView } from "@/lib/types";

export function SourceChip({
  provenance,
  attribution,
}: {
  provenance: ProvenanceView;
  attribution: string;
}) {
  const label = `via ${provenance.source}`;
  return (
    <span
      className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs text-muted"
      title={attribution}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="text-faint"
      >
        <path
          d="M4 7a3 3 0 0 1 3-3h4M20 13v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4M14 4h6v6M20 4l-9 9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="truncate text-ink/80">{label}</span>
      {provenance.reference ? (
        <span className="text-faint">·</span>
      ) : null}
      {provenance.reference ? (
        <span className="truncate text-faint">{provenance.reference}</span>
      ) : null}
      <span className="text-accent-strong/70 transition-transform duration-150 group-hover:translate-x-0.5">
        ↗
      </span>
    </span>
  );
}
