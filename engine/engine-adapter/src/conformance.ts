// @exilelab/engine-adapter — the conformance-suite HARNESS (RFC-0001 AD-6, ADR-001).
//
// This is the seam that keeps the MockEngine honest and makes the real PoB2
// sidecar drop-in. A conformance suite is a set of fixtures — each an input
// snapshot (+ optional candidate mutation) paired with expected engine outputs —
// plus a runner that any EngineAdapter implementation can be run against.
//
// The MockEngine's own golden fixtures (fixtures.ts) are the FIRST suite. When
// the real sidecar arrives, its parity-with-desktop-PoB fixtures become another
// suite run through the same runner; an adapter that diverges fails here.

import type {
  BuildSnapshotInput,
  BuildMutationInput,
  CalculationResultKey,
} from '@exilelab/core';
import { createBuildSnapshot, createBuildMutation } from '@exilelab/core';
import type { EngineAdapter } from './adapter.js';

/**
 * One conformance case: build the snapshot from `snapshotInput` (and, if present,
 * the mutation from `mutationInput`), run the adapter, and assert the returned
 * metrics match `expectedMetrics`. Only the metrics named in `expectedMetrics`
 * are checked (an adapter may return additional metrics). Comparison is within
 * `tolerance` — a RELATIVE fraction (0 = exact); the MockEngine suite uses 0.
 */
export interface ConformanceFixture {
  readonly name: string;
  readonly snapshotInput: BuildSnapshotInput;
  readonly mutationInput?: BuildMutationInput;
  readonly expectedMetrics: Readonly<Record<string, number>>;
  /** Relative tolerance per metric (|actual-expected| <= tolerance*|expected|). Default 0. */
  readonly tolerance?: number;
}

/** One metric that failed to match, for diagnostics. */
export interface MetricMismatch {
  readonly metric: string;
  readonly expected: number;
  /** Actual value, or `undefined` when the adapter omitted the metric entirely. */
  readonly actual: number | undefined;
}

/** Result of running a single fixture. */
export interface FixtureOutcome {
  readonly name: string;
  readonly passed: boolean;
  readonly mismatches: readonly MetricMismatch[];
  /** The `(snapshotId, mutationId?, engineVersion)` key the adapter returned. */
  readonly key: CalculationResultKey;
  /** Populated when the adapter threw or the returned key was malformed. */
  readonly error?: string;
}

/** Aggregate result of running a whole suite. */
export interface ConformanceReport {
  readonly engineVersion: string;
  readonly passed: boolean;
  readonly total: number;
  readonly failed: number;
  readonly outcomes: readonly FixtureOutcome[];
}

function metricsMatch(
  expected: Readonly<Record<string, number>>,
  actual: Readonly<Record<string, number>>,
  tolerance: number,
): MetricMismatch[] {
  const mismatches: MetricMismatch[] = [];
  for (const [metric, exp] of Object.entries(expected)) {
    const act = actual[metric];
    if (act === undefined) {
      mismatches.push({ metric, expected: exp, actual: undefined });
      continue;
    }
    const allowed = Math.abs(exp) * tolerance;
    if (Math.abs(act - exp) > allowed) {
      mismatches.push({ metric, expected: exp, actual: act });
    }
  }
  return mismatches;
}

/**
 * Run one fixture against an adapter. Never throws: an adapter that throws is
 * recorded as a failed outcome with the error message.
 */
export async function runFixture(
  adapter: EngineAdapter,
  fixture: ConformanceFixture,
): Promise<FixtureOutcome> {
  const tolerance = fixture.tolerance ?? 0;
  const snapshot = createBuildSnapshot(fixture.snapshotInput);
  const mutation = fixture.mutationInput ? createBuildMutation(fixture.mutationInput) : undefined;

  try {
    const result = await adapter.calculate(snapshot, mutation);
    const mismatches = metricsMatch(fixture.expectedMetrics, result.metrics, tolerance);

    // The key contract is part of conformance: snapshotId + mutationId? +
    // engineVersion must be exactly what the boundary promises (AD-7).
    const keyErrors: string[] = [];
    if (result.key.snapshotId !== snapshot.identity) {
      keyErrors.push(`key.snapshotId ${result.key.snapshotId} != ${snapshot.identity}`);
    }
    if (result.key.engineVersion !== adapter.engineVersion) {
      keyErrors.push(`key.engineVersion ${result.key.engineVersion} != ${adapter.engineVersion}`);
    }
    const expectedMutationId = mutation?.mutationId;
    if (result.key.mutationId !== expectedMutationId) {
      keyErrors.push(`key.mutationId ${String(result.key.mutationId)} != ${String(expectedMutationId)}`);
    }

    const passed = mismatches.length === 0 && keyErrors.length === 0;
    return {
      name: fixture.name,
      passed,
      mismatches,
      key: result.key,
      ...(keyErrors.length > 0 ? { error: keyErrors.join('; ') } : {}),
    };
  } catch (err) {
    return {
      name: fixture.name,
      passed: false,
      mismatches: [],
      key: mutation
        ? { snapshotId: snapshot.identity, mutationId: mutation.mutationId, engineVersion: adapter.engineVersion }
        : { snapshotId: snapshot.identity, engineVersion: adapter.engineVersion },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run a full conformance suite against any {@link EngineAdapter}. Returns a
 * structured report; `report.passed` is true only when every fixture passes.
 * This is the drop-in gate: the MockEngine passes its own suite, and a
 * deliberately-wrong adapter fails it.
 */
export async function runConformanceSuite(
  adapter: EngineAdapter,
  fixtures: readonly ConformanceFixture[],
): Promise<ConformanceReport> {
  const outcomes: FixtureOutcome[] = [];
  for (const fixture of fixtures) {
    outcomes.push(await runFixture(adapter, fixture));
  }
  const failed = outcomes.filter((o) => !o.passed).length;
  return {
    engineVersion: adapter.engineVersion,
    passed: failed === 0,
    total: outcomes.length,
    failed,
    outcomes,
  };
}
