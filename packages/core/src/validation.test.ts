import { describe, it, expect } from 'vitest';
import { createBuildSnapshot } from './snapshot.js';
import { createCalculationResult, createRawImportArtifact } from './artifacts.js';
import { sampleSnapshotInput } from './test-fixtures.js';

describe('Schema validation (I3/I4, AD-5)', () => {
  it('rejects a build with no loadout context', () => {
    const input = sampleSnapshotInput();
    input.buildState.loadoutContexts = [];
    expect(() => createBuildSnapshot(input)).toThrow();
  });

  it('rejects a build with more than one primary loadout context', () => {
    const input = sampleSnapshotInput();
    input.buildState.loadoutContexts = input.buildState.loadoutContexts.map((lc) => ({ ...lc, primary: true }));
    expect(() => createBuildSnapshot(input)).toThrow(/primary/);
  });

  it('rejects a build with no primary loadout context', () => {
    const input = sampleSnapshotInput();
    input.buildState.loadoutContexts = input.buildState.loadoutContexts.map((lc) => ({ ...lc, primary: false }));
    expect(() => createBuildSnapshot(input)).toThrow(/primary/);
  });

  it('rejects duplicate loadout context ids', () => {
    const input = sampleSnapshotInput();
    const lc = input.buildState.loadoutContexts[0]!;
    input.buildState.loadoutContexts = [lc, { ...lc, primary: false }];
    expect(() => createBuildSnapshot(input)).toThrow();
  });

  it('rejects unknown assumption origin', () => {
    const input = sampleSnapshotInput();
    // @ts-expect-error deliberately invalid origin
    input.buildState.assumptions = [{ path: 'x', origin: 'guessed' }];
    expect(() => createBuildSnapshot(input)).toThrow();
  });
});

describe('Separate downstream artifacts (AD-7, AD-4)', () => {
  it('validates and freezes a Calculation Result keyed by snapshot × engine version', () => {
    const result = createCalculationResult({
      key: { snapshotId: 'abc', mutationId: 'def', engineVersion: 'pob2-0.7.0' },
      metrics: { dps: 1234.5, ehp: 5000 },
      computedAt: '2026-07-04T00:00:00.000Z',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.key.engineVersion).toBe('pob2-0.7.0');
  });

  it('validates and freezes a Raw Import Artifact with a retention note', () => {
    const artifact = createRawImportArtifact({
      artifactId: 'raw-1',
      source: 'pob-code',
      fetchedAt: '2026-07-04T00:00:00.000Z',
      payload: 'eNpb...==',
      retention: { expiresAt: '2026-10-02T00:00:00.000Z', note: '~90-day working default (OQ-1)' },
    });
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(artifact.retention.note).toContain('90-day');
  });
});
