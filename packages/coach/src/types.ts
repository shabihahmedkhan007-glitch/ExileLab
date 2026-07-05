// @exilelab/coach — public types for the Build Coach, ExileLab's single
// LLM-narration persona (GLOSSARY: "Build Coach").
//
// The Coach is explanation-ONLY: it renders the deterministic layer's structured
// findings into two sentences of coach-voice prose. It NEVER produces a number,
// item name, or node name that is not present in the structured findings it
// narrates (the trust contract; UX_PRESENTATION §7). That invariant is enforced
// by CODE (the guardrail, guardrail.ts), not by prompting alone.
//
// A `NarrationInput` is a structured, SOURCE-TYPED payload built from a
// deterministic result (a Doctor Report or a Tune ranking). It carries every
// value the narration is allowed to reference — the guardrail derives its
// allowlist from exactly this object, so a narration can never out-run its input.

/** One piece of deterministic evidence behind a finding (mirrors a rulebook Finding's evidence). */
export interface NarrationEvidence {
  /** The engine metric this evidence measures (e.g. "chaosResist", "totalEHP"). */
  metric: string;
  /** The exact engine-computed value. Narration may reference this number. */
  value: number;
  /** The goal/tier threshold it was compared against, when the check has one. */
  threshold?: number;
}

/** A single Doctor finding, flattened for narration (source: @exilelab/rulebook Finding). */
export interface NarrationFinding {
  /** Diagnosis id (e.g. "DOC-2"). */
  id: string;
  /** Severity chip: 'pass' | 'minor' | 'major' | 'critical'. */
  severity: string;
  /** The coach-not-judge statement the deterministic layer already produced. */
  statement: string;
  /** Exact numbers behind the finding — the only numbers narration may cite. */
  evidence: NarrationEvidence[];
  /** Plain-language fix summaries (each may name items/nodes the narration may cite). */
  fixSummaries: string[];
}

/** Per-axis contribution of a tune candidate (source: preference-engine AxisDelta). */
export interface NarrationCandidateAxis {
  /** Preference Axis name (e.g. "Movement Speed"). */
  axis: string;
  /** Weighted-score contribution of this axis to the candidate's delta. */
  delta: number;
}

/** A single tune candidate, flattened for narration (source: a Tune Recommendation). */
export interface NarrationCandidate {
  /** Human description of the change ("Swap boots: +35% ms"). */
  description: string;
  /** The candidate's Weighted Score delta (the ranking key). */
  weightedScoreDelta: number;
  /** Per-axis decomposition of the delta. */
  perAxis: NarrationCandidateAxis[];
}

/** Narration built from a goal-aware Doctor Report (UX §4.3 footer callout). */
export interface DoctorNarrationInput {
  kind: 'doctor';
  /** The active Goal Preset id the report was graded against. */
  goalPresetId: string;
  /** Top severity-sorted findings, each carrying its exact evidence. */
  findings: NarrationFinding[];
  /** Detected Archetype (Context Detector) — narration may name it. */
  archetype?: string;
  /** The Context Detector's human-readable rationale. */
  rationale?: string;
}

/** Narration built from a Tune ranking (UX §4.2 recommended-changes callout). */
export interface TuneNarrationInput {
  kind: 'tune';
  /** The active Goal Preset id the ranking used (or 'custom'). */
  goalPresetId: string;
  /** Top-N ranked candidate changes, each with its per-axis decomposition. */
  candidates: NarrationCandidate[];
  archetype?: string;
  rationale?: string;
}

/**
 * The structured, source-typed payload the Coach narrates. Discriminated on
 * `kind` so the prompt builder and the API integration stay type-safe.
 */
export type NarrationInput = DoctorNarrationInput | TuneNarrationInput;

/** The Coach's returned narration (only ever produced post-guardrail, post-cache). */
export interface NarrationResult {
  /** The two-to-three sentence coach-voice summary (guardrail-verified). */
  text: string;
  /** The provider model that produced it (part of the cache/input hash). */
  model: string;
  /** ISO timestamp the narration was produced/cached at. */
  cachedAt: string;
  /** sha256(stableStringify(input) + model) — the cache key and provenance stamp. */
  inputHash: string;
}

/**
 * The provider-agnostic prompt the Coach hands to a NarrationProvider. `system`
 * encodes the coach persona + the hard "only values in the input" instruction;
 * `user` is the NarrationInput serialized as JSON. `jsonSchema` is the strict
 * JSON Schema the provider must constrain its response to (response_format).
 */
export interface StructuredPrompt {
  system: string;
  user: string;
  model: string;
  /** Strict JSON Schema envelope for the provider's structured output. */
  jsonSchema: Record<string, unknown>;
}

/**
 * The provider seam. `narrate` returns the provider's PARSED response as
 * `unknown` — the Coach zod-validates it (strict schema) before trusting it, so
 * an invalid response is treated as a provider failure (kill-switch).
 */
export interface NarrationProvider {
  narrate(prompt: StructuredPrompt): Promise<unknown>;
}
