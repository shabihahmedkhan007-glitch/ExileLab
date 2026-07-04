// @exilelab/engine-adapter — the permanent engine boundary (RFC-0001 §5.2, ADR-001).
//
// EngineAdapter is the interface the real PoB2 LuaJIT sidecar (Phase-0 spike S1)
// will implement. Everything upstream (importers, normalizer, canonical model)
// and downstream (Preference Engine, Doctor, Comparator) depends on THIS
// interface, never on the engine's document format. The MockEngine implements it
// today; the conformance suite (see conformance.ts) keeps any implementation
// honest and makes the real sidecar drop-in.

import type {
  BuildSnapshot,
  BuildMutation,
  CalculationResult,
  CalculationResultKey,
} from '@exilelab/core';

/**
 * The calculation-engine boundary. A `calculate` call takes a canonical
 * {@link BuildSnapshot} and an optional candidate {@link BuildMutation} and
 * returns a {@link CalculationResult} keyed by
 * `(snapshotId, mutationId?, engineVersion)` (RFC-0001 AD-7).
 *
 * Implementations MUST be deterministic with respect to their inputs: the same
 * `(snapshot, mutation?)` pair always yields the same metrics for a given
 * `engineVersion`. Results are separate downstream artifacts and are NEVER
 * embedded in a snapshot.
 */
export interface EngineAdapter {
  /**
   * The engine build/version identifier. Belongs to the Calculation Result key,
   * never to the snapshot (I5). Distinct engine versions may produce distinct
   * metrics for the same build and are cached independently.
   */
  readonly engineVersion: string;

  /**
   * Calculate metrics for a snapshot, optionally with a candidate mutation
   * applied. When `mutation` is supplied its `baseSnapshotId` MUST equal
   * `snapshot.identity`; the returned result's key carries the base snapshot id
   * plus the mutation id.
   */
  calculate(snapshot: BuildSnapshot, mutation?: BuildMutation): Promise<CalculationResult>;
}

/**
 * Build the Calculation Result key for a `(snapshot, mutation?, engineVersion)`
 * triple. `mutationId` is omitted (not set to `undefined`) when there is no
 * mutation, so the key serializes cleanly and validates against core's schema.
 */
export function makeResultKey(
  snapshot: BuildSnapshot,
  mutation: BuildMutation | undefined,
  engineVersion: string,
): CalculationResultKey {
  return mutation
    ? { snapshotId: snapshot.identity, mutationId: mutation.mutationId, engineVersion }
    : { snapshotId: snapshot.identity, engineVersion };
}

/**
 * Stable string form of a Calculation Result key, for use as a cache/store key.
 * Order-fixed and delimiter-separated; an absent mutation hashes distinctly from
 * any present one.
 */
export function serializeResultKey(key: CalculationResultKey): string {
  return `${key.snapshotId}|${key.mutationId ?? ''}|${key.engineVersion}`;
}
