import { describe, it, expect } from 'vitest';
import { createBuildSnapshot } from './snapshot.js';
import { sampleSnapshotInput } from './test-fixtures.js';

describe('Immutability (RFC-0001 I1)', () => {
  it('deep-freezes the whole snapshot graph', () => {
    const snap = createBuildSnapshot(sampleSnapshotInput());
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.buildState)).toBe(true);
    expect(Object.isFrozen(snap.buildState.character)).toBe(true);
    expect(Object.isFrozen(snap.buildState.loadoutContexts)).toBe(true);
    expect(Object.isFrozen(snap.buildState.loadoutContexts[0])).toBe(true);
    expect(Object.isFrozen(snap.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes)).toBe(true);
    expect(Object.isFrozen(snap.metadata)).toBe(true);
    expect(Object.isFrozen(snap.displayCache)).toBe(true);
  });

  it('throws on top-level field mutation in strict mode', () => {
    const snap = createBuildSnapshot(sampleSnapshotInput());
    expect(() => {
      (snap as unknown as { identity: string }).identity = 'tampered';
    }).toThrow(TypeError);
  });

  it('throws on nested field mutation in strict mode', () => {
    const snap = createBuildSnapshot(sampleSnapshotInput());
    expect(() => {
      (snap.buildState.character as unknown as { level: number }).level = 99;
    }).toThrow(TypeError);
  });

  it('throws when pushing onto a frozen array', () => {
    const snap = createBuildSnapshot(sampleSnapshotInput());
    expect(() => {
      (snap.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes as number[]).push(1);
    }).toThrow(TypeError);
  });

  it('does not retain or mutate the caller input object', () => {
    const input = sampleSnapshotInput();
    const snap = createBuildSnapshot(input);
    // Input remains mutable and independent of the frozen snapshot.
    expect(Object.isFrozen(input.buildState)).toBe(false);
    input.buildState.character.level = 1;
    expect(snap.buildState.character.level).toBe(92);
  });
});
