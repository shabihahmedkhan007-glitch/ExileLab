// @exilelab/api — public surface. The Fastify app + the service that wires the
// workspace packages into the one-way pipeline (importer → Raw Import Artifact →
// normalizer → BuildSnapshot → Calculation Result | BuildMutation → analyses).

export { buildApp } from "./app.js";
export type { BuildAppOptions } from "./app.js";

export { ExileLabService, HttpError } from "./services.js";
export type {
  AssumptionView,
  AxisContribution,
  BuildDetailResponse,
  CutRecommendation,
  ImportResponse,
  ProvenanceView,
  PromoteResponse,
  Recommendation,
  SnapshotSummary,
  TuneRequest,
  TuneResponse,
} from "./services.js";

export {
  createInMemoryRepositories,
  InMemoryBuildRepository,
  InMemoryCalculationResultRepository,
  InMemoryMutationRepository,
} from "./store/repositories.js";
export type {
  BuildRepository,
  CalculationResultRepository,
  MutationRepository,
  Repositories,
} from "./store/repositories.js";

export { MockEngine, ENGINE_VERSION } from "./engine/mock-engine.js";
export type { EngineAdapter, Measurement } from "./engine/mock-engine.js";

export { generateCandidates } from "./optimizer/candidates.js";
export type { Candidate } from "./optimizer/candidates.js";

export { toCoreSnapshot } from "./domain/snapshot-adapter.js";
export { toDetectorSnapshot } from "./domain/context-adapter.js";

export { TWISTER_HUNTRESS, twisterHuntressJson } from "./fixtures.js";
