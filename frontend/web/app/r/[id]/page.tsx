// /r/{id} — a read-only shared report (UX §3 permalink reports; §2.1 "a Doctor
// report pasted into a guild Discord IS the marketing"). A server component that
// fetches one frozen snapshot by id and renders it with the platform's own
// presentational components — no auth, no workspace state. The permalink itself
// is the capability. Frozen-at timestamp, mandatory source attribution, the
// ExileLab brand, and a CTA paste-box (the acquisition loop) frame the payload.

import type { Metadata } from "next";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { ReportKind, ReportResponse } from "@/lib/types";
import { PasteBox } from "@/components/PasteBox";
import { ReportBody } from "@/components/report/ReportBody";

export const metadata: Metadata = {
  title: "Shared build report — ExileLab",
  description:
    "A frozen, read-only ExileLab build report. Every number is engine-computed and preference-scored.",
};

const KIND_LABEL: Record<ReportKind, string> = {
  overview: "Build Overview",
  doctor: "Character Doctor",
  tune: "Tune result",
  compare: "Comparison",
};

/** ISO -> "2026-07-05" (deterministic; no locale drift across server render). */
function isoDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let report: ReportResponse | null = null;
  let error: string | null = null;
  try {
    report = await api.getReport(id);
  } catch (e) {
    error =
      e instanceof ApiError && e.status === 404
        ? "This report doesn't exist, or it has expired."
        : e instanceof ApiError
          ? e.message
          : "Couldn't load this report right now.";
  }

  if (!report) {
    return (
      <div className="py-20">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-serif text-2xl text-ink">Report unavailable</h1>
          <p className="mt-3 text-sm text-muted">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-[var(--radius)] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Measure your own build →
          </Link>
        </div>
      </div>
    );
  }

  const s = report.buildSummary;
  const subtitle = [
    s.ascendancy ?? s.class,
    s.mainSkill,
    `Level ${s.level}`,
    `patch ${s.gamePatch}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="py-10 md:py-14">
      {/* Report header — what this is, and the immutable freeze stamp. */}
      <header className="mb-8 flex flex-col gap-3 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-accent-dim bg-[color-mix(in_oklab,var(--color-accent)_14%,transparent)] px-3 py-1 text-xs font-medium text-accent-strong">
            {KIND_LABEL[report.kind]}
          </span>
          <span className="rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-[11px] text-faint">
            frozen · read-only
          </span>
        </div>
        <h1 className="font-serif text-3xl tracking-tight text-ink md:text-4xl">
          {s.class}
          {s.ascendancy ? ` — ${s.ascendancy}` : ""}
        </h1>
        <p className="text-sm text-muted">{subtitle}</p>
        <p className="text-xs text-faint">
          Snapshot frozen {isoDate(report.frozenAt)}. Every number here was
          engine-computed and preference-scored at freeze time — nothing on this
          page is regenerated.
        </p>
      </header>

      <ReportBody report={report} />

      {/* Attribution (charter §7.5) + brand + acquisition CTA. */}
      <footer className="mt-12 border-t border-line pt-8">
        <p className="text-xs leading-relaxed text-faint">
          {report.attribution}
        </p>
        <div className="mt-8 rounded-[var(--radius-lg)] border border-line-strong bg-surface p-6">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[13px] font-bold text-white"
            >
              E
            </span>
            <span className="font-serif text-lg tracking-tight text-ink">
              ExileLab
            </span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Want this for your own character? Paste a build and get it measured
            against <em>your</em> priorities — not a leaderboard&apos;s.
          </p>
          <div className="mt-4">
            <PasteBox />
          </div>
        </div>
      </footer>
    </div>
  );
}
