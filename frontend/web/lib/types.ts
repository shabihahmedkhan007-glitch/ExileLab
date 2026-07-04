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
}
