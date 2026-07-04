// @exilelab/core — canonical build model (RFC-0001).
//
// The narrow waist of ExileLab: BuildSnapshot (immutable, deterministically
// identified, source-independent), BuildMutation deltas + promotion, and the
// separate downstream artifacts (Calculation Result, Raw Import Artifact).

// Types (data with guarantees; no behavior).
export type {
  Character,
  PassiveTreeAllocation,
  MasteryEffect,
  EquipmentItem,
  SkillSetup,
  LoadoutContext,
  ConfigEntry,
  AssumptionOrigin,
  Assumption,
  BuildState,
  Provenance,
  Metadata,
  DisplayCache,
  BuildSnapshot,
  BuildSnapshotInput,
  MutationOperation,
  BuildMutation,
  BuildMutationInput,
  CalculationResultKey,
  CalculationResult,
  RetentionNote,
  RawImportArtifact,
} from './types.js';

// Canonical Identity + canonicalization (RFC-0001 I2).
export {
  computeBuildStateIdentity,
  normalizeBuildState,
  stableStringify,
  sha256Hex,
} from './canonical.js';

// Immutability primitive (I1).
export { deepFreeze } from './freeze.js';

// Factories + behavior.
export { createBuildSnapshot } from './snapshot.js';
export { createBuildMutation, promoteMutation } from './mutation.js';
export { createCalculationResult, createRawImportArtifact } from './artifacts.js';

// Runtime validators (for downstream packages that need to validate inputs).
export {
  BuildStateSchema,
  BuildSnapshotInputSchema,
  MetadataSchema,
  DisplayCacheSchema,
  BuildMutationInputSchema,
  MutationOperationSchema,
  CalculationResultSchema,
  RawImportArtifactSchema,
} from './schema.js';
