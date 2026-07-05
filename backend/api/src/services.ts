// The service layer — the one-way pipeline (RFC-0001 §5.2) wired end to end:
//
//   importer -> Raw Import Artifact -> normalizer -> BuildSnapshot (stored)
//        -> Calculation Result (MockEngine) | BuildMutation (candidates)
//        -> Preference Engine scores | Doctor Report | promotion to a new snapshot
//
// Every stage is immutable and references its upstream by identity. No stage
// after the importer touches an external platform (charter §7.5). The HTTP layer
// (app.ts) is a thin shell over these methods; they are independently testable.

import { detectSource, normalize } from "@exilelab/build-normalizer";
import { createBuildMutation, promoteMutation } from "@exilelab/core";
import type {
  BuildMutation,
  BuildSnapshot as CoreSnapshot,
  CalculationResult,
} from "@exilelab/core";
import { detectArchetype } from "@exilelab/context-detector";
import type { ArchetypeDetection } from "@exilelab/context-detector";
import { diffSnapshots } from "@exilelab/comparator";
import type { Candidate as DiffCandidate } from "@exilelab/comparator";
import {
  DEFAULT_PRESET_ID,
  getPreset,
  normalizeWeights,
  PREFERENCE_AXES,
  PRESET_LIST,
  scoreBuild,
  scoreCandidate,
} from "@exilelab/preference-engine";
import type {
  AxisWeights,
  ScoreConstraints,
} from "@exilelab/preference-engine";
import { randomUUID } from "node:crypto";
import { runDoctor } from "@exilelab/rulebook";
import type { DoctorReport, Goal } from "@exilelab/rulebook";
import { createBuildCoach } from "@exilelab/coach";
import type { BuildCoach, NarrationResult } from "@exilelab/coach";
import { doctorNarrationInput, tuneNarrationInput } from "./coach-input.js";

// The calculation engine lives in EXACTLY ONE place: @exilelab/engine-adapter.
// Swapping the deterministic MockEngine for the real PoB2 LuaJIT sidecar happens
// there and only there (ADR-001) — behind the same EngineAdapter seam this service
// depends on. The backend never re-implements engine math; it consumes the
// adapter's Calculation Results and translates them (engine/outputs.ts) into the
// Preference-Engine and Doctor slices its downstream consumers want.
import {
  MockEngine,
  withCache,
  InMemoryCalculationResultStore,
  serializeResultKey,
} from "@exilelab/engine-adapter";
import type { EngineAdapter } from "@exilelab/engine-adapter";
import { toMeasurement, toStoredResult } from "./engine/outputs.js";
import type { Measurement } from "./engine/outputs.js";
import { generateCandidates } from "./optimizer/candidates.js";
import { generateUpgradeCandidates } from "./optimizer/upgrade-candidates.js";
import { parseItemText, ItemParseError } from "./items/parse-item.js";
import {
  MockPriceProvider,
  SYNTHETIC_PRICE_DISCLAIMER,
  SYNTHETIC_PRICE_PROVENANCE,
} from "./prices/index.js";
import type { PriceProvider } from "./prices/index.js";
import type {
  Repositories,
  ReportKind,
  StoredReport,
  SavedBuild,
} from "./store/repositories.js";
import { createInMemoryRepositories } from "./store/repositories.js";

// --- Errors ----------------------------------------------------------------

/** Carries an HTTP status so the Fastify error handler can map it 1:1. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// --- Response shapes (exported for the frontend / typed clients) ------------

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

export interface ImportResponse {
  buildId: string;
  summary: SnapshotSummary;
  provenance: ProvenanceView;
  /** ALWAYS present — compliance charter §7.5 requires attribution on every build. */
  attribution: string;
  assumptions: AssumptionView[];
  archetype: ArchetypeDetection;
}

export interface BuildDetailResponse {
  summary: SnapshotSummary;
  snapshot: CoreSnapshot;
  provenance: ProvenanceView;
  attribution: string;
  calculation: CalculationResult;
  archetype: ArchetypeDetection;
}

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
  /** Weighted Score delta (the ranking key) — the ScoreBar length (UX §4.2). */
  delta: number;
  baseScore: number;
  candidateScore: number;
  /** Synthetic Divine cost via the PriceProvider seam (UX cost chip); ABSENT when unpriced/kill-switched. */
  cost?: number;
  perAxis: AxisContribution[];
}

export interface CutRecommendation {
  mutationId: string;
  description: string;
  cost?: number;
  /** Which floor(s) the candidate violated (the "won't suggest" reason). */
  violatedFloors: Array<{ metric: string; min: number; actual: number }>;
}

export interface TuneResponse {
  buildId: string;
  applied: { presetId: string | null; kind: "preset" | "custom" };
  baseScore: number;
  engineVersion: string;
  recommendations: Recommendation[];
  /** Below-floor candidates, excluded from ranking (UX §4.2 cut line). */
  belowFloor: CutRecommendation[];
  /**
   * Optional Build Coach narration of the top changes (UX §4.2 AICallout). Present
   * ONLY when the Coach returns non-null; absent on any degradation (kill-switch).
   */
  narration?: NarrationResult;
  /** Present when any recommendation carries a synthetic price (charter §7.5 honesty). */
  priceProvenance?: typeof SYNTHETIC_PRICE_PROVENANCE;
  priceDisclaimer?: string;
}

/**
 * A Doctor Report plus the optional Build Coach narration (UX §4.3 footer callout).
 * The `narration` key is present ONLY when the Coach returns non-null — silent
 * degradation drops the field entirely, leaving the report otherwise identical.
 */
export type DoctorResponse = DoctorReport & { narration?: NarrationResult };

export interface PromoteResponse {
  previousBuildId: string;
  buildId: string;
  mutationId: string;
  summary: SnapshotSummary;
  provenance: ProvenanceView;
}

export interface TuneRequest {
  presetId?: string;
  weights?: Partial<AxisWeights>;
  constraints?: ScoreConstraints;
}

// --- Compare (UX §4.4) -----------------------------------------------------

/** One gear slot's diff, with the changed modifier lines highlighted (UX §4.4). */
export interface CompareGearRow {
  slot: string;
  status: "added" | "removed" | "changed" | "unchanged";
  addedModLines: string[];
  removedModLines: string[];
}

/** One candidate change adopted FROM the other build (the "try this" flow). */
export interface CompareCandidate {
  mutationId: string;
  description: string;
  /** Weighted Score delta under the USER'S weights (the ranking key). */
  delta: number;
  perAxis: AxisContribution[];
  /** Attribution of the source build this change came from (charter §7.5). */
  source: string;
}

/**
 * The pivot's thesis row: the user's build vs a public build, both scored under
 * the USER'S weights (UX §4.4 — "the 'best' build on poe.ninja might score below
 * yours for what you want").
 */
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
    config: Array<{ key: string; status: string; user: unknown; other: unknown }>;
  };
  candidates: CompareCandidate[];
  scoreRow: CompareScoreRow;
}

// --- Upgrades (UX §4.5) ----------------------------------------------------

export interface UpgradeCandidate {
  mutationId: string;
  description: string;
  delta: number;
  perAxis: AxisContribution[];
  costDivines: number;
  /** Δweighted-score per Divine (the bar length, UX §4.5) — the ranking key. */
  scorePerDivine: number;
  /** ALWAYS 'synthetic-mock' today — prices are never live market data (charter §7.5). */
  priceProvenance: typeof SYNTHETIC_PRICE_PROVENANCE;
}

export interface UpgradesResponse {
  buildId: string;
  budgetDivines: number;
  candidates: UpgradeCandidate[];
  /** Synthetic-price disclaimer, shown until the real price layer ships. */
  priceDisclaimer: string;
}

export interface UpgradesRequest {
  budgetDivines: number;
  presetId?: string;
  weights?: Partial<AxisWeights>;
}

// --- Item swap (UX §4.4) ---------------------------------------------------

export interface ItemSwapResponse {
  parsed: { name: string; rarity: string; slot: string; modifiers: string[] };
  delta: number;
  perAxis: AxisContribution[];
  belowFloor: boolean;
  description: string;
}

// --- Wasted-stat finder ----------------------------------------------------

export type WastedKind = "overcapped-resist" | "dead-config" | "unused-support";

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

// --- Reports / users -------------------------------------------------------

export interface ReportResponse {
  kind: ReportKind;
  frozenAt: string;
  buildSummary: unknown;
  attribution: string;
  payload: unknown;
}

// --- The service -----------------------------------------------------------

const VALID_GOALS: ReadonlySet<Goal> = new Set<Goal>([
  "fast-mapping",
  "speed-clearing",
  "boss-farming",
  "party-carry",
  "tanky",
  "hardcore-survivability",
  "budget-farming",
  "smooth-gameplay",
  "maximum-dps",
  "balanced",
]);

const VALID_REPORT_KINDS: ReadonlySet<ReportKind> = new Set<ReportKind>([
  "overview",
  "doctor",
  "tune",
  "compare",
]);

/** v0 severity knobs for the wasted-stat finder (documented, deterministic). */
const WASTED = {
  /** Resistance overcap (in points) that saturates base severity to 1.0. */
  overcapScale: 30,
  /** Fixed base severity for a dead-config finding (touches no preference axis). */
  deadConfigSeverity: 0.4,
  /** Support-gem count that saturates unused-support base severity to 1.0. */
  unusedSupportScale: 4,
} as const;

/** Clamp a number to [0, 1]. */
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export class ExileLabService {
  private readonly measurements = new Map<string, Measurement>();

  constructor(
    private readonly repos: Repositories = createInMemoryRepositories(),
    // The engine seam: the package MockEngine wrapped in the package's caching
    // adapter over an in-memory Result store (RFC-0001 AD-2/AD-7). Real sidecar
    // swaps in HERE-EQUIVALENT wiring inside the engine-adapter package (ADR-001).
    private readonly engine: EngineAdapter = withCache(
      new MockEngine(),
      new InMemoryCalculationResultStore(),
    ),
    // The Build Coach seam (LLM narration). Defaults to a DISABLED coach: no
    // provider, no network, narration omitted everywhere. buildApp injects an
    // env-configured coach in production and a MockNarrationProvider-backed coach
    // in tests. A disabled coach makes ZERO provider calls (charter/kill-switch).
    private readonly coach: BuildCoach = createBuildCoach({ enabled: false }),
    // The price-layer seam (UX §4.5). Defaults to the deterministic synthetic mock;
    // `null` means the price layer is switched off (kill-switch) — the Upgrades
    // route then returns a typed 503 rather than fabricating a price. buildApp
    // injects `priceProviderFromEnv()`. NO price provider ever makes an external
    // call today (charter §7.5).
    private readonly priceProvider: PriceProvider | null = new MockPriceProvider(),
  ) {}

  // -- Import ---------------------------------------------------------------

  /** POST /import: detect → import → normalize → store a canonical snapshot. */
  async importBuild(input: string): Promise<ImportResponse> {
    if (typeof input !== "string" || input.trim().length === 0) {
      throw new HttpError(400, "input must be a non-empty string");
    }
    const importer = detectSource(input);
    if (importer === null) {
      throw new HttpError(
        422,
        "no importer recognised this input (paste a PoB code or ExileLab JSON)",
      );
    }
    let core: CoreSnapshot;
    try {
      const raw = importer.import(input);
      // The normalizer now emits core's canonical BuildSnapshot directly — no
      // bridging adapter. Identity is core's Canonical Identity (RFC-0001 I2),
      // so re-importing the same build is idempotent on buildId.
      core = normalize(raw);
    } catch (err) {
      throw new HttpError(422, `import failed: ${(err as Error).message}`);
    }
    const buildId = await this.repos.builds.save(core);
    await this.measureAndStore(core); // base Calculation Result

    return {
      buildId,
      summary: this.summarize(core),
      provenance: this.provenanceView(core),
      attribution: this.attribution(core),
      assumptions: this.assumptionViews(core),
      archetype: this.archetype(core),
    };
  }

  // -- Read -----------------------------------------------------------------

  /** GET /builds/:id: snapshot + latest Calculation Result + archetype. */
  async getBuild(buildId: string): Promise<BuildDetailResponse> {
    const core = await this.requireBuild(buildId);
    let calculation = await this.repos.calculations.latestForBuild(buildId);
    if (calculation === undefined) {
      calculation = (await this.measureAndStore(core)).result;
    }
    return {
      summary: this.summarize(core),
      snapshot: core,
      provenance: this.provenanceView(core),
      attribution: this.attribution(core),
      calculation,
      archetype: this.archetype(core),
    };
  }

  // -- Tune -----------------------------------------------------------------

  /** POST /builds/:id/tune: score candidate mutations under the player's goal. */
  async tuneBuild(buildId: string, request: TuneRequest): Promise<TuneResponse> {
    const base = await this.requireBuild(buildId);
    const { weights, constraints, presetId, kind } = this.resolveWeights(request);

    const baseMeasure = (await this.measure(base)).measurement;
    const baseScore = scoreBuild(baseMeasure.preference, weights, constraints)
      .weightedScore;

    const recommendations: Recommendation[] = [];
    const belowFloor: CutRecommendation[] = [];

    let anyPriced = false;
    for (const candidate of generateCandidates(base)) {
      await this.repos.mutations.save(candidate.mutation); // so /promote can find it
      // The adapter promotes the mutation internally and keys the Result by
      // (base.identity, mutationId) per AD-7 — no manual promotion needed here.
      const candMeasure = (
        await this.measureAndStore(base, candidate.mutation)
      ).measurement;

      // Pricing goes through the PriceProvider seam ONLY (kill-switch + synthetic
      // disclaimer). Provider off → no cost shown and ZERO price influence on the
      // score; a cost is never invented (trust rule: numbers are computed, not
      // fabricated). Free changes (pure respecs) price to 0 and stay chip-less.
      const quote = this.priceProvider?.priceFor(candidate.mutation, base) ?? null;
      const cost = quote !== null && quote.divines > 0 ? quote.divines : undefined;
      if (cost !== undefined) anyPriced = true;

      const candidateMetrics = {
        ...candMeasure.preference,
        changeCostDivines: cost ?? 0,
      };
      const scored = scoreCandidate(
        baseMeasure.preference,
        candidateMetrics,
        weights,
        constraints,
      );

      if (scored.belowFloor) {
        belowFloor.push({
          mutationId: candidate.mutation.mutationId,
          description: candidate.description,
          cost,
          violatedFloors: scored.violatedFloors.map((v) => ({
            metric: String(v.metric),
            min: v.min,
            actual: v.actual,
          })),
        });
        continue;
      }

      recommendations.push({
        mutationId: candidate.mutation.mutationId,
        description: candidate.description,
        delta: scored.weightedScoreDelta,
        baseScore: scored.baseScore,
        candidateScore: scored.candidateScore,
        cost,
        perAxis: scored.perAxisDecomposition.map((a) => ({
          axis: a.axis,
          baseNormalized: a.baseNormalized,
          candidateNormalized: a.candidateNormalized,
          weight: a.weight,
          weightedDelta: a.weightedDelta,
        })),
      });
    }

    // Rank by Weighted Score delta, desc; stable tiebreak by mutationId.
    recommendations.sort(
      (a, b) => b.delta - a.delta || a.mutationId.localeCompare(b.mutationId),
    );

    const response: TuneResponse = {
      buildId,
      applied: { presetId, kind },
      baseScore,
      engineVersion: this.engine.engineVersion,
      recommendations,
      belowFloor,
    };
    // Honest labeling: any priced cost on this surface is synthetic until the
    // real price layer ships — same disclaimer contract as Upgrades.
    if (anyPriced) {
      response.priceProvenance = SYNTHETIC_PRICE_PROVENANCE;
      response.priceDisclaimer = SYNTHETIC_PRICE_DISCLAIMER;
    }

    // Build Coach narration of the top changes (UX §4.2). Non-null only; on any
    // degradation the field is simply absent.
    if (recommendations.length > 0) {
      const narration = await this.coach.narrateTune(
        tuneNarrationInput(recommendations, presetId ?? "custom", this.archetype(base)),
      );
      if (narration !== null) response.narration = narration;
    }

    return response;
  }

  // -- Promote --------------------------------------------------------------

  /** POST /builds/:id/promote: apply a mutation → a NEW snapshot (old untouched). */
  async promote(buildId: string, mutationId: string): Promise<PromoteResponse> {
    const base = await this.requireBuild(buildId);
    if (typeof mutationId !== "string" || mutationId.length === 0) {
      throw new HttpError(400, "mutationId is required");
    }
    const mutation = await this.repos.mutations.get(mutationId);
    if (mutation === undefined) {
      throw new HttpError(404, `no mutation with id ${mutationId}`);
    }
    if (mutation.baseSnapshotId !== base.identity) {
      throw new HttpError(
        409,
        "mutation does not apply to this build (base identity mismatch)",
      );
    }
    const promoted = promoteMutation(base, mutation);
    const newBuildId = await this.repos.builds.save(promoted);
    await this.measureAndStore(promoted);

    return {
      previousBuildId: buildId,
      buildId: newBuildId,
      mutationId,
      summary: this.summarize(promoted),
      provenance: this.provenanceView(promoted),
    };
  }

  // -- Doctor ---------------------------------------------------------------

  /** GET /builds/:id/doctor: goal-aware Doctor Report over the engine outputs. */
  async doctor(buildId: string, goalRaw: string, tierRaw?: string): Promise<DoctorResponse> {
    const base = await this.requireBuild(buildId);
    const goal = goalRaw as Goal;
    if (!VALID_GOALS.has(goal)) {
      throw new HttpError(
        400,
        `unknown goal "${goalRaw}"; expected one of ${[...VALID_GOALS].join(", ")}`,
      );
    }
    let tier = 10;
    if (tierRaw !== undefined) {
      const parsed = Number(tierRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new HttpError(400, `tier must be a non-negative number`);
      }
      tier = Math.floor(parsed);
    }
    const measure = (await this.measure(base)).measurement;
    const report = runDoctor(measure.doctor, goal, tier);

    // Build Coach narration of the report (UX §4.3 footer callout). Non-null only;
    // on any degradation the narration field is simply absent (kill-switch).
    const narration = await this.coach.narrateDoctor(
      doctorNarrationInput(report, goal, this.archetype(base)),
    );
    return narration !== null ? { ...report, narration } : report;
  }

  /** GET /goals: the built-in Goal Presets (preset gallery, UX §3 /goals). */
  listPresets(): typeof PRESET_LIST {
    return PRESET_LIST;
  }

  // -- Compare (UX §4.4) ----------------------------------------------------

  /**
   * GET /builds/:id/compare?with=<otherBuildId>: diff the user's build against a
   * public build and re-score BOTH under the USER'S weights (the pivot's thesis
   * row). Each diff candidate is engine-evaluated on the USER'S build and scored
   * as a Weighted Score delta under those weights, attributed to the source build.
   */
  async compare(
    buildId: string,
    otherBuildId: string,
    presetId?: string,
    customWeights?: Partial<AxisWeights>,
  ): Promise<CompareResponse> {
    if (typeof otherBuildId !== "string" || otherBuildId.trim().length === 0) {
      throw new HttpError(400, "'with' (the other build id) is required");
    }
    const user = await this.requireBuild(buildId);
    const other = await this.requireBuild(otherBuildId);
    // Custom slider weights take precedence (Law 1: the sliders are the product;
    // the pivot's thesis row must be scored under the USER'S live weights, not a
    // preset fallback). presetId path unchanged; neither supplied → default preset.
    const { weights, constraints, presetId: resolvedPreset } =
      customWeights !== undefined && presetId === undefined
        ? {
            weights: this.coerceWeights(customWeights),
            constraints: undefined,
            presetId: "custom",
          }
        : this.resolvePreset(presetId);

    // Re-score BOTH builds under the USER'S weights (the pivot). Public builds are
    // measured through the same cached adapter; nothing is invented.
    const userMeasure = (await this.measure(user)).measurement;
    const otherMeasure = (await this.measure(other)).measurement;
    const userScore = scoreBuild(userMeasure.preference, weights, constraints).weightedScore;
    const otherScoreUnderUserWeights = scoreBuild(
      otherMeasure.preference,
      weights,
      constraints,
    ).weightedScore;

    // Diff user (A) vs other (B); every candidate is a promotable mutation against
    // the user, stamped with the other build's Provenance for attribution.
    const diff = diffSnapshots(user, other, other.metadata.provenance);
    const otherAttribution = this.attribution(other);

    const candidates: CompareCandidate[] = [];
    for (const cand of diff.candidates) {
      // Persist the pure mutation (drop the comparator's attribution-only `origin`)
      // so a later /promote can find it.
      const mutation: BuildMutation = {
        mutationId: cand.mutationId,
        baseSnapshotId: cand.baseSnapshotId,
        operations: cand.operations,
      };
      await this.repos.mutations.save(mutation);

      const candMeasure = (await this.measureAndStore(user, mutation)).measurement;
      const scored = scoreCandidate(
        userMeasure.preference,
        candMeasure.preference,
        weights,
        constraints,
      );
      candidates.push({
        mutationId: cand.mutationId,
        description: this.describeCandidate(cand, other),
        delta: scored.weightedScoreDelta,
        perAxis: this.axisContributions(scored.perAxisDecomposition),
        source: otherAttribution,
      });
    }
    // Rank by Weighted Score delta under the user's weights; stable by mutationId.
    candidates.sort(
      (a, b) => b.delta - a.delta || a.mutationId.localeCompare(b.mutationId),
    );

    return {
      user: this.summarize(user),
      other: { ...this.summarize(other), provenance: this.provenanceView(other) },
      diff: {
        nodes: {
          onlyInUser: [...diff.passiveTree.onlyInA],
          onlyInOther: [...diff.passiveTree.onlyInB],
          shared: [...diff.passiveTree.shared],
        },
        gear: diff.gear.map((g) => ({
          slot: g.slot,
          status: g.status,
          addedModLines: [...g.addedModLines],
          removedModLines: [...g.removedModLines],
        })),
        skills: diff.skills.map((s) => ({ setupId: s.setupId, status: s.status })),
        config: diff.config.map((c) => ({
          key: c.key,
          status: c.status,
          user: c.a,
          other: c.b,
        })),
      },
      candidates,
      scoreRow: { userScore, otherScoreUnderUserWeights, presetId: resolvedPreset },
    };
  }

  /**
   * POST /builds/:id/compare/import: import a pasted build (any format) so it can
   * be used as the `?with=` target. Returns the imported build's id. The `:id`
   * pivot build must exist (this is a Compare-tab action on that build).
   */
  async compareImport(buildId: string, input: string): Promise<{ otherBuildId: string }> {
    await this.requireBuild(buildId);
    const imported = await this.importBuild(input);
    return { otherBuildId: imported.buildId };
  }

  // -- Upgrades (UX §4.5) ---------------------------------------------------

  /**
   * POST /builds/:id/upgrades: rank gear upgrades by Δweighted-score per Divine,
   * excluding over-budget and below-floor candidates. Prices come from the
   * PriceProvider seam and are SYNTHETIC until the real price layer ships; when the
   * price layer is switched off (kill-switch) this throws a typed 503.
   */
  async upgrades(buildId: string, request: UpgradesRequest): Promise<UpgradesResponse> {
    const budgetDivines = Number(request.budgetDivines);
    if (!Number.isFinite(budgetDivines) || budgetDivines <= 0) {
      throw new HttpError(400, "budgetDivines must be a positive number");
    }
    if (this.priceProvider === null) {
      // Kill-switch: the price layer is unavailable — degrade visibly, never invent
      // a price (the same posture as the Build Coach kill-switch).
      throw new HttpError(503, "price layer unavailable (PRICE_PROVIDER not configured)");
    }
    const base = await this.requireBuild(buildId);
    const { weights, constraints } = this.resolveUpgradeWeights(request);
    const baseMeasure = (await this.measure(base)).measurement;

    const priced: UpgradeCandidate[] = [];
    for (const candidate of generateUpgradeCandidates(base)) {
      const quote = this.priceProvider.priceFor(candidate.mutation, base);
      if (quote === null || quote.divines <= 0) continue; // not priceable
      const costDivines = quote.divines;
      if (costDivines > budgetDivines) continue; // over budget — excluded

      await this.repos.mutations.save(candidate.mutation);
      const candMeasure = (await this.measureAndStore(base, candidate.mutation)).measurement;
      // The bar length is Δweighted-score PER DIVINE: cost enters via the division
      // below, NOT via the Currency Efficiency axis (that would double-count it), so
      // the delta measures the build improvement alone (UX §4.5).
      const scored = scoreCandidate(
        baseMeasure.preference,
        candMeasure.preference,
        weights,
        constraints,
      );
      if (scored.belowFloor) continue; // below a Pro-mode floor — excluded (kept)

      priced.push({
        mutationId: candidate.mutation.mutationId,
        description: candidate.description,
        delta: scored.weightedScoreDelta,
        perAxis: this.axisContributions(scored.perAxisDecomposition),
        costDivines,
        scorePerDivine: scored.weightedScoreDelta / costDivines,
        priceProvenance: SYNTHETIC_PRICE_PROVENANCE,
      });
    }
    // Rank by score-per-Divine, desc; stable tiebreak by mutationId.
    priced.sort(
      (a, b) => b.scorePerDivine - a.scorePerDivine || a.mutationId.localeCompare(b.mutationId),
    );

    return {
      buildId,
      budgetDivines,
      candidates: priced,
      priceDisclaimer: SYNTHETIC_PRICE_DISCLAIMER,
    };
  }

  // -- Item swap (UX §4.4) --------------------------------------------------

  /**
   * POST /builds/:id/itemswap: parse pasted PoE item text, build a swapItem
   * mutation, engine-evaluate it on the build and score the change. 422 on
   * unparseable text (a typed error, never a wrong swap). Scored under the default
   * Goal Preset's weights (the neutral baseline; the Tune sliders own custom weights).
   */
  async itemSwap(buildId: string, itemText: string): Promise<ItemSwapResponse> {
    const base = await this.requireBuild(buildId);
    const primary =
      base.buildState.loadoutContexts.find((l) => l.primary) ??
      base.buildState.loadoutContexts[0];
    if (primary === undefined) {
      throw new HttpError(422, "build has no loadout to swap an item into");
    }
    let parsed;
    let item;
    try {
      ({ parsed, item } = parseItemText(itemText));
    } catch (err) {
      if (err instanceof ItemParseError) {
        throw new HttpError(422, `could not parse item text: ${err.message}`);
      }
      throw err;
    }

    const mutation = createBuildMutation({
      baseSnapshotId: base.identity,
      operations: [{ kind: "swapItem", loadoutContextId: primary.contextId, item }],
    });
    await this.repos.mutations.save(mutation);

    const { weights, constraints } = this.resolvePreset(undefined);
    const baseMeasure = (await this.measure(base)).measurement;
    const candMeasure = (await this.measureAndStore(base, mutation)).measurement;
    const scored = scoreCandidate(
      baseMeasure.preference,
      candMeasure.preference,
      weights,
      constraints,
    );

    return {
      parsed,
      delta: scored.weightedScoreDelta,
      perAxis: this.axisContributions(scored.perAxisDecomposition),
      belowFloor: scored.belowFloor,
      description: `Swap in ${parsed.name} (${parsed.rarity}) in ${parsed.slot} — ${parsed.modifiers.length} modifier line(s).`,
    };
  }

  // -- Wasted-stat finder ---------------------------------------------------

  /**
   * GET /builds/:id/wasted: surface recoverable inefficiencies (overcapped
   * resistances, dead config toggles, unused supports) derived from the latest
   * Calculation Result + snapshot. Each finding's severity is weighted by the
   * active preset's weight on the axis it touches — an overcapped resist matters
   * more under a Survivability-heavy preset.
   */
  async wasted(buildId: string, presetId?: string): Promise<WastedResponse> {
    const base = await this.requireBuild(buildId);
    const { weights, presetId: resolvedPreset } = this.resolvePreset(presetId);
    const normalized = normalizeWeights(weights);
    const measure = (await this.measure(base)).measurement;

    const findings: WastedFinding[] = [];

    // overcapped-resist — touches the Survivability axis.
    const survWeight = normalized["Survivability"];
    const resists = measure.doctor.resists;
    for (const [element, state] of Object.entries(resists)) {
      const overcap = state.total - state.max;
      if (overcap <= 0) continue;
      const baseSeverity = clamp01(overcap / WASTED.overcapScale);
      findings.push({
        id: `overcapped-resist:${element}`,
        kind: "overcapped-resist",
        statement: `Your ${element} resistance is ${overcap}% over the ${state.max}% cap — that overcap is recoverable to reallocate elsewhere.`,
        evidence: { element, total: state.total, cap: state.max, overcap },
        axisWeightedSeverity: baseSeverity * survWeight,
      });
    }

    // dead-config — a scenario toggle sitting inert. Touches no preference axis, so
    // its severity is unscaled (weight factor 1).
    for (const entry of base.buildState.configuration) {
      if (entry.value !== false) continue;
      findings.push({
        id: `dead-config:${entry.key}`,
        kind: "dead-config",
        statement: `Config '${entry.key}' is off, so your measured numbers do not account for that scenario.`,
        evidence: { key: entry.key, value: entry.value },
        axisWeightedSeverity: WASTED.deadConfigSeverity,
      });
    }

    // unused-support — support gems socketed with no active skill to support.
    const primary =
      base.buildState.loadoutContexts.find((l) => l.primary) ??
      base.buildState.loadoutContexts[0];
    const attackWeight = normalized["Attack Speed"];
    for (const setup of primary?.skills ?? []) {
      if (setup.skillGemRef !== null || setup.supports.length === 0) continue;
      const baseSeverity = clamp01(setup.supports.length / WASTED.unusedSupportScale);
      findings.push({
        id: `unused-support:${setup.setupId}`,
        kind: "unused-support",
        statement: `Setup '${setup.setupId}' has ${setup.supports.length} support gem(s) but no active skill — those supports do nothing until a skill is socketed.`,
        evidence: { setupId: setup.setupId, supportCount: setup.supports.length },
        axisWeightedSeverity: baseSeverity * attackWeight,
      });
    }

    // Most-severe first; stable tiebreak by id.
    findings.sort(
      (a, b) => b.axisWeightedSeverity - a.axisWeightedSeverity || a.id.localeCompare(b.id),
    );
    return { findings, presetId: resolvedPreset };
  }

  // -- Reports (immutable frozen snapshots, shareable /r/{id}) ---------------

  /**
   * POST /reports: freeze a result into an immutable, shareable report. The build
   * summary + attribution are captured now and the payload is stored VERBATIM;
   * a report NEVER recomputes, so a later change to the build cannot alter it.
   */
  async createReport(
    buildId: string,
    kind: ReportKind,
    payload: unknown,
  ): Promise<{ reportId: string }> {
    if (!VALID_REPORT_KINDS.has(kind)) {
      throw new HttpError(
        400,
        `unknown report kind "${kind}"; expected one of ${[...VALID_REPORT_KINDS].join(", ")}`,
      );
    }
    const base = await this.requireBuild(buildId);
    const reportId = randomUUID();
    // Detach the payload from any caller-held reference so nothing can mutate it
    // after freeze (reports are immutable snapshots).
    const frozenPayload = structuredClone(payload);
    const report: StoredReport = {
      reportId,
      buildId,
      kind,
      frozenAt: new Date().toISOString(),
      buildSummary: this.summarize(base),
      attribution: this.attribution(base),
      payload: frozenPayload,
    };
    await this.repos.reports.save(report);
    return { reportId };
  }

  /** GET /reports/:id: the frozen report, returned verbatim (never recomputed). */
  async getReport(reportId: string): Promise<ReportResponse> {
    const report = await this.repos.reports.get(reportId);
    if (report === undefined) {
      throw new HttpError(404, `no report with id ${reportId}`);
    }
    return {
      kind: report.kind,
      frozenAt: report.frozenAt,
      buildSummary: report.buildSummary,
      attribution: report.attribution,
      payload: report.payload,
    };
  }

  // -- Users (anonymous account seam) ---------------------------------------

  /**
   * POST /users: create an anonymous account. AUTH SEAM — platform auth (Phase 1
   * item 5) replaces the anonymous id with a real authenticated principal; there
   * is no auth here yet, which is exactly the seam that swap fills.
   */
  async createUser(): Promise<{ userId: string }> {
    const userId = randomUUID();
    await this.repos.users.save({ userId, createdAt: new Date().toISOString() });
    return { userId };
  }

  /** POST /users/:id/builds: save a build to a user's list. */
  async saveUserBuild(userId: string, buildId: string): Promise<{ saved: SavedBuild }> {
    const user = await this.repos.users.get(userId);
    if (user === undefined) throw new HttpError(404, `no user with id ${userId}`);
    await this.requireBuild(buildId); // the build must exist
    const saved: SavedBuild = { userId, buildId, savedAt: new Date().toISOString() };
    await this.repos.savedBuilds.add(saved);
    return { saved };
  }

  /** GET /users/:id/builds: the user's saved-builds list (oldest-first). */
  async listUserBuilds(userId: string): Promise<{ builds: SavedBuild[] }> {
    const user = await this.repos.users.get(userId);
    if (user === undefined) throw new HttpError(404, `no user with id ${userId}`);
    return { builds: await this.repos.savedBuilds.list(userId) };
  }

  // -- Internals ------------------------------------------------------------

  private async requireBuild(buildId: string): Promise<CoreSnapshot> {
    const core = await this.repos.builds.get(buildId);
    if (core === undefined) {
      throw new HttpError(404, `no build with id ${buildId}`);
    }
    return core;
  }

  /**
   * Deterministic, cached measurement. Delegates the actual calculation to the
   * engine-adapter (the sole calculator, ADR-001) and translates its Calculation
   * Result into the two consumer slices (engine/outputs.ts). A candidate is passed
   * as `(base, mutation)`; the adapter promotes it internally and keys the Result
   * by (base.identity, mutationId) per AD-7. Dedup is by the Result's canonical key.
   */
  private async measure(
    snapshot: CoreSnapshot,
    mutation?: BuildMutation,
  ): Promise<{ measurement: Measurement; result: CalculationResult }> {
    const result = await this.engine.calculate(snapshot, mutation);
    const cacheKey = serializeResultKey(result.key);
    let measurement = this.measurements.get(cacheKey);
    if (measurement === undefined) {
      measurement = toMeasurement(result);
      this.measurements.set(cacheKey, measurement);
    }
    return { measurement, result };
  }

  /**
   * Measure and persist the stored Calculation Result artifact (its metrics are
   * the mapped `EngineMetrics` surface the API exposes — a pure projection of the
   * adapter's Result, not a recalculation). Keyed by the adapter's canonical key.
   */
  private async measureAndStore(
    snapshot: CoreSnapshot,
    mutation?: BuildMutation,
  ): Promise<{ measurement: Measurement; result: CalculationResult }> {
    const { measurement, result } = await this.measure(snapshot, mutation);
    const stored = toStoredResult(result, measurement, result.key);
    if ((await this.repos.calculations.get(result.key)) === undefined) {
      await this.repos.calculations.save(stored);
    }
    return { measurement, result: stored };
  }

  private resolveWeights(request: TuneRequest): {
    weights: AxisWeights;
    constraints: ScoreConstraints | undefined;
    presetId: string | null;
    kind: "preset" | "custom";
  } {
    if (request.presetId !== undefined) {
      const preset = getPreset(request.presetId);
      if (preset === undefined) {
        throw new HttpError(400, `unknown presetId "${request.presetId}"`);
      }
      return {
        weights: preset.weights,
        constraints: request.constraints ?? preset.constraints,
        presetId: preset.id,
        kind: "preset",
      };
    }
    if (request.weights !== undefined) {
      return {
        weights: this.coerceWeights(request.weights),
        constraints: request.constraints,
        presetId: null,
        kind: "custom",
      };
    }
    throw new HttpError(400, "tune requires either a presetId or weights");
  }

  /**
   * Resolve a Goal Preset's weights + constraints for a GET surface (Compare,
   * Item swap, Wasted). Defaults to the built-in default preset; validates a
   * supplied id. `presetId` in the result is the resolved id (for the response).
   */
  private resolvePreset(presetId: string | undefined): {
    weights: AxisWeights;
    constraints: ScoreConstraints | undefined;
    presetId: string;
  } {
    const id = presetId ?? DEFAULT_PRESET_ID;
    const preset = getPreset(id);
    if (preset === undefined) {
      throw new HttpError(400, `unknown presetId "${id}"`);
    }
    return { weights: preset.weights, constraints: preset.constraints, presetId: preset.id };
  }

  /** Resolve weights for the Upgrades surface: presetId | weights | default preset. */
  private resolveUpgradeWeights(request: UpgradesRequest): {
    weights: AxisWeights;
    constraints: ScoreConstraints | undefined;
  } {
    if (request.presetId !== undefined) {
      const preset = getPreset(request.presetId);
      if (preset === undefined) {
        throw new HttpError(400, `unknown presetId "${request.presetId}"`);
      }
      return { weights: preset.weights, constraints: preset.constraints };
    }
    if (request.weights !== undefined) {
      return { weights: this.coerceWeights(request.weights), constraints: undefined };
    }
    const preset = getPreset(DEFAULT_PRESET_ID)!;
    return { weights: preset.weights, constraints: preset.constraints };
  }

  /** Map a Preference-Engine per-axis decomposition to the API's AxisContribution. */
  private axisContributions(
    perAxis: ReadonlyArray<{
      axis: string;
      baseNormalized: number;
      candidateNormalized: number;
      weight: number;
      weightedDelta: number;
    }>,
  ): AxisContribution[] {
    return perAxis.map((a) => ({
      axis: a.axis,
      baseNormalized: a.baseNormalized,
      candidateNormalized: a.candidateNormalized,
      weight: a.weight,
      weightedDelta: a.weightedDelta,
    }));
  }

  /**
   * A coach-voice description of a Compare candidate (adopting one change from the
   * other build). Uses the other build's Display Cache for human names where it can.
   */
  private describeCandidate(cand: DiffCandidate, other: CoreSnapshot): string {
    const op = cand.operations[0];
    if (op === undefined) return "Adopt a change from the compared build.";
    const name = (ref: string | null | undefined): string =>
      (ref !== null && ref !== undefined ? other.displayCache.names[ref] ?? ref : "an item");
    switch (op.kind) {
      case "allocatePassiveNode":
        return `Adopt their passive node ${op.nodeId}.`;
      case "deallocatePassiveNode":
        return `Drop passive node ${op.nodeId} (they don't take it).`;
      case "swapItem":
        return `Swap your ${op.item.slot} to their ${name(op.item.itemRef)}.`;
      case "changeGem":
        return `Swap your gem in setup ${op.setupId} to ${name(op.skillGemRef)}.`;
      case "changeSupport":
        return op.addSupportRef !== undefined
          ? `Add support ${name(op.addSupportRef)} to setup ${op.setupId}.`
          : `Remove support ${name(op.removeSupportRef)} from setup ${op.setupId}.`;
      case "changeConfig":
        return `Set config '${op.key}' to ${String(op.value)} (matching their setup).`;
    }
  }

  /** Fill any missing axis with 0 so the scorer never sees an undefined weight. */
  private coerceWeights(partial: Partial<AxisWeights>): AxisWeights {
    const out = {} as AxisWeights;
    for (const axis of PREFERENCE_AXES) {
      const w = partial[axis];
      out[axis] = typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0;
    }
    return out;
  }

  private summarize(core: CoreSnapshot): SnapshotSummary {
    const bs = core.buildState;
    const primary =
      bs.loadoutContexts.find((l) => l.primary) ?? bs.loadoutContexts[0];
    const mainSetup = primary?.skills.find((s) => s.isMainSkill) ?? primary?.skills[0];
    const mainRef = mainSetup?.skillGemRef ?? null;
    const mainName =
      (mainRef !== null ? core.displayCache.names[mainRef] : undefined) ?? mainRef;
    return {
      buildId: core.identity,
      class: bs.character.class,
      ascendancy: bs.character.ascendancy,
      level: bs.character.level,
      mainSkill: mainName,
      gamePatch: core.metadata.patchVersion,
      formatVersion: core.metadata.formatVersion,
      loadoutCount: bs.loadoutContexts.length,
      primaryLoadoutId: primary?.contextId ?? null,
      allocatedNodeCount: primary?.passiveTree.allocatedNodes.length ?? 0,
      itemCount: primary?.equipment.length ?? 0,
    };
  }

  private provenanceView(core: CoreSnapshot): ProvenanceView {
    const p = core.metadata.provenance;
    return {
      source: p.source,
      reference: p.reference ?? null,
      importedAt: p.importedAt,
      attribution: p.attribution ?? null,
      rawImportArtifactId: p.rawImportArtifactId ?? null,
    };
  }

  /** Attribution is NEVER empty — the charter requires a source line on every build. */
  private attribution(core: CoreSnapshot): string {
    const p = core.metadata.provenance;
    if (p.attribution !== undefined && p.attribution.trim().length > 0) {
      return p.attribution;
    }
    const ref = p.reference !== undefined ? ` (${p.reference})` : "";
    return `Imported via ${p.source}${ref}; no external author attribution provided.`;
  }

  private assumptionViews(core: CoreSnapshot): AssumptionView[] {
    return core.buildState.assumptions.map((a) =>
      a.note !== undefined
        ? { path: a.path, origin: a.origin, note: a.note }
        : { path: a.path, origin: a.origin },
    );
  }

  private archetype(core: CoreSnapshot): ArchetypeDetection {
    // The Context Detector consumes core's BuildSnapshot natively (it is
    // source-blind and reads build state + Display Cache). Engine-derived
    // defensive/resource magnitudes (RFC-0001 AD-7) are not available here, so
    // detection keys off skill mechanics — sufficient for the launch rules table.
    return detectArchetype(core);
  }
}
