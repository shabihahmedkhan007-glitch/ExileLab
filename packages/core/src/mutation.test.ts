import { describe, it, expect } from 'vitest';
import { createBuildSnapshot } from './snapshot.js';
import { createBuildMutation, promoteMutation } from './mutation.js';
import { sampleSnapshotInput } from './test-fixtures.js';

describe('BuildMutation + promotion (RFC-0001 AD-2)', () => {
  it('computes a deterministic mutationId', () => {
    const m1 = createBuildMutation({
      baseSnapshotId: 'base',
      operations: [{ kind: 'allocatePassiveNode', loadoutContextId: 'set-a', nodeId: 500 }],
    });
    const m2 = createBuildMutation({
      baseSnapshotId: 'base',
      operations: [{ kind: 'allocatePassiveNode', loadoutContextId: 'set-a', nodeId: 500 }],
    });
    expect(m1.mutationId).toBe(m2.mutationId);
    expect(m1.mutationId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a new snapshot with a new identity and leaves the base untouched', () => {
    const base = createBuildSnapshot(sampleSnapshotInput());
    const mutation = createBuildMutation({
      baseSnapshotId: base.identity,
      operations: [{ kind: 'allocatePassiveNode', loadoutContextId: 'set-a', nodeId: 424242 }],
    });

    const beforeNodes = [...base.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes];
    const promoted = promoteMutation(base, mutation);

    expect(promoted).not.toBe(base);
    expect(promoted.identity).not.toBe(base.identity);
    // Base is unchanged (I1).
    expect([...base.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes]).toEqual(beforeNodes);
    // New snapshot carries the allocation.
    expect(promoted.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes).toContain(424242);
    // Provenance records the promotion.
    expect(promoted.metadata.provenance.source).toBe('promoted-mutation');
    expect(promoted.metadata.provenance.reference).toBe(mutation.mutationId);
    // Result is frozen.
    expect(Object.isFrozen(promoted.buildState)).toBe(true);
  });

  it('a no-op mutation promotes to a snapshot with the SAME identity (I2)', () => {
    const base = createBuildSnapshot(sampleSnapshotInput());
    // Node 7 already exists in set-a; allocating it again is a no-op on build state.
    const mutation = createBuildMutation({
      baseSnapshotId: base.identity,
      operations: [{ kind: 'allocatePassiveNode', loadoutContextId: 'set-a', nodeId: 7 }],
    });
    const promoted = promoteMutation(base, mutation);
    expect(promoted.identity).toBe(base.identity);
  });

  it('applies each operation kind', () => {
    const base = createBuildSnapshot(sampleSnapshotInput());
    const mutation = createBuildMutation({
      baseSnapshotId: base.identity,
      operations: [
        { kind: 'deallocatePassiveNode', loadoutContextId: 'set-a', nodeId: 55 },
        { kind: 'swapItem', loadoutContextId: 'set-a', item: { slot: 'helmet', itemRef: 'new_helm', rarity: 'unique', modifiers: ['+100 life'] } },
        { kind: 'changeGem', loadoutContextId: 'set-a', setupId: 'main', skillGemRef: 'lightning_spear' },
        { kind: 'changeSupport', loadoutContextId: 'set-a', setupId: 'main', removeSupportRef: 'added_cold', addSupportRef: 'added_light' },
        { kind: 'changeConfig', key: 'enemy.isBoss', value: false },
        { kind: 'changeConfig', key: 'new.key', value: 42 },
      ],
    });

    const p = promoteMutation(base, mutation);
    const lc = p.buildState.loadoutContexts.find((c) => c.contextId === 'set-a')!;
    expect(lc.passiveTree.allocatedNodes).not.toContain(55);
    expect(lc.equipment.find((e) => e.slot === 'helmet')!.itemRef).toBe('new_helm');
    const setup = lc.skills.find((s) => s.setupId === 'main')!;
    expect(setup.skillGemRef).toBe('lightning_spear');
    expect(setup.supports).toContain('added_light');
    expect(setup.supports).not.toContain('added_cold');
    expect(p.buildState.configuration.find((c) => c.key === 'enemy.isBoss')!.value).toBe(false);
    expect(p.buildState.configuration.find((c) => c.key === 'new.key')!.value).toBe(42);
  });

  it('throws when the mutation base does not match the snapshot identity', () => {
    const base = createBuildSnapshot(sampleSnapshotInput());
    const mutation = createBuildMutation({
      baseSnapshotId: 'not-the-base',
      operations: [{ kind: 'changeConfig', key: 'x', value: 1 }],
    });
    expect(() => promoteMutation(base, mutation)).toThrow(/does not match/);
  });

  it('throws when an operation targets a missing loadout', () => {
    const base = createBuildSnapshot(sampleSnapshotInput());
    const mutation = createBuildMutation({
      baseSnapshotId: base.identity,
      operations: [{ kind: 'allocatePassiveNode', loadoutContextId: 'nope', nodeId: 1 }],
    });
    expect(() => promoteMutation(base, mutation)).toThrow(/Loadout Context/);
  });

  it('two promotions of the same base+mutation yield equal identities (reproducibility)', () => {
    const base = createBuildSnapshot(sampleSnapshotInput());
    const mutation = createBuildMutation({
      baseSnapshotId: base.identity,
      operations: [{ kind: 'changeConfig', key: 'enemy.level', value: 85 }],
    });
    expect(promoteMutation(base, mutation).identity).toBe(promoteMutation(base, mutation).identity);
  });
});
