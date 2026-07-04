import { describe, it, expect } from "vitest";
import { compareMany } from "./compare.js";
import { promoteMutation } from "./model.js";
import { userBuild, maxrollBuild, ninjaBuild, mobalyticsBuild } from "./__fixtures__/snapshots.js";

describe("compareMany", () => {
  const result = compareMany(userBuild, [
    { sourceId: "maxroll", snapshot: maxrollBuild },
    { sourceId: "poe.ninja", snapshot: ninjaBuild },
    { sourceId: "mobalytics", snapshot: mobalyticsBuild },
  ]);

  it("produces one diff per source, in order", () => {
    expect(result.perSource.map((s) => s.sourceId)).toEqual(["maxroll", "poe.ninja", "mobalytics"]);
  });

  it("stamps per-source candidates with that source provenance for attribution", () => {
    const maxroll = result.perSource.find((s) => s.sourceId === "maxroll")!;
    for (const cand of maxroll.diff.candidates) {
      expect(cand.origin?.source).toBe("maxroll");
    }
  });

  it("flags consensus when 2 of 3 sources share a difference", () => {
    // Shared by maxroll + poe.ninja: allocate 300, allocate 301, dealloc 201, skill swap.
    expect(result.consensus.length).toBeGreaterThan(0);
    for (const c of result.consensus) {
      expect(c.communityValidated).toBe(true);
      expect(c.sourceCount).toBeGreaterThanOrEqual(2);
    }

    const allocate300 = result.consensus.find((c) => c.changeKey === `alloc:primary:300`);
    expect(allocate300).toBeDefined();
    expect(allocate300!.sourceIds).toEqual(["maxroll", "poe.ninja"]);
    expect(allocate300!.sourceCount).toBe(2);

    const skillSwap = result.consensus.find((c) => c.changeKey.startsWith("support:primary:weapon1:"));
    expect(skillSwap).toBeDefined();
    expect(skillSwap!.sourceIds).toEqual(["maxroll", "poe.ninja"]);
  });

  it("does NOT flag single-source-only differences as consensus", () => {
    // node 400 is only in poe.ninja; node 500 only in mobalytics; body/config only in maxroll.
    expect(result.consensus.some((c) => c.changeKey === "alloc:primary:400")).toBe(false);
    expect(result.consensus.some((c) => c.changeKey === "alloc:primary:500")).toBe(false);
    expect(result.consensus.some((c) => c.changeKey === "config:shockedEnemy:true")).toBe(false);
  });

  it("every consensus candidate is a promotable BuildMutation against the user snapshot", () => {
    for (const c of result.consensus) {
      expect(c.candidate.baseSnapshotId).toBe(userBuild.identity);
      const promoted = promoteMutation(userBuild, c.candidate);
      expect(promoted.identity).not.toBe(userBuild.identity);
    }
  });

  it("ranks more-corroborated changes first", () => {
    const counts = result.consensus.map((c) => c.sourceCount);
    const sorted = [...counts].sort((a, b) => b - a);
    expect(counts).toEqual(sorted);
  });

  it("with a single source, nothing reaches consensus", () => {
    const solo = compareMany(userBuild, [{ sourceId: "maxroll", snapshot: maxrollBuild }]);
    expect(solo.consensus).toEqual([]);
  });
});
