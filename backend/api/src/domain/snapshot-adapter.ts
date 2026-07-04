// Adapter: build-normalizer BuildSnapshot -> @exilelab/core canonical BuildSnapshot.
//
// RFC-0001 makes the canonical BuildSnapshot the narrow waist. Two package-local
// shapes exist today: the normalizer emits its own BuildSnapshot (its model.ts),
// and @exilelab/core owns the long-term canonical type with deterministic
// identity + promotion. The API stores the CORE snapshot as the authoritative
// build so that promoteMutation (core) can produce new snapshots. This adapter is
// the single translation seam; when the normalizer re-exports core's type this
// module collapses to a near-identity pass-through.

import { createBuildSnapshot } from "@exilelab/core";
import type {
  BuildSnapshot as CoreSnapshot,
  BuildState,
  Character,
  ConfigEntry,
  DisplayCache,
  EquipmentItem,
  LoadoutContext,
  Metadata,
  SkillSetup,
  Assumption as CoreAssumption,
} from "@exilelab/core";
import type { BuildSnapshot as NormalizerSnapshot } from "@exilelab/build-normalizer";

/** Zod's `.min(1)` fields reject "" — coerce empty/absent strings to null. */
function nonEmptyOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toCharacter(snap: NormalizerSnapshot): Character {
  return {
    class: nonEmptyOrNull(snap.character.className) ?? "Unknown",
    ascendancy: nonEmptyOrNull(snap.character.ascendancyName),
    level: snap.character.level,
  };
}

function toLoadout(l: NormalizerSnapshot["loadouts"][number]): LoadoutContext {
  const equipment: EquipmentItem[] = l.equipment.map((item) => ({
    slot: nonEmptyOrNull(item.slot) ?? "unknown",
    itemRef: nonEmptyOrNull(item.name),
    rarity: nonEmptyOrNull(item.rarity),
    modifiers: [...item.lines],
  }));

  const skills: SkillSetup[] = l.skills.map((group) => {
    const [head, ...rest] = group.gems;
    const skillGemRef = nonEmptyOrNull(head?.skillId ?? head?.name ?? null);
    const supports = rest
      .map((g) => nonEmptyOrNull(g.skillId ?? g.name))
      .filter((s): s is string => s !== null);
    return {
      setupId: nonEmptyOrNull(group.id) ?? "setup",
      isMainSkill: group.isMain,
      skillGemRef,
      socket: null,
      supports,
    };
  });

  return {
    contextId: nonEmptyOrNull(l.id) ?? "loadout",
    primary: l.primary,
    passiveTree: {
      allocatedNodes: [...l.passiveTree.allocatedNodeIds],
      masteryEffects: [],
    },
    equipment,
    skills,
  };
}

/**
 * Build-wide calculation configuration. The canonical model keeps a single
 * configuration list (RFC-0001 §5.3); the normalizer scopes config per loadout,
 * so we lift the PRIMARY loadout's configuration (the default calc context).
 */
function toConfiguration(snap: NormalizerSnapshot): ConfigEntry[] {
  const primary = snap.loadouts.find((l) => l.primary) ?? snap.loadouts[0];
  const config = primary?.configuration ?? {};
  return Object.entries(config)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, value]) => ({ key, value }));
}

function toAssumptions(snap: NormalizerSnapshot): CoreAssumption[] {
  return snap.assumptions
    .filter((a) => a.path.trim().length > 0)
    .map((a) =>
      a.note !== undefined
        ? { path: a.path, origin: a.origin, note: a.note }
        : { path: a.path, origin: a.origin },
    );
}

function toMetadata(snap: NormalizerSnapshot): Metadata {
  const p = snap.provenance;
  const reference = nonEmptyOrNull(p.reference);
  const attribution = nonEmptyOrNull(p.attribution);
  const rawRef = nonEmptyOrNull(p.rawArtifactRef);
  const league = nonEmptyOrNull(snap.metadata.league);
  const label =
    snap.metadata.labels.length > 0
      ? snap.metadata.labels.join(", ")
      : undefined;
  return {
    patchVersion: nonEmptyOrNull(snap.versioning.gamePatch) ?? "unknown",
    formatVersion: String(snap.versioning.snapshotFormatVersion),
    provenance: {
      source: nonEmptyOrNull(p.source) ?? "unknown",
      ...(reference !== null ? { reference } : {}),
      importedAt: p.importedAt,
      ...(attribution !== null ? { attribution } : {}),
      ...(rawRef !== null ? { rawImportArtifactId: rawRef } : {}),
    },
    ...(label !== undefined ? { label } : {}),
    ...(league !== null ? { league } : {}),
  };
}

/**
 * Display Cache (RFC-0001 AD-3): game-data id → display name, rendering-only and
 * identity-excluded. We map each gem's skill id to its display name so downstream
 * surfaces (summary, Context Detector rationale) can render names without a
 * historical-game-data lookup.
 */
function toDisplayCache(snap: NormalizerSnapshot): DisplayCache {
  const names: Record<string, string> = { ...snap.displayCache.labels };
  for (const loadout of snap.loadouts) {
    for (const group of loadout.skills) {
      for (const gem of group.gems) {
        const ref = nonEmptyOrNull(gem.skillId ?? gem.name);
        const name = nonEmptyOrNull(gem.name);
        if (ref !== null && name !== null) names[ref] = name;
      }
    }
  }
  return { names, icons: {} };
}

/**
 * Translate a normalizer BuildSnapshot into a validated, frozen, canonically
 * identified core BuildSnapshot. Identity is recomputed by core over build state
 * only (I2), so re-importing the same build is idempotent on buildId.
 */
export function toCoreSnapshot(snap: NormalizerSnapshot): CoreSnapshot {
  const buildState: BuildState = {
    character: toCharacter(snap),
    loadoutContexts: snap.loadouts.map(toLoadout),
    configuration: toConfiguration(snap),
    assumptions: toAssumptions(snap),
  };
  return createBuildSnapshot({
    buildState,
    metadata: toMetadata(snap),
    displayCache: toDisplayCache(snap),
  });
}
