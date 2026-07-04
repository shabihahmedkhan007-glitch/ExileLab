// @exilelab/engine-adapter — Calculation Result cache (RFC-0001 AD-2 / AD-7).
//
// Every downstream cache keys off snapshot identity plus the version of whatever
// produced the artifact. Engine results are keyed by
// `(snapshotId, mutationId?, engineVersion)`. The store is INJECTABLE so the
// same caching adapter works over an in-memory map today and a Redis/Postgres
// store later; only the in-memory impl ships here.

import type {
  BuildSnapshot,
  BuildMutation,
  CalculationResult,
} from '@exilelab/core';
import type { EngineAdapter } from './adapter.js';
import { makeResultKey, serializeResultKey } from './adapter.js';

/**
 * Pluggable Calculation Result store. Async-shaped so a real backing store
 * (Redis, Postgres) satisfies it without changing the caching adapter. Keys are
 * the serialized form of the `(snapshotId, mutationId?, engineVersion)` triple.
 */
export interface CalculationResultStore {
  get(key: string): Promise<CalculationResult | undefined>;
  set(key: string, result: CalculationResult): Promise<void>;
}

/** Simple in-memory {@link CalculationResultStore} backed by a Map. */
export class InMemoryCalculationResultStore implements CalculationResultStore {
  readonly #map = new Map<string, CalculationResult>();

  async get(key: string): Promise<CalculationResult | undefined> {
    return this.#map.get(key);
  }

  async set(key: string, result: CalculationResult): Promise<void> {
    this.#map.set(key, result);
  }

  /** Current number of cached results (test/introspection helper). */
  get size(): number {
    return this.#map.size;
  }

  /** Drop all cached results. */
  clear(): void {
    this.#map.clear();
  }
}

/**
 * An {@link EngineAdapter} that short-circuits repeat calculations through a
 * {@link CalculationResultStore}. On a cache hit it returns the stored result
 * without invoking the wrapped engine; on a miss it delegates, stores, and
 * returns. The cache key is the `(snapshotId, mutationId?, engineVersion)`
 * triple of the wrapped engine — so results for different engine versions or
 * different candidate mutations never collide.
 */
export class CachingEngineAdapter implements EngineAdapter {
  readonly #inner: EngineAdapter;
  readonly #store: CalculationResultStore;

  constructor(inner: EngineAdapter, store: CalculationResultStore) {
    this.#inner = inner;
    this.#store = store;
  }

  get engineVersion(): string {
    return this.#inner.engineVersion;
  }

  async calculate(snapshot: BuildSnapshot, mutation?: BuildMutation): Promise<CalculationResult> {
    const key = serializeResultKey(makeResultKey(snapshot, mutation, this.#inner.engineVersion));
    const hit = await this.#store.get(key);
    if (hit !== undefined) return hit;

    const result = await this.#inner.calculate(snapshot, mutation);
    await this.#store.set(key, result);
    return result;
  }
}

/** Convenience: wrap an adapter with a caching layer over the given store. */
export function withCache(inner: EngineAdapter, store: CalculationResultStore): EngineAdapter {
  return new CachingEngineAdapter(inner, store);
}
