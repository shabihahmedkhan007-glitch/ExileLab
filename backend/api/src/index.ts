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
  CompareCandidate,
  CompareGearRow,
  CompareResponse,
  CompareScoreRow,
  CutRecommendation,
  DoctorResponse,
  ImportResponse,
  ItemSwapResponse,
  ProvenanceView,
  PromoteResponse,
  Recommendation,
  ReportResponse,
  SnapshotSummary,
  TuneRequest,
  TuneResponse,
  UpgradeCandidate,
  UpgradesRequest,
  UpgradesResponse,
  WastedFinding,
  WastedKind,
  WastedResponse,
} from "./services.js";

// The price-layer seam (UX §4.5) — synthetic mock today, real compliance-reviewed
// poller later, both behind the PriceProvider interface (charter §7.5).
export {
  MockPriceProvider,
  priceProviderFromEnv,
  SYNTHETIC_PRICE_DISCLAIMER,
  SYNTHETIC_PRICE_PROVENANCE,
} from "./prices/index.js";
export type { PriceProvider, PriceQuote, PriceProvenance } from "./prices/index.js";

export { parseItemText, ItemParseError } from "./items/parse-item.js";
export type { ParsedItem } from "./items/parse-item.js";
export { generateUpgradeCandidates } from "./optimizer/upgrade-candidates.js";

export {
  createInMemoryRepositories,
  InMemoryBuildRepository,
  InMemoryCalculationResultRepository,
  InMemoryMutationRepository,
  InMemoryRawImportArtifactRepository,
  InMemoryReportRepository,
  InMemoryUserRepository,
  InMemorySavedBuildRepository,
} from "./store/repositories.js";
export type {
  BuildRepository,
  CalculationResultRepository,
  MutationRepository,
  RawImportArtifactRepository,
  Repositories,
  ReportKind,
  ReportRepository,
  SavedBuild,
  SavedBuildRepository,
  StoredReport,
  StoredUser,
  UserRepository,
} from "./store/repositories.js";

// Postgres persistence (Open Task 11) — selected at runtime by DATABASE_URL via
// `repositoriesFromEnv`; the in-memory bundle above stays the default.
export {
  PostgresBuildRepository,
  PostgresCalculationResultRepository,
  PostgresMutationRepository,
  PostgresRawImportArtifactRepository,
  PostgresReportRepository,
  PostgresUserRepository,
  PostgresSavedBuildRepository,
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

export {
  TWISTER_HUNTRESS,
  twisterHuntressJson,
  TWISTER_HUNTRESS_BOSS,
  twisterHuntressBossJson,
} from "./fixtures.js";
