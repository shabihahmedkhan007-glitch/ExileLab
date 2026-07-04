import { describe, it, expect } from "vitest";
import { diffSnapshots, isEmptyDiff } from "./diff.js";
import { promoteMutation, getPrimaryLoadout } from "./model.js";
import { userBuild, maxrollBuild } from "./__fixtures__/snapshots.js";

describe("diffSnapshots — golden diff (user vs maxroll)", () => {
  const diff = diffSnapshots(userBuild, maxrollBuild);

  it("reports the exact passive tree node sets", () => {
    expect(diff.passiveTree.onlyInA).toEqual([201]);
    expect(diff.passiveTree.onlyInB).toEqual([300, 301]);
    expect(diff.passiveTree.shared).toEqual([101, 102, 103, 200]);
  });

  it("reports the exact gear slot diffs", () => {
    const body = diff.gear.find((g) => g.slot === "body");
    const weapon = diff.gear.find((g) => g.slot === "weapon1");
    expect(weapon?.status).toBe("unchanged");
    expect(body?.status).toBe("changed");
    expect(body?.addedModLines).toEqual(["+25% to Fire Resistance"]);
    expect(body?.removedModLines).toEqual([]);
  });

  it("reports the exact skill setup diffs", () => {
    const weaponSkill = diff.skills.find((s) => s.setupId === "weapon1");
    const boots = diff.skills.find((s) => s.setupId === "boots");
    expect(weaponSkill?.status).toBe("changed");
    expect(weaponSkill?.b?.supports).toContain("Ancestral Urgency");
    expect(boots?.status).toBe("unchanged");
  });

  it("reports the exact config diffs", () => {
    const shocked = diff.config.find((c) => c.key === "shockedEnemy");
    const level = diff.config.find((c) => c.key === "enemyLevel");
    expect(shocked?.status).toBe("changed");
    expect(shocked?.a).toBe(false);
    expect(shocked?.b).toBe(true);
    expect(level?.status).toBe("unchanged");
  });

  it("emits one candidate per meaningful difference (core op vocabulary)", () => {
    // 2 node allocations + 1 node deallocation + 1 gear swap + 1 support-add +
    // 1 support-remove + 1 config change = 7 atomic, promotable ops.
    expect(diff.candidates).toHaveLength(7);
    const kinds = diff.candidates.map((c) => c.operations[0]!.kind).sort();
    expect(kinds).toEqual([
      "allocatePassiveNode",
      "allocatePassiveNode",
      "changeConfig",
      "changeSupport",
      "changeSupport",
      "deallocatePassiveNode",
      "swapItem",
    ]);
  });

  it("emits every candidate as a core BuildMutation against snapshot A", () => {
    for (const cand of diff.candidates) {
      expect(cand.baseSnapshotId).toBe(userBuild.identity);
      expect(cand.operations).toHaveLength(1);
      expect(cand.mutationId).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("diffSnapshots — identity", () => {
  it("diff(a, a) is empty", () => {
    const diff = diffSnapshots(userBuild, userBuild);
    expect(diff.passiveTree.onlyInA).toEqual([]);
    expect(diff.passiveTree.onlyInB).toEqual([]);
    expect(diff.candidates).toEqual([]);
    expect(isEmptyDiff(diff)).toBe(true);
    expect(diff.gear.every((g) => g.status === "unchanged")).toBe(true);
    expect(diff.skills.every((s) => s.status === "unchanged")).toBe(true);
    expect(diff.config.every((c) => c.status === "unchanged")).toBe(true);
  });
});

describe("candidates are promotable", () => {
  const diff = diffSnapshots(userBuild, maxrollBuild);

  it("every emitted candidate is a valid BuildMutation that promoteMutation accepts", () => {
    for (const cand of diff.candidates) {
      const promoted = promoteMutation(userBuild, cand);
      // Promotion yields a NEW immutable snapshot with a fresh identity.
      expect(promoted.identity).not.toBe(userBuild.identity);
      expect(promoted).not.toBe(userBuild);
      // The base is never mutated.
      expect(getPrimaryLoadout(userBuild)!.passiveTree.allocatedNodes).toEqual([
        101, 102, 103, 200, 201,
      ]);
    }
  });

  it('promoting the "adopt node 300" candidate allocates it', () => {
    const allocate300 = diff.candidates.find(
      (c) =>
        c.operations[0]!.kind === "allocatePassiveNode" &&
        (c.operations[0] as { nodeId: number }).nodeId === 300,
    );
    expect(allocate300).toBeDefined();
    const promoted = promoteMutation(userBuild, allocate300!);
    expect(getPrimaryLoadout(promoted)!.passiveTree.allocatedNodes).toContain(300);
  });

  it("promoting a foreign mutation throws (base identity mismatch)", () => {
    const cand = diff.candidates[0]!;
    expect(() => promoteMutation(maxrollBuild, cand)).toThrow(/does not match/);
  });

  it("promotion of the same candidate is deterministic (stable identity)", () => {
    const cand = diff.candidates[0]!;
    const p1 = promoteMutation(userBuild, cand);
    const p2 = promoteMutation(userBuild, cand);
    expect(p1.identity).toBe(p2.identity);
  });
});
