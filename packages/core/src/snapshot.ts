// @exilelab/core — BuildSnapshot factory (RFC-0001).

import type { BuildSnapshot, BuildSnapshotInput } from './types.js';
import { BuildSnapshotInputSchema } from './schema.js';
import { computeBuildStateIdentity } from './canonical.js';
import { deepFreeze } from './freeze.js';

/**
 * Create a validated, deeply-frozen BuildSnapshot.
 *
 * - Validates the input against the canonical schema (rejects malformed builds,
 *   enforces exactly-one-primary Loadout Context, etc.).
 * - Computes the Canonical Identity over build state ONLY (I2); the caller never
 *   supplies an identity.
 * - Deep-freezes the result so the snapshot is immutable (I1) — attempts to
 *   mutate any nested field throw in strict mode.
 *
 * The returned object is a fresh value graph (zod parses into new objects); the
 * caller's input is never retained or mutated.
 */
export function createBuildSnapshot(input: BuildSnapshotInput): BuildSnapshot {
  const parsed = BuildSnapshotInputSchema.parse(input);
  const identity = computeBuildStateIdentity(parsed.buildState);
  const snapshot: BuildSnapshot = {
    identity,
    buildState: parsed.buildState,
    metadata: parsed.metadata,
    displayCache: parsed.displayCache,
  };
  return deepFreeze(snapshot);
}
