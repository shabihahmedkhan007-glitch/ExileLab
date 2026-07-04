// Multi-source Comparative Optimization: diff a user's build against several
// public builds of the same archetype, then flag changes that recur across
// MULTIPLE sources as community-validated (PRODUCT_PLAN "Statistically common
// choices across sources rank higher (community-validated)"; Phase 3 "community
// consensus boost").

import type { BuildSnapshot } from "./model.js";
import type { SnapshotDiff, Candidate } from "./diff.js";
import { diffSnapshots, changeKey } from "./diff.js";

/** One public build to compare the user's build against. */
export interface CompareSource {
  /** Stable id for this source (used to count distinct sources for consensus). */
  readonly sourceId: string;
  readonly snapshot: BuildSnapshot;
}

/** The user↔one-source diff, tagged with which source produced it. */
export interface SourceDiff {
  readonly sourceId: string;
  readonly diff: SnapshotDiff;
}

/**
 * A candidate change that appears across two or more sources. The shared
 * `changeKey` means every listed source independently diverges from the user in
 * the same way — the signal that ranks it as community-validated.
 */
export interface ConsensusChange {
  readonly changeKey: string;
  /** Distinct source ids that share this change (length ≥ threshold). */
  readonly sourceIds: readonly string[];
  /** How many distinct sources share it. */
  readonly sourceCount: number;
  /** A representative candidate BuildMutation (against the user's snapshot). */
  readonly candidate: Candidate;
  /** True once `sourceCount` meets the consensus threshold. */
  readonly communityValidated: true;
}

export interface MultiCompareResult {
  readonly userId: string;
  /** Per-source diffs, in input order. */
  readonly perSource: readonly SourceDiff[];
  /** Community-validated changes, most-corroborated first. */
  readonly consensus: readonly ConsensusChange[];
}

/**
 * Compare the user's build against many public builds of the same archetype.
 *
 * Produces a per-source diff (each candidate stamped with that source's
 * Provenance for attribution) plus a consensus annotation: any candidate change
 * whose `changeKey` recurs across at least `threshold` distinct sources is
 * flagged community-validated.
 *
 * @param threshold Minimum distinct sources sharing a change to reach consensus
 *   (default 2 — "2 of 3 sources share a difference").
 */
export function compareMany(
  user: BuildSnapshot,
  others: readonly CompareSource[],
  threshold = 2,
): MultiCompareResult {
  const perSource: SourceDiff[] = others.map((source) => ({
    sourceId: source.sourceId,
    diff: diffSnapshots(user, source.snapshot, source.snapshot.metadata.provenance),
  }));

  // Group candidates by semantic change key, tracking which distinct sources
  // exhibit each. A single source is counted once per change key even if it
  // somehow emits it twice.
  interface Bucket {
    readonly changeKey: string;
    readonly sourceIds: Set<string>;
    candidate: Candidate;
  }
  const buckets = new Map<string, Bucket>();

  for (const { sourceId, diff } of perSource) {
    for (const cand of diff.candidates) {
      const op = cand.operations[0];
      if (op === undefined) continue;
      const key = changeKey(op);
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        bucket = { changeKey: key, sourceIds: new Set(), candidate: cand };
        buckets.set(key, bucket);
      }
      bucket.sourceIds.add(sourceId);
    }
  }

  const consensus: ConsensusChange[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.sourceIds.size >= threshold) {
      consensus.push({
        changeKey: bucket.changeKey,
        sourceIds: [...bucket.sourceIds].sort(),
        sourceCount: bucket.sourceIds.size,
        // Attribution to a single source is meaningless for a consensus change.
        candidate: { ...bucket.candidate, origin: undefined },
        communityValidated: true,
      });
    }
  }
  // Most-corroborated first; stable tiebreak by changeKey.
  consensus.sort((x, y) => y.sourceCount - x.sourceCount || x.changeKey.localeCompare(y.changeKey));

  return { userId: user.identity, perSource, consensus };
}
