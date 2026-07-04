// @exilelab/core — separate downstream artifacts (RFC-0001 AD-4, AD-7).
//
// These are NEVER embedded in a BuildSnapshot. They are validated + frozen here
// so producers (the engine boundary adapter, importers) get the same guarantees
// snapshots have.

import type { CalculationResult, RawImportArtifact } from './types.js';
import { CalculationResultSchema, RawImportArtifactSchema } from './schema.js';
import { deepFreeze } from './freeze.js';

/**
 * Validate and freeze a Calculation Result. Keyed by (snapshotId, mutationId?,
 * engineVersion) — the engine version lives here, never in the snapshot (I5, AD-7).
 */
export function createCalculationResult(input: CalculationResult): CalculationResult {
  return deepFreeze(CalculationResultSchema.parse(input));
}

/**
 * Validate and freeze a Raw Import Artifact — importer-owned, time-boxed,
 * internal-only, never part of a snapshot and never consumed downstream (AD-4).
 */
export function createRawImportArtifact(input: RawImportArtifact): RawImportArtifact {
  return deepFreeze(RawImportArtifactSchema.parse(input));
}
