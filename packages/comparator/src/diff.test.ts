import { describe, it, expect } from 'vitest';
import { diffSnapshots, isEmptyDiff } from './diff.js';
import { promoteMutation, MutationBaseMismatchError } from './model.js';
import { userBuild, maxrollBuild } from './__fixtures__/snapshots.js';

describe('diffSnapshots — golden diff (user vs maxroll)', () => {
  const diff = diffSnapshots(userBuild, maxrollBuild);

  it('reports the exact passive tree node sets', () => {
    expect(diff.passiveTree.onlyInA).toEqual([201]);
    expect(diff.passiveTree.onlyInB).toEqual([300, 301]);
    expect(diff.passiveTree.shared).toEqual([101, 102, 103, 200]);
  });

  it('reports the exact gear slot diffs', () => {
    const body = diff.gear.find((g) => g.slot === 'body');
    const weapon = diff.gear.find((g) => g.slot === 'weapon1');
    expect(weapon?.status).toBe('unchanged');
    expect(body?.status).toBe('changed');
    expect(body?.addedModLines).toEqual(['+25% to Fire Resistance']);
    expect(body?.removedModLines).toEqual([]);
  });

  it('reports the exact skill setup diffs', () => {
    const weaponSkill = diff.skills.find((s) => s.socketGroup === 'weapon1');
    const boots = diff.skills.find((s) => s.socketGroup === 'boots');
    expect(weaponSkill?.status).toBe('changed');
    expect(weaponSkill?.b?.gems).toContain('Ancestral Urgency');
    expect(boots?.status).toBe('unchanged');
  });

  it('reports the exact config diffs', () => {
    const shocked = diff.config.find((c) => c.key === 'shockedEnemy');
    const level = diff.config.find((c) => c.key === 'enemyLevel');
    expect(shocked?.status).toBe('changed');
    expect(shocked?.a).toBe(false);
    expect(shocked?.b).toBe(true);
    expect(level?.status).toBe('unchanged');
  });

  it('emits one candidate per meaningful difference', () => {
    // 2 node allocations + 1 node deallocation + 1 gear + 1 skill + 1 config
    expect(diff.candidates).toHaveLength(6);
    const kinds = diff.candidates.map((c) => c.ops[0]!.kind).sort();
    expect(kinds).toEqual([
      'allocateNode',
      'allocateNode',
      'deallocateNode',
      'setConfig',
      'setGear',
      'setSkill',
    ]);
  });

  it('emits every candidate as a BuildMutation against snapshot A', () => {
    for (const cand of diff.candidates) {
      expect(cand.baseSnapshotId).toBe(userBuild.id);
      expect(cand.ops).toHaveLength(1);
      expect(cand.id).toMatch(/^mut_/);
    }
  });
});

describe('diffSnapshots — identity', () => {
  it('diff(a, a) is empty', () => {
    const diff = diffSnapshots(userBuild, userBuild);
    expect(diff.passiveTree.onlyInA).toEqual([]);
    expect(diff.passiveTree.onlyInB).toEqual([]);
    expect(diff.candidates).toEqual([]);
    expect(isEmptyDiff(diff)).toBe(true);
    expect(diff.gear.every((g) => g.status === 'unchanged')).toBe(true);
    expect(diff.skills.every((s) => s.status === 'unchanged')).toBe(true);
    expect(diff.config.every((c) => c.status === 'unchanged')).toBe(true);
  });
});

describe('candidates are promotable', () => {
  const diff = diffSnapshots(userBuild, maxrollBuild);

  it('every emitted candidate is a valid BuildMutation that promoteMutation accepts', () => {
    for (const cand of diff.candidates) {
      const promoted = promoteMutation(userBuild, cand);
      // Promotion yields a NEW immutable snapshot with a fresh identity.
      expect(promoted.id).not.toBe(userBuild.id);
      expect(promoted).not.toBe(userBuild);
      // The base is never mutated.
      expect(userBuild.loadouts[0]!.allocatedNodes).toEqual([101, 102, 103, 200, 201]);
    }
  });

  it('promoting the "adopt node 300" candidate allocates it', () => {
    const allocate300 = diff.candidates.find(
      (c) => c.ops[0]!.kind === 'allocateNode' && c.ops[0]!.kind === 'allocateNode' && (c.ops[0] as { nodeId: number }).nodeId === 300,
    );
    expect(allocate300).toBeDefined();
    const promoted = promoteMutation(userBuild, allocate300!);
    expect(promoted.loadouts[0]!.allocatedNodes).toContain(300);
  });

  it('promoting a foreign mutation throws MutationBaseMismatchError', () => {
    const cand = diff.candidates[0]!;
    expect(() => promoteMutation(maxrollBuild, cand)).toThrow(MutationBaseMismatchError);
  });

  it('promotion of the same candidate is deterministic (stable identity)', () => {
    const cand = diff.candidates[0]!;
    const p1 = promoteMutation(userBuild, cand);
    const p2 = promoteMutation(userBuild, cand);
    expect(p1.id).toBe(p2.id);
  });
});
