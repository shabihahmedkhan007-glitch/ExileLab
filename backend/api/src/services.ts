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
import { promoteMutation } from "@exilelab/core";
import type {
  BuildMutation,
  BuildSnapshot as CoreSnapshot,
  CalculationResult,
} from "@exilelab/core";
import { detectArchetype } from "@exilelab/context-detector";
import type { ArchetypeDetection } from "@exilelab/context-detector";
import {
  getPreset,
  PREFERENCE_AXES,
  PRESET_LIST,
  scoreBuild,
  scoreCandidate,
} from "@exilelab/preference-engine";
import type {
  AxisWeights,
  ScoreConstraints,
} from "@exilelab/preference-engine";
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
import type { Repositories } from "./store/repositories.js";
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
  /** Priced cost of the change in Divines (UX cost chip). */
  cost: number;
  perAxis: AxisContribution[];
}

export interface CutRecommendation {
  mutationId: string;
  description: string;
  cost: number;
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

    for (const candidate of generateCandidates(base)) {
      await this.repos.mutations.save(candidate.mutation); // so /promote can find it
      // The adapter promotes the mutation internally and keys the Result by
      // (base.identity, mutationId) per AD-7 — no manual promotion needed here.
      const candMeasure = (
        await this.measureAndStore(base, candidate.mutation)
      ).measurement;

      const candidateMetrics = {
        ...candMeasure.preference,
        changeCostDivines: candidate.costDivines,
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
          cost: candidate.costDivines,
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
        cost: candidate.costDivines,
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
