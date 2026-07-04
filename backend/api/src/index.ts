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
  InMemoryRawImportArtifactRepository,
} from "./store/repositories.js";
export type {
  BuildRepository,
  CalculationResultRepository,
  MutationRepository,
  RawImportArtifactRepository,
  Repositories,
} from "./store/repositories.js";

// Postgres persistence (Open Task 11) — selected at runtime by DATABASE_URL via
// `repositoriesFromEnv`; the in-memory bundle above stays the default.
export {
  PostgresBuildRepository,
  PostgresCalculationResultRepository,
  PostgresMutationRepository,
  PostgresRawImportArtifactRepository,
  createPostgresRepositories,
  repositoriesFromEnv,
  repositoriesOver,
  ensureSchema,
  pgQueryable,
} from "./store/postgres-repositories.js";
export type {
  PostgresRepositories,
  Queryable,
  QueryResultLike,
} from "./store/postgres-repositories.js";

// The engine is the engine-adapter package's — swapping mock→real PoB2 happens
// there and only there (ADR-001). The backend's contribution is the small
// Calculation-Result → consumer-slice translation in engine/outputs.ts.
export { MockEngine, MOCK_ENGINE_VERSION } from "@exilelab/engine-adapter";
export type { EngineAdapter } from "@exilelab/engine-adapter";
export {
  toEngineMetrics,
  toEngineOutputs,
  toMeasurement,
} from "./engine/outputs.js";
export type { Measurement } from "./engine/outputs.js";

export { generateCandidates } from "./optimizer/candidates.js";
export type { Candidate } from "./optimizer/candidates.js";

// The build-normalizer emits core's canonical BuildSnapshot directly and the
// Context Detector consumes it natively (RFC-0001 landed), so the former bridging
// adapters (snapshot-adapter / context-adapter) are gone — the import route is
// importAny → normalize → core BuildSnapshot with no translation seam.

export { TWISTER_HUNTRESS, twisterHuntressJson } from "./fixtures.js";
