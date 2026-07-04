// Canonical Identity (RFC-0001 I2): identical canonical build state ⇒ identical
// identity, regardless of source or import time. Metadata, Display Cache,
// Provenance and Assumptions are excluded. Canonicalization is a first-class
// normalizer responsibility (risk R4: hash instability), not a serialization
// afterthought — so we build an explicitly ordered structure before hashing.

import { createHash } from "node:crypto";
import type { Character, LoadoutContext, Versioning } from "./model.js";

/** Recursively sort object keys so JSON serialization is order-independent. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Build the identity-participating projection of a snapshot's build state. Only
 * Character + Versioning + per-loadout build state; ordered deterministically.
 * Loadouts are sorted by id; allocated node ids are sorted numerically.
 */
function identityProjection(
  character: Character,
  loadouts: readonly LoadoutContext[],
  versioning: Versioning,
): unknown {
  const loadoutProjection = [...loadouts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((l) => ({
      id: l.id,
      primary: l.primary,
      allocatedNodeIds: [...l.passiveTree.allocatedNodeIds].sort((a, b) => a - b),
      equipment: [...l.equipment]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((it) => ({
          id: it.id,
          slot: it.slot,
          name: it.name,
          rarity: it.rarity,
          lines: it.lines,
        })),
      skills: [...l.skills]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((g) => ({
          id: g.id,
          isMain: g.isMain,
          gems: g.gems.map((gem) => ({
            name: gem.name,
            skillId: gem.skillId,
            level: gem.level,
            quality: gem.quality,
          })),
        })),
      configuration: l.configuration,
      resources: l.resources,
    }));

  return canonicalize({
    character: {
      className: character.className,
      ascendancyName: character.ascendancyName,
      level: character.level,
    },
    versioning: {
      gamePatch: versioning.gamePatch,
      snapshotFormatVersion: versioning.snapshotFormatVersion,
    },
    loadouts: loadoutProjection,
  });
}

/** Compute the deterministic Canonical Identity for a snapshot's build state. */
export function computeIdentity(
  character: Character,
  loadouts: readonly LoadoutContext[],
  versioning: Versioning,
): string {
  const projection = identityProjection(character, loadouts, versioning);
  const serialized = JSON.stringify(projection);
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  return `bs1-${digest}`;
}
