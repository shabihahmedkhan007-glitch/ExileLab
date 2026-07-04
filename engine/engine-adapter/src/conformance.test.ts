import { describe, it, expect } from 'vitest';
import type { BuildSnapshot, BuildMutation, CalculationResult } from '@exilelab/core';
import { createCalculationResult } from '@exilelab/core';
import type { EngineAdapter } from './adapter.js';
import { makeResultKey } from './adapter.js';
import { runConformanceSuite, runFixture } from './conformance.js';
import { MockEngine, MOCK_COMPUTED_AT } from './mock-engine.js';
import { mockEngineFixtures } from './fixtures.js';

describe('conformance runner — the honest engine', () => {
  it('passes the MockEngine against its own golden fixtures', async () => {
    const report = await runConformanceSuite(new MockEngine(), mockEngineFixtures());
    expect(report.passed).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.total).toBe(3);
    expect(report.outcomes.every((o) => o.passed)).toBe(true);
  });

  it('checks the result key contract (base + mutated fixtures)', async () => {
    const report = await runConformanceSuite(new MockEngine(), mockEngineFixtures());
    const mutated = report.outcomes.find((o) => o.name === 'two-loadout-mutated')!;
    expect(mutated.passed).toBe(true);
    expect(mutated.key.mutationId).toBeDefined();
  });
});

/** A deliberately-wrong adapter: every metric is doubled. Must FAIL conformance. */
class WrongEngine implements EngineAdapter {
  readonly engineVersion = 'mock-1';
  readonly #inner = new MockEngine({ engineVersion: 'mock-1' });

  async calculate(snapshot: BuildSnapshot, mutation?: BuildMutation): Promise<CalculationResult> {
    const honest = await this.#inner.calculate(snapshot, mutation);
    const wrong: Record<string, number> = {};
    for (const [k, v] of Object.entries(honest.metrics)) wrong[k] = v * 2 + 1;
    return createCalculationResult({ key: honest.key, metrics: wrong, computedAt: MOCK_COMPUTED_AT });
  }
}

/** An adapter that returns a wrong result KEY (right metrics). Must FAIL. */
class WrongKeyEngine implements EngineAdapter {
  readonly engineVersion = 'mock-1';
  readonly #inner = new MockEngine({ engineVersion: 'mock-1' });

  async calculate(snapshot: BuildSnapshot, mutation?: BuildMutation): Promise<CalculationResult> {
    const honest = await this.#inner.calculate(snapshot, mutation);
    return createCalculationResult({
      key: makeResultKey(snapshot, mutation, 'some-other-version'),
      metrics: honest.metrics,
      computedAt: MOCK_COMPUTED_AT,
    });
  }
}

describe('conformance runner — the dishonest engines', () => {
  it('FAILS a deliberately-wrong adapter and reports mismatches', async () => {
    const report = await runConformanceSuite(new WrongEngine(), mockEngineFixtures());
    expect(report.passed).toBe(false);
    expect(report.failed).toBe(report.total);
    const first = report.outcomes[0]!;
    expect(first.mismatches.length).toBeGreaterThan(0);
    const dps = first.mismatches.find((m) => m.metric === 'dps')!;
    expect(dps.actual).not.toBe(dps.expected);
  });

  it('FAILS an adapter that returns the wrong result key', async () => {
    const report = await runConformanceSuite(new WrongKeyEngine(), mockEngineFixtures());
    expect(report.passed).toBe(false);
    expect(report.outcomes.every((o) => o.error !== undefined)).toBe(true);
  });

  it('records a thrown adapter as a failed outcome (does not throw)', async () => {
    const thrower: EngineAdapter = {
      engineVersion: 'mock-1',
      calculate: () => Promise.reject(new Error('engine exploded')),
    };
    const outcome = await runFixture(thrower, mockEngineFixtures()[0]!);
    expect(outcome.passed).toBe(false);
    expect(outcome.error).toContain('engine exploded');
  });
});

describe('conformance runner — tolerance', () => {
  it('accepts small deviations within a relative tolerance band', async () => {
    // Nudge every metric by ~1% and allow 5% tolerance.
    const nudger: EngineAdapter = {
      engineVersion: 'mock-1',
      calculate: async (s, m) => {
        const honest = await new MockEngine({ engineVersion: 'mock-1' }).calculate(s, m);
        const nudged: Record<string, number> = {};
        for (const [k, v] of Object.entries(honest.metrics)) nudged[k] = v * 1.01;
        return createCalculationResult({ key: honest.key, metrics: nudged, computedAt: MOCK_COMPUTED_AT });
      },
    };
    const tolerant = mockEngineFixtures().map((f) => ({ ...f, tolerance: 0.05 }));
    const report = await runConformanceSuite(nudger, tolerant);
    expect(report.passed).toBe(true);
  });
});
