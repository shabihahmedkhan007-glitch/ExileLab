// ReportBody — renders a frozen report's payload per kind (UX §3 /r permalink
// reports), reusing the platform's presentational components so a shared link
// reads identically to the live workspace. Every renderer is read-only: the
// numbers are frozen at snapshot time, already engine-computed and
// preference-scored. Nothing here recomputes or invents a value.

import type {
  CompareReportPayload,
  DoctorReportPayload,
  OverviewReportPayload,
  ProvenanceView,
  ReportResponse,
  TuneReportPayload,
} from "@/lib/types";
import { GOAL_LABELS } from "@/lib/format";
import { RadarChart } from "@/components/RadarChart";
import { StatDelta } from "@/components/StatDelta";
import { FindingCard } from "@/components/FindingCard";
import { AICallout } from "@/components/AICallout";
import { SourceChip } from "@/components/SourceChip";
import { GradeChip, SeverityDot } from "@/components/chips";
import { SectionLabel } from "@/components/ui";
import { FrozenBar } from "./FrozenBar";

export function ReportBody({ report }: { report: ReportResponse }) {
  switch (report.kind) {
    case "overview":
      return <OverviewReport payload={report.payload} />;
    case "doctor":
      return <DoctorReportView payload={report.payload} />;
    case "tune":
      return <TuneReportView payload={report.payload} />;
    case "compare":
      return (
        <CompareReportView
          payload={report.payload}
          frozenAt={report.frozenAt}
        />
      );
  }
}

// --- Overview: radar + headline stats (UX §4.1) ------------------------------

function OverviewReport({ payload }: { payload: OverviewReportPayload }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <div className="card flex flex-col items-center p-6">
        <div className="mb-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Weighted Score
            {payload.presetName ? ` · ${payload.presetName}` : ""}
          </div>
          <div className="tabular mt-1 text-5xl font-bold text-ink">
            {payload.score.toFixed(0)}
            <span className="text-2xl text-faint">/100</span>
          </div>
        </div>
        <RadarChart delivers={payload.delivers} wants={payload.wants} />
        <p className="mt-4 max-w-[30ch] text-center text-xs leading-relaxed text-faint">
          The gap between the polygons is what tuning can close — the build vs
          what the sliders want.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="card p-6">
          <SectionLabel>Measured</SectionLabel>
          <div className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {payload.headlineStats.map((s) => (
              <StatDelta
                key={s.label}
                label={s.label}
                value={s.value}
                valueColor={s.valueColor}
                delta={s.delta}
                note={s.note}
                emphasis="lg"
              />
            ))}
          </div>
        </div>

        {payload.topFindings.length > 0 ? (
          <div className="card p-6">
            <SectionLabel>Top findings</SectionLabel>
            <div className="mt-4 flex flex-col gap-2.5">
              {payload.topFindings.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-line bg-surface-2 px-3 py-2.5"
                >
                  <span className="pt-1">
                    <SeverityDot severity={f.severity} />
                  </span>
                  <p className="text-sm leading-relaxed text-muted">
                    {f.statement}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// --- Doctor: findings list + grades (UX §4.3) --------------------------------

function DoctorReportView({ payload }: { payload: DoctorReportPayload }) {
  const cats = ["Offense", "Defense", "Sustain", "QoL"] as const;
  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>
            Diagnosis · {GOAL_LABELS[payload.goal]} · tier {payload.tier}
          </SectionLabel>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cats.map((c) => (
            <GradeChip key={c} category={c} grade={payload.grades[c]} />
          ))}
        </div>
      </div>

      {payload.verdict ? (
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="pt-1">
              <SeverityDot severity={payload.verdict.severity} />
            </span>
            <p className="text-sm leading-relaxed text-ink">
              {payload.verdict.statement}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {payload.findings.map((f) => (
          <FindingCard key={f.id} finding={f} />
        ))}
      </div>

      <AICallout narration={payload.narration} defaultOpen />
    </div>
  );
}

// --- Tune: ranked bars (UX §4.2) ---------------------------------------------

function TuneReportView({ payload }: { payload: TuneReportPayload }) {
  const scale = Math.max(
    ...payload.recommendations.map((r) => r.delta),
    0.0001,
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <SectionLabel>
            Recommended changes
            {payload.presetName ? ` · ${payload.presetName}` : ""}
          </SectionLabel>
          <p className="mt-1 text-xs text-faint">
            Ranked by Weighted Score gain under these priorities — never raw DPS.
          </p>
        </div>
        <div className="tabular text-2xl font-bold text-ink">
          {payload.baseScore.toFixed(0)}
          {payload.targetScore !== null ? (
            <>
              <span className="mx-1 text-faint">→</span>
              <span className="text-accent-strong">
                {payload.targetScore.toFixed(0)}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {payload.recommendations.map((r) => (
          <FrozenBar
            key={r.mutationId}
            description={r.description}
            delta={r.delta}
            scale={scale}
            cost={r.cost}
          />
        ))}
      </div>

      <AICallout narration={payload.narration} defaultOpen={false} />
    </div>
  );
}

// --- Compare: diff summary (UX §4.4) -----------------------------------------

function CompareReportView({
  payload,
  frozenAt,
}: {
  payload: CompareReportPayload;
  frozenAt: string;
}) {
  const scale = Math.max(...payload.candidates.map((c) => c.delta), 0.0001);
  const otherProvenance: ProvenanceView = {
    source: payload.other.source,
    reference: payload.other.reference,
    importedAt: frozenAt,
    attribution: payload.other.attribution,
    rawImportArtifactId: null,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* The thesis row: the public build re-scored under YOUR weights. */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>
            Weighted Score under your priorities
            {payload.presetName ? ` · ${payload.presetName}` : ""}
          </SectionLabel>
          <SourceChip
            provenance={otherProvenance}
            attribution={payload.other.attribution}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-4">
            <div className="text-xs text-muted">Your build</div>
            <div className="tabular mt-1 text-4xl font-bold text-ink">
              {payload.scoreRow.userScore.toFixed(0)}
              <span className="text-xl text-faint">/100</span>
            </div>
          </div>
          <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-4">
            <div className="text-xs text-muted">
              {payload.other.source} build, your weights
            </div>
            <div className="tabular mt-1 text-4xl font-bold text-ink">
              {payload.scoreRow.otherScoreUnderUserWeights.toFixed(0)}
              <span className="text-xl text-faint">/100</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          The &ldquo;best&rdquo; public build can score below yours for what{" "}
          <em>you</em> want — that&apos;s the whole point.
        </p>
      </div>

      {/* Tree node overlap. */}
      <div className="card p-6">
        <SectionLabel>Passive tree overlap</SectionLabel>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <NodeStat
            label="Only yours"
            value={payload.nodes.onlyInUser}
            color="var(--color-cold)"
          />
          <NodeStat
            label="Shared"
            value={payload.nodes.shared}
            color="var(--color-faint)"
          />
          <NodeStat
            label={`Only ${payload.other.source}`}
            value={payload.nodes.onlyInOther}
            color="var(--color-gain)"
          />
        </div>
      </div>

      {/* Steal-one-thing candidates. */}
      {payload.candidates.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Changes worth stealing</SectionLabel>
          {payload.candidates.map((c) => (
            <FrozenBar
              key={c.mutationId}
              description={c.description}
              delta={c.delta}
              scale={scale}
              source={c.source}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NodeStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-4 text-center">
      <div
        className="tabular text-3xl font-bold"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-muted">{label}</div>
    </div>
  );
}
