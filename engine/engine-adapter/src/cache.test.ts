import { describe, it, expect } from 'vitest';
import type { BuildSnapshot, BuildMutation, CalculationResult } from '@exilelab/core';
import { createBuildSnapshot, createBuildMutation } from '@exilelab/core';
import type { EngineAdapter } from './adapter.js';
import { serializeResultKey, makeResultKey } from './adapter.js';
import {
  InMemoryCalculationResultStore,
  CachingEngineAdapter,
  withCache,
} from './cache.js';
import { MockEngine } from './mock-engine.js';
import { twoLoadoutInput, minimalInput, twoLoadoutMutation } from './fixtures.js';

/** An EngineAdapter that counts how many times it actually computes. */
class CountingEngine implements EngineAdapter {
  readonly engineVersion = 'counting-1';
  calls = 0;
  readonly #inner = new MockEngine({ engineVersion: 'counting-1' });

  async calculate(snapshot: BuildSnapshot, mutation?: BuildMutation): Promise<CalculationResult> {
    this.calls += 1;
    return this.#inner.calculate(snapshot, mutation);
  }
}

describe('CachingEngineAdapter', () => {
  it('short-circuits a repeated calculation (delegate invoked once)', async () => {
    const inner = new CountingEngine();
    const store = new InMemoryCalculationResultStore();
    const cached = new CachingEngineAdapter(inner, store);
    const snapshot = createBuildSnapshot(twoLoadoutInput());

    const first = await cached.calculate(snapshot);
    const second = await cached.calculate(snapshot);

    expect(inner.calls).toBe(1);
    expect(store.size).toBe(1);
    expect(second).toEqual(first);
    // The hit is the very object that was stored.
    expect(second).toBe(await store.get(serializeResultKey(makeResultKey(snapshot, undefined, inner.engineVersion))));
  });

  it('caches base and mutated calculations under distinct keys', async () => {
    const inner = new CountingEngine();
    const cached = withCache(inner, new InMemoryCalculationResultStore());
    const snapshot = createBuildSnapshot(twoLoadoutInput());
    const mutation = createBuildMutation(twoLoadoutMutation(snapshot.identity));

    await cached.calculate(snapshot); // miss → compute
    await cached.calculate(snapshot, mutation); // different key → miss → compute
    await cached.calculate(snapshot); // hit
    await cached.calculate(snapshot, mutation); // hit

    expect(inner.calls).toBe(2);
  });

  it('does not collide across different snapshots', async () => {
    const inner = new CountingEngine();
    const cached = withCache(inner, new InMemoryCalculationResultStore());

    await cached.calculate(createBuildSnapshot(twoLoadoutInput()));
    await cached.calculate(createBuildSnapshot(minimalInput()));

    expect(inner.calls).toBe(2);
  });

  it('exposes the wrapped engine version', () => {
    const cached = new CachingEngineAdapter(new CountingEngine(), new InMemoryCalculationResultStore());
    expect(cached.engineVersion).toBe('counting-1');
  });
});

describe('serializeResultKey', () => {
  it('distinguishes present vs absent mutationId', () => {
    const base = serializeResultKey({ snapshotId: 's', engineVersion: 'v' });
    const mutated = serializeResultKey({ snapshotId: 's', mutationId: 'm', engineVersion: 'v' });
    expect(base).not.toBe(mutated);
  });
});
