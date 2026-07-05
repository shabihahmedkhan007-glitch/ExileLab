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
  /** Synthetic Divine cost (PriceProvider seam); absent when unpriced/kill-switched. */
  cost?: number;
  perAxis: AxisContribution[];
}

export interface CutRecommendation {
  mutationId: string;
  description: string;
  cost?: number;
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
  /** Present when any recommendation carries a synthetic price (honest labeling). */
  priceProvenance?: "synthetic-mock";
  priceDisclaimer?: string;
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

// --- Frozen shared reports (/r/{id}) ----------------------------------------
// Contract: POST /reports { buildId, kind, payload } -> { reportId }; then
// GET /reports/:id -> an IMMUTABLE, statically-renderable snapshot of one
// result (UX §3 permalink reports, §2.1 "permalink reports" acquisition loop).
// The frozen `payload` carries exactly what the read-only page needs to render
// without any workspace state — every number in it is already engine-computed
// and preference-scored at freeze time; the report page invents nothing.

export type ReportKind = "overview" | "doctor" | "tune" | "compare";

/** One headline stat on a frozen Overview report (pre-formatted, PoE dialect). */
export interface ReportHeadlineStat {
  label: string;
  /** Pre-formatted display string (e.g. "1.9M", "42,000", "118%"). */
  value: string;
  /** CSS var for the PoE stat color, e.g. "var(--color-fire)". */
  valueColor?: string;
  /** Pre-formatted signed delta, e.g. "+1,240" / "-34%". */
  delta?: string;
  /** Small trailing context, e.g. "68th pct". */
  note?: string;
}

export interface OverviewReportPayload {
  /** Frozen Weighted Score under the active preset's weights (0-100). */
  score: number;
  presetId: string | null;
  presetName: string | null;
  archetype: string | null;
  /** Radar delivers-polygon, per axis in [0,1]. */
  delivers: Record<PreferenceAxis, number>;
  /** Radar wants-polygon (normalized weights), per axis in [0,1]. */
  wants: Record<PreferenceAxis, number>;
  headlineStats: ReportHeadlineStat[];
  /** The top severity-sorted findings shown on the verdict screen. */
  topFindings: Finding[];
}

export interface DoctorReportPayload {
  goal: Goal;
  tier: number;
  grades: CategoryGrades;
  findings: Finding[];
  verdict?: Finding;
  narration?: NarrationResult;
}

/** One frozen ranked change on a Tune report (a static ScoreBar). */
export interface TuneRankedBar {
  mutationId: string;
  description: string;
  /** Frozen Weighted Score delta — the ranking key (never raw DPS). */
  delta: number;
  cost: number;
  perAxis?: AxisContribution[];
}

export interface TuneReportPayload {
  presetId: string | null;
  presetName: string | null;
  baseScore: number;
  /** baseScore + best delta, when the freezer recorded it. */
  targetScore: number | null;
  recommendations: TuneRankedBar[];
  narration?: NarrationResult;
}

export interface CompareReportPayload {
  presetId: string;
  presetName: string | null;
  /**
   * The pivot's thesis row — the public build re-scored under the USER'S
   * weights next to the user's own score.
   */
  scoreRow: { userScore: number; otherScoreUnderUserWeights: number };
  /** The compared public build's attribution (rendered as a SourceChip). */
  other: { source: string; reference: string | null; attribution: string };
  /** Passive-tree node overlap counts (UX §4.4 tree diff summary). */
  nodes: { onlyInUser: number; onlyInOther: number; shared: number };
  /** "Steal one thing" candidates, each a Weighted Score delta with a source. */
  candidates: Array<{
    mutationId: string;
    description: string;
    delta: number;
    source: string;
  }>;
}

interface ReportEnvelope {
  reportId: string;
  /** ISO timestamp the snapshot was frozen at (immutable thereafter). */
  frozenAt: string;
  buildSummary: SnapshotSummary;
  /** Mandatory attribution, rendered in the report footer (charter §7.5). */
  attribution: string;
  provenance?: ProvenanceView;
}

/** Discriminated on `kind` so the /r page narrows the payload exhaustively. */
export type ReportResponse =
  | (ReportEnvelope & { kind: "overview"; payload: OverviewReportPayload })
  | (ReportEnvelope & { kind: "doctor"; payload: DoctorReportPayload })
  | (ReportEnvelope & { kind: "tune"; payload: TuneReportPayload })
  | (ReportEnvelope & { kind: "compare"; payload: CompareReportPayload });

export interface CreateReportResponse {
  reportId: string;
}

// --- Compare (UX §4.4) ------------------------------------------------------
// Mirrors backend/api/src/services.ts CompareResponse. Public builds are
// re-scored under the USER'S weights (the pivot's thesis row): the "best" build
// on paper may score below yours for what you want.

/** One gear slot's diff, changed modifier lines highlighted (PoB green/red). */
export interface CompareGearRow {
  slot: string;
  status: "added" | "removed" | "changed" | "unchanged";
  addedModLines: string[];
  removedModLines: string[];
}

/** One "steal one thing" candidate adopted FROM the other build. */
export interface CompareCandidate {
  mutationId: string;
  description: string;
  /** Weighted Score delta under the USER'S weights — the ranking key (0-100). */
  delta: number;
  perAxis: AxisContribution[];
  /** Attribution of the source build this change came from (charter §7.5). */
  source: string;
}

export interface CompareScoreRow {
  userScore: number;
  otherScoreUnderUserWeights: number;
  presetId: string;
}

export interface CompareResponse {
  user: SnapshotSummary;
  other: SnapshotSummary & { provenance: ProvenanceView };
  diff: {
    nodes: { onlyInUser: number[]; onlyInOther: number[]; shared: number[] };
    gear: CompareGearRow[];
    skills: Array<{ setupId: string; status: string }>;
    config: Array<{
      key: string;
      status: string;
      user: unknown;
      other: unknown;
    }>;
  };
  candidates: CompareCandidate[];
  scoreRow: CompareScoreRow;
}

export interface CompareImportResponse {
  otherBuildId: string;
}

// --- Upgrades (UX §4.5) -----------------------------------------------------
// Ranked by scorePerDivine DESC; over-budget candidates excluded server-side.
// Prices are ALWAYS synthetic-mock until the compliance-reviewed price layer
// ships (charter §7.5) — the disclaimer travels with every response.

export type PriceProvenance = "synthetic-mock";

export interface UpgradeCandidate {
  mutationId: string;
  description: string;
  delta: number;
  perAxis: AxisContribution[];
  costDivines: number;
  /** Δweighted-score per Divine — the bar length and ranking key (UX §4.5). */
  scorePerDivine: number;
  priceProvenance: PriceProvenance;
}

export interface UpgradesResponse {
  buildId: string;
  budgetDivines: number;
  candidates: UpgradeCandidate[];
  /** Honest-labeling disclaimer, rendered visibly until the real layer ships. */
  priceDisclaimer: string;
}

export interface UpgradesRequest {
  budgetDivines: number;
  presetId?: string;
  weights?: Partial<AxisWeights>;
}

// --- Item swap (OPT-3) ------------------------------------------------------

export interface ParsedItem {
  name: string;
  rarity: string;
  slot: string;
  modifiers: string[];
}

export interface ItemSwapResponse {
  parsed: ParsedItem;
  delta: number;
  perAxis: AxisContribution[];
  /** True when the swap violates a Pro-mode floor constraint (a warning). */
  belowFloor: boolean;
  description: string;
}

// --- Wasted-stat finder (OPT-1) ---------------------------------------------

export type WastedKind =
  | "overcapped-resist"
  | "dead-config"
  | "unused-support";

export interface WastedFinding {
  id: string;
  kind: WastedKind;
  statement: string;
  evidence: Record<string, number | string | boolean>;
  /** Base severity scaled by the active preset's weight on the axis it touches. */
  axisWeightedSeverity: number;
}

export interface WastedResponse {
  findings: WastedFinding[];
  presetId: string;
}
