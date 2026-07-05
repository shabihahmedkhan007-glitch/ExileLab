// Translate deterministic results into Build Coach NarrationInputs.
//
// The Coach narrates a SOURCE-TYPED payload assembled from the very findings the
// API serves — so the guardrail's allowlist is derived from exactly the numbers
// and names the response already contains. Narration can never out-run what the
// deterministic layer computed.

import type {
  DoctorNarrationInput,
  NarrationEvidence,
  NarrationFinding,
  TuneNarrationInput,
} from "@exilelab/coach";
import type { DoctorReport } from "@exilelab/rulebook";
import type { ArchetypeDetection } from "@exilelab/context-detector";
import type { Recommendation } from "./services.js";

/** Only the numeric evidence entries become citable NarrationEvidence. */
function toEvidence(evidence: Record<string, number | string | boolean>): NarrationEvidence[] {
  const out: NarrationEvidence[] = [];
  for (const [metric, value] of Object.entries(evidence)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out.push({ metric, value });
    }
  }
  return out;
}

/**
 * Build a doctor NarrationInput from a Doctor Report. Narrates the highest-leverage
 * findings (the UX §4.3 top set: non-pass findings, capped), each carrying its
 * exact evidence, fix wording, and the detected archetype context.
 */
export function doctorNarrationInput(
  report: DoctorReport,
  goalPresetId: string,
  archetype: ArchetypeDetection,
): DoctorNarrationInput {
  const findings: NarrationFinding[] = report.findings
    .filter((f) => f.severity !== "pass")
    .slice(0, 3)
    .map((f) => ({
      id: f.id,
      severity: f.severity,
      statement: f.statement,
      evidence: toEvidence(f.evidence),
      fixSummaries: f.fixTemplates.flatMap((t) => [t.label, t.hint]),
    }));

  return {
    kind: "doctor",
    goalPresetId,
    findings,
    archetype: archetype.archetype,
    rationale: archetype.rationale,
  };
}

/** Build a tune NarrationInput from the top-3 ranked recommendations. */
export function tuneNarrationInput(
  recommendations: Recommendation[],
  goalPresetId: string,
  archetype: ArchetypeDetection,
): TuneNarrationInput {
  return {
    kind: "tune",
    goalPresetId,
    candidates: recommendations.slice(0, 3).map((r) => ({
      description: r.description,
      weightedScoreDelta: r.delta,
      perAxis: r.perAxis.map((a) => ({ axis: a.axis, delta: a.weightedDelta })),
    })),
    archetype: archetype.archetype,
    rationale: archetype.rationale,
  };
}
