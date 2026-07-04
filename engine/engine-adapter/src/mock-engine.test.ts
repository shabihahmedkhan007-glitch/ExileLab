import { describe, it, expect } from 'vitest';
import { createBuildSnapshot, createBuildMutation } from '@exilelab/core';
import { MockEngine, computeMockMetrics, MOCK_ENGINE_VERSION } from './mock-engine.js';
import { translateSnapshot } from './engine-input.js';
import { twoLoadoutInput, minimalInput, twoLoadoutMutation } from './fixtures.js';

describe('MockEngine determinism', () => {
  it('produces an identical CalculationResult for the same snapshot twice', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const engine = new MockEngine();

    const a = await engine.calculate(snapshot);
    const b = await engine.calculate(snapshot);

    // Byte-identical artifacts: metrics, key, and (deterministic) computedAt.
    expect(a).toEqual(b);
  });

  it('produces identical results across independent engine instances', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const a = await new MockEngine().calculate(snapshot);
    const b = await new MockEngine().calculate(snapshot);
    expect(a.metrics).toEqual(b.metrics);
  });

  it('is a pure function of translated input + engine version', () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const input = translateSnapshot(snapshot);
    expect(computeMockMetrics(input, MOCK_ENGINE_VERSION)).toEqual(
      computeMockMetrics(input, MOCK_ENGINE_VERSION),
    );
  });

  it('keys the result by (snapshotId, engineVersion) with no mutationId when unmutated', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const result = await new MockEngine().calculate(snapshot);
    expect(result.key.snapshotId).toBe(snapshot.identity);
    expect(result.key.engineVersion).toBe(MOCK_ENGINE_VERSION);
    expect(result.key.mutationId).toBeUndefined();
  });

  it('emits only finite metric values', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const result = await new MockEngine().calculate(snapshot);
    for (const v of Object.values(result.metrics)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('MockEngine responds to build content', () => {
  it('gives distinct snapshots distinct metrics', async () => {
    const engine = new MockEngine();
    const big = await engine.calculate(createBuildSnapshot(twoLoadoutInput()));
    const small = await engine.calculate(createBuildSnapshot(minimalInput()));
    expect(big.metrics.dps).not.toBe(small.metrics.dps);
    // The larger, higher-level, more-linked build should out-DPS the minimal one.
    expect(big.metrics.dps!).toBeGreaterThan(small.metrics.dps!);
  });

  it('varies metrics by engine version (results cache independently per version)', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const v1 = await new MockEngine({ engineVersion: 'mock-1' }).calculate(snapshot);
    const v2 = await new MockEngine({ engineVersion: 'mock-2' }).calculate(snapshot);
    expect(v2.key.engineVersion).toBe('mock-2');
    expect(v1.metrics).not.toEqual(v2.metrics);
  });
});

describe('MockEngine mutation handling', () => {
  it('changes results when a mutation alters the build', async () => {
    const engine = new MockEngine();
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const mutation = createBuildMutation(twoLoadoutMutation(snapshot.identity));

    const base = await engine.calculate(snapshot);
    const mutated = await engine.calculate(snapshot, mutation);

    expect(mutated.metrics).not.toEqual(base.metrics);
    // Added nodes + a support link raise DPS.
    expect(mutated.metrics.dps).toBeGreaterThan(base.metrics.dps!);
  });

  it('keys a mutated result by (baseSnapshotId, mutationId, engineVersion)', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const mutation = createBuildMutation(twoLoadoutMutation(snapshot.identity));
    const result = await new MockEngine().calculate(snapshot, mutation);

    expect(result.key.snapshotId).toBe(snapshot.identity);
    expect(result.key.mutationId).toBe(mutation.mutationId);
    expect(result.key.engineVersion).toBe(MOCK_ENGINE_VERSION);
  });

  it('is deterministic for a mutated calculation too', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const mutation = createBuildMutation(twoLoadoutMutation(snapshot.identity));
    const engine = new MockEngine();
    const a = await engine.calculate(snapshot, mutation);
    const b = await engine.calculate(snapshot, mutation);
    expect(a).toEqual(b);
  });

  it('rejects a mutation whose base does not match the snapshot', async () => {
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const mismatched = createBuildMutation(twoLoadoutMutation('deadbeef-not-the-identity'));
    await expect(new MockEngine().calculate(snapshot, mismatched)).rejects.toThrow();
  });
});
