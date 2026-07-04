import { describe, it, expect } from 'vitest';
import { createBuildSnapshot } from './snapshot.js';
import { computeBuildStateIdentity } from './canonical.js';
import type { BuildSnapshotInput } from './types.js';
import { sampleSnapshotInput } from './test-fixtures.js';

describe('Canonical Identity (RFC-0001 I2)', () => {
  it('is stable under object key reordering', () => {
    const a = sampleSnapshotInput();

    // Same build state, but with object keys authored in a different order and
    // nested objects rebuilt with shuffled keys.
    const b: BuildSnapshotInput = {
      displayCache: a.displayCache,
      metadata: a.metadata,
      buildState: {
        assumptions: a.buildState.assumptions,
        configuration: a.buildState.configuration,
        loadoutContexts: a.buildState.loadoutContexts.map((lc) => ({
          skills: lc.skills,
          equipment: lc.equipment,
          passiveTree: lc.passiveTree,
          primary: lc.primary,
          contextId: lc.contextId,
        })),
        character: { level: a.buildState.character.level, ascendancy: a.buildState.character.ascendancy, class: a.buildState.character.class },
      },
    };

    expect(createBuildSnapshot(a).identity).toBe(createBuildSnapshot(b).identity);
  });

  it('is stable under reordering of order-insensitive arrays', () => {
    const a = sampleSnapshotInput();
    const b = sampleSnapshotInput();

    // Reverse allocated nodes, equipment, supports, configuration, assumptions,
    // and the loadout contexts themselves — none of these orderings are semantic.
    const lc0 = b.buildState.loadoutContexts[0]!;
    const mutated: BuildSnapshotInput = {
      ...b,
      buildState: {
        ...b.buildState,
        loadoutContexts: [...b.buildState.loadoutContexts].reverse().map((lc) => ({
          ...lc,
          passiveTree: {
            ...lc.passiveTree,
            allocatedNodes: [...lc.passiveTree.allocatedNodes].reverse(),
            masteryEffects: [...lc.passiveTree.masteryEffects].reverse(),
          },
          equipment: [...lc.equipment].reverse().map((e) => ({ ...e, modifiers: [...e.modifiers].reverse() })),
          skills: lc.skills.map((s) => ({ ...s, supports: [...s.supports].reverse() })),
        })),
        configuration: [...b.buildState.configuration].reverse(),
        assumptions: [...b.buildState.assumptions].reverse(),
      },
    };
    // touch lc0 so linter/reader sees intent; ordering above is what matters
    expect(lc0.contextId).toBeDefined();

    expect(createBuildSnapshot(mutated).identity).toBe(createBuildSnapshot(a).identity);
  });

  it('ignores Metadata changes', () => {
    const a = sampleSnapshotInput();
    const b = sampleSnapshotInput();
    b.metadata = {
      ...b.metadata,
      patchVersion: '9.9.9',
      formatVersion: '999',
      label: 'totally different label',
      league: 'Hardcore',
      provenance: { source: 'pobb.in', importedAt: '2099-01-01T00:00:00.000Z', reference: 'zzz' },
    };
    expect(createBuildSnapshot(b).identity).toBe(createBuildSnapshot(a).identity);
  });

  it('ignores DisplayCache changes', () => {
    const a = sampleSnapshotInput();
    const b = sampleSnapshotInput();
    b.displayCache = { names: { twister: 'Different Name' }, icons: {} };
    expect(createBuildSnapshot(b).identity).toBe(createBuildSnapshot(a).identity);
  });

  it('changes when build state changes (character level)', () => {
    const a = sampleSnapshotInput();
    const b = sampleSnapshotInput();
    b.buildState.character = { ...b.buildState.character, level: 93 };
    expect(createBuildSnapshot(b).identity).not.toBe(createBuildSnapshot(a).identity);
  });

  it('changes when a passive node is added to a loadout', () => {
    const a = sampleSnapshotInput();
    const b = sampleSnapshotInput();
    const lc = b.buildState.loadoutContexts[0]!;
    b.buildState.loadoutContexts = [
      { ...lc, passiveTree: { ...lc.passiveTree, allocatedNodes: [...lc.passiveTree.allocatedNodes, 9999] } },
      ...b.buildState.loadoutContexts.slice(1),
    ];
    expect(createBuildSnapshot(b).identity).not.toBe(createBuildSnapshot(a).identity);
  });

  it('changes when a configuration value changes (config is build state, R5)', () => {
    const a = sampleSnapshotInput();
    const b = sampleSnapshotInput();
    b.buildState.configuration = b.buildState.configuration.map((c) =>
      c.key === 'enemy.isBoss' ? { ...c, value: false } : c,
    );
    expect(createBuildSnapshot(b).identity).not.toBe(createBuildSnapshot(a).identity);
  });

  it('ignores Assumption origin differences — same build via different sources hashes identically (I2)', () => {
    // The exact same build imported as native JSON (origins 'imported') vs a
    // PoB code (some origins 'defaulted'/'inferred') MUST get the same identity:
    // Assumptions are snapshot context (RFC-0001 §5.3), not build state.
    const a = sampleSnapshotInput();
    const b = sampleSnapshotInput();
    b.buildState.assumptions = b.buildState.assumptions.map((s) => ({
      ...s,
      origin: s.origin === 'imported' ? 'defaulted' : 'imported',
      note: 'different importer fidelity',
    }));
    expect(createBuildSnapshot(b).identity).toBe(createBuildSnapshot(a).identity);

    // Entirely absent vs present assumption entries also must not re-key the build.
    const c = sampleSnapshotInput();
    c.buildState.assumptions = [];
    expect(createBuildSnapshot(c).identity).toBe(createBuildSnapshot(a).identity);
  });

  it('produces a lowercase sha256 hex digest', () => {
    const id = computeBuildStateIdentity(sampleSnapshotInput().buildState);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });
});
