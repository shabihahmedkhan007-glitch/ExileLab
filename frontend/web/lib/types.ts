// Response shapes mirrored from the ExileLab API service layer
// (backend/api/src/services.ts) and the packages it composes. Kept structurally
// identical so the typed client is a faithful contract. No behavior here.

// --- Preference Axes (GLOSSARY — canonical names, do not rename) -------------

export const PREFERENCE_AXES = [
  "Damage",
  "Survivability",
  "Movement Speed",
  "Attack Speed",
  "Cast Speed",
  "Skill Mobility Efficiency",
  "Resource Sustain",
  "Currency Efficiency",
] as const;

export type PreferenceAxis = (typeof PREFERENCE_AXES)[number];
export type AxisWeights = Record<PreferenceAxis, number>;

// --- Build Coach narration (GLOSSARY "Build Coach"; UX §7 trust rules) -------
// Mirrored EXACTLY from the API's NarrationResult (packages/coach/src/types.ts,
// surfaced by backend/api/src/services.ts). The ONLY generated text the UI ever
// renders, and only ever inside <AICallout>. Present on a response ONLY when the
// Coach returned non-null — absent on every degradation (kill-switch, UX §7.4).

export interface NarrationResult {
  /** The two-to-three sentence coach-voice summary (guardrail-verified). */
  text: string;
  /** The provider model that produced it (part of the cache/input hash). */
  model: string;
  /** ISO timestamp the narration was produced/cached at. */
  cachedAt: string;
  /** sha256(stableStringify(input) + model) — cache key and provenance stamp. */
  inputHash: string;
}

// --- Import / snapshot summary ----------------------------------------------

export interface SnapshotSummary {
  buildId: string;
  class: string;
  ascendancy: string | null;
  level: number;
  mainSkill: string | null;
  gamePatch: string;
  formatVersion: string;
  loadoutCount: number;
  primaryLoadoutId: string | null;
  allocatedNodeCount: number;
  itemCount: number;
}

export interface ProvenanceView {
  source: string;
  reference: string | null;
  importedAt: string;
  attribution: string | null;
  rawImportArtifactId: string | null;
}

export interface AssumptionView {
  path: string;
  origin: "imported" | "inferred" | "defaulted";
  note?: string;
}

export type AxisEmphasis = "high" | "medium" | "low";

export interface ArchetypeDetection {
  archetype: string;
  tags: string[];
  suggestedPreset: string;
  rationale: string;
  axisHints: Partial<Record<PreferenceAxis, AxisEmphasis>>;
  matchedRules: string[];
}

export interface ImportResponse {
  buildId: string;
  summary: SnapshotSummary;
  provenance: ProvenanceView;
  attribution: string;
  assumptions: AssumptionView[];
  archetype: ArchetypeDetection;
}

// --- Calculation Result (engine output, keyed by snapshot × engine version) --

export interface CalculationResult {
  key: { snapshotId: string; mutationId?: string; engineVersion: string };
  metrics: Record<string, number>;
  computedAt: string;
}

export interface BuildDetailResponse {
  summary: SnapshotSummary;
  snapshot: unknown; // the full canonical BuildSnapshot (opaque to the UI)
  provenance: ProvenanceView;
  attribution: string;
  calculation: CalculationResult;
  archetype: ArchetypeDetection;
}

// --- Tune -------------------------------------------------------------------

export interface AxisContribution {
  axis: string;
  baseNormalized: number;
  candidateNormalized: number;
  weight: number;
  weightedDelta: number;
}

export interface Recommendation {
  mutationId: string;
  description: string;
  delta: number;
  baseScore: number;
  candidateScore: number;
  cost: number;
  perAxis: AxisContribution[];
}

export interface CutRecommendation {
  mutationId: string;
  description: string;
  cost: number;
  violatedFloors: Array<{ metric: string; min: number; actual: number }>;
}

export interface TuneResponse {
  buildId: string;
  applied: { presetId: string | null; kind: "preset" | "custom" };
  baseScore: number;
  engineVersion: string;
  recommendations: Recommendation[];
  belowFloor: CutRecommendation[];
  /**
   * Optional Build Coach narration of the top changes (UX §4.2 AICallout).
   * Present ONLY when the Coach returns non-null; absent on any degradation.
   */
  narration?: NarrationResult;
}

export interface PromoteResponse {
  previousBuildId: string;
  buildId: string;
  mutationId: string;
  summary: SnapshotSummary;
  provenance: ProvenanceView;
}

// --- Goal Presets -----------------------------------------------------------

export interface ScoreTarget {
  enough: number | null;
}
export interface ScoreConstraints {
  targets?: Partial<Record<PreferenceAxis, ScoreTarget>>;
  floors?: Array<{ metric: string; min: number }>;
}

export interface GoalPreset {
  id: string;
  name: string;
  description: string;
  weights: AxisWeights;
  constraints: ScoreConstraints;
}

export interface GoalsResponse {
  presets: GoalPreset[];
}

// --- Doctor Report ----------------------------------------------------------

export type Severity = "pass" | "minor" | "major" | "critical";
export type Category = "Offense" | "Defense" | "Sustain" | "QoL" | "Overall";
export type Grade = "A" | "B" | "C" | "D" | "F";

export type Goal =
  | "fast-mapping"
  | "speed-clearing"
  | "boss-farming"
  | "party-carry"
  | "tanky"
  | "hardcore-survivability"
  | "budget-farming"
  | "smooth-gameplay"
  | "maximum-dps"
  | "balanced";

export interface FixTemplate {
  id: string;
  label: string;
  hint: string;
}

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  statement: string;
  evidence: Record<string, number | string | boolean>;
  fixTemplates: FixTemplate[];
}

export interface CategoryGrades {
  Offense: Grade;
  Defense: Grade;
  Sustain: Grade;
  QoL: Grade;
}

export interface DoctorReport {
  rulebookVersion: string;
  goal: Goal;
  tier: number;
  findings: Finding[];
  grades: CategoryGrades;
  verdict: Finding;
  /**
   * Optional Build Coach narration of the report (UX §4.3 footer callout).
   * Present ONLY when the Coach returns non-null; absent on any degradation
   * (kill-switch) — the report is otherwise identical.
   */
  narration?: NarrationResult;
}
