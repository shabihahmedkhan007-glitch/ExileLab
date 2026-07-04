// The Normalizer — translates a Raw Import Artifact into a canonical BuildSnapshot.
// It owns canonicalization (RFC-0001 I2) and declares every field it fills with an
// assumption origin (imported | inferred | defaulted) per the honesty-over-
// completeness invariant (I3/I4). It never contacts an external platform.

import { computeIdentity } from "./identity.js";
import { NormalizeError } from "./errors.js";
import type {
  Assumption,
  AssumptionOrigin,
  BuildSnapshot,
  Character,
  Configuration,
  Gem,
  Item,
  LoadoutContext,
  Metadata,
  Provenance,
  Resources,
  SkillGroup,
} from "./model.js";
import type {
  ExtractedGem,
  ExtractedItem,
  ExtractedLoadout,
  ExtractedSkillGroup,
  RawImportArtifact,
} from "./raw-import-artifact.js";

/** Current snapshot-format version (RFC-0001 I5; independent of game patch). */
export const SNAPSHOT_FORMAT_VERSION = 1 as const;

/** Placeholder patch used when no source patch is known (always declared, never silent). */
export const UNKNOWN_GAME_PATCH = "unknown" as const;

export interface NormalizeOptions {
  /**
   * Game patch to attribute the snapshot to when the artifact does not carry one.
   * When supplied it is recorded as `inferred`; when omitted the normalizer
   * defaults to UNKNOWN_GAME_PATCH and records `defaulted`.
   */
  readonly gamePatch?: string;
}

/** Accumulates assumption records so every filled field carries an origin. */
class Assumptions {
  private readonly records: Assumption[] = [];
  add(path: string, origin: AssumptionOrigin, note?: string): void {
    this.records.push(note === undefined ? { path, origin } : { path, origin, note });
  }
  list(): readonly Assumption[] {
    return this.records;
  }
  hasPath(path: string): boolean {
    return this.records.some((r) => r.path === path);
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

function normalizeGem(gem: ExtractedGem, path: string, a: Assumptions): Gem {
  let name = gem.name;
  if (name === undefined) {
    name = "Unknown Gem";
    a.add(`${path}.name`, "defaulted", "gem name absent from source");
  }
  return {
    name,
    skillId: gem.skillId ?? null,
    level: gem.level ?? null,
    quality: gem.quality ?? null,
  };
}

function normalizeSkillGroup(
  group: ExtractedSkillGroup,
  index: number,
  loadoutPath: string,
  forcedMain: boolean,
  a: Assumptions,
): SkillGroup {
  const id = group.id ?? `group-${index + 1}`;
  const path = `${loadoutPath}.skills[${index}]`;
  const gems = (group.gems ?? []).map((g, gi) => normalizeGem(g, `${path}.gems[${gi}]`, a));
  return {
    id,
    isMain: forcedMain,
    gems,
  };
}

function normalizeItem(item: ExtractedItem, index: number, loadoutPath: string, a: Assumptions): Item {
  const path = `${loadoutPath}.equipment[${index}]`;
  const id = item.id ?? `item-${index + 1}`;
  let slot = item.slot;
  if (slot === undefined) {
    slot = "unknown";
    a.add(`${path}.slot`, "defaulted", "equipment slot not resolvable from source");
  }
  let name = item.name;
  if (name === undefined) {
    name = "Unknown Item";
    a.add(`${path}.name`, "defaulted", "item name absent from source");
  }
  return {
    id,
    slot,
    name,
    rarity: item.rarity ?? null,
    lines: item.lines ?? [],
  };
}

function normalizeLoadout(
  loadout: ExtractedLoadout,
  index: number,
  isPrimary: boolean,
  primaryOriginInferred: boolean,
  a: Assumptions,
): LoadoutContext {
  const id = loadout.id ?? `loadout-${index + 1}`;
  if (loadout.id === undefined) a.add(`loadouts[${index}].id`, "defaulted", "loadout id synthesised");
  const path = `loadouts[${index}]`;

  if (primaryOriginInferred) {
    a.add(`${path}.primary`, "inferred", "no explicit primary loadout; first loadout chosen");
  }

  // Passive tree.
  const rawNodes = loadout.allocatedNodeIds ?? [];
  const allocatedNodeIds = [...rawNodes].sort((x, y) => x - y);
  if (loadout.allocatedNodeIds === undefined || rawNodes.length === 0) {
    a.add(`${path}.passiveTree.allocatedNodeIds`, "defaulted", "no allocated passive nodes in source");
  } else {
    a.add(`${path}.passiveTree.allocatedNodeIds`, "imported");
  }

  // Equipment.
  const equipment = (loadout.items ?? []).map((it, i) => normalizeItem(it, i, path, a));
  if (loadout.items === undefined) {
    a.add(`${path}.equipment`, "defaulted", "no equipment in source");
  } else {
    a.add(`${path}.equipment`, "imported");
  }

  // Skills + main designation (exactly one main group).
  const rawSkills = loadout.skills ?? [];
  const explicitMainIdx = rawSkills.findIndex((g) => g.isMain === true);
  const anyMain = explicitMainIdx >= 0;
  const skills = rawSkills.map((g, i) =>
    normalizeSkillGroup(g, i, path, anyMain ? i === explicitMainIdx : i === 0 && rawSkills.length > 0, a),
  );
  if (loadout.skills === undefined) {
    a.add(`${path}.skills`, "defaulted", "no skills in source");
  } else if (!anyMain && rawSkills.length > 0) {
    a.add(`${path}.skills[0].isMain`, "inferred", "no main skill designated; first group chosen");
  } else if (anyMain) {
    a.add(`${path}.skills[${explicitMainIdx}].isMain`, "imported");
  }

  const configuration: Configuration = loadout.configuration ?? {};
  if (loadout.configuration === undefined) {
    a.add(`${path}.configuration`, "defaulted", "no calculation configuration in source");
  } else {
    a.add(`${path}.configuration`, "imported");
  }

  const resources: Resources = loadout.resources ?? {};
  if (loadout.resources === undefined) {
    a.add(`${path}.resources`, "defaulted", "no resource data in source");
  } else {
    a.add(`${path}.resources`, "imported");
  }

  return {
    id,
    name: loadout.name ?? null,
    primary: isPrimary,
    passiveTree: { allocatedNodeIds },
    equipment,
    skills,
    configuration,
    resources,
  };
}

/**
 * Normalize a Raw Import Artifact into a canonical, immutable BuildSnapshot.
 * Throws NormalizeError only on internal contradictions; missing source data is
 * handled by defaulting + declared assumptions, never by throwing.
 */
export function normalize(artifact: RawImportArtifact, options?: NormalizeOptions): BuildSnapshot {
  if (artifact === null || typeof artifact !== "object") {
    throw new NormalizeError("artifact is not an object");
  }
  const a = new Assumptions();
  const extracted = artifact.extracted;

  // --- Character ---
  const rawChar = extracted.character;
  let className = rawChar?.className;
  if (className === undefined) {
    className = "Unknown";
    a.add("character.className", "defaulted", "class not present in source");
  } else {
    a.add("character.className", "imported");
  }
  const ascendancyName = rawChar?.ascendancyName ?? null;
  if (rawChar?.ascendancyName === undefined) {
    a.add("character.ascendancyName", "defaulted", "no ascendancy in source");
  } else {
    a.add("character.ascendancyName", "imported");
  }
  let level = rawChar?.level;
  if (level === undefined) {
    level = 1;
    a.add("character.level", "defaulted", "level not present in source");
  } else {
    a.add("character.level", "imported");
  }
  const character: Character = { className, ascendancyName, level };

  // --- Versioning ---
  let gamePatch = extracted.gamePatch;
  if (gamePatch === undefined) {
    if (options?.gamePatch !== undefined) {
      gamePatch = options.gamePatch;
      a.add("versioning.gamePatch", "inferred", "patch supplied by caller, not source");
    } else {
      gamePatch = UNKNOWN_GAME_PATCH;
      a.add("versioning.gamePatch", "defaulted", "no game patch in source");
    }
  } else {
    a.add("versioning.gamePatch", "imported");
  }

  // --- Loadouts (AD-5: one or more; exactly one primary) ---
  const rawLoadouts =
    extracted.loadouts !== undefined && extracted.loadouts.length > 0
      ? extracted.loadouts
      : [defaultLoadout(a)];
  const explicitPrimaryIdx = rawLoadouts.findIndex((l) => l.primary === true);
  const primaryIdx = explicitPrimaryIdx >= 0 ? explicitPrimaryIdx : 0;
  const primaryInferred = explicitPrimaryIdx < 0;
  const loadouts: LoadoutContext[] = rawLoadouts.map((l, i) =>
    normalizeLoadout(l, i, i === primaryIdx, primaryInferred && i === primaryIdx, a),
  );

  // Fold in any importer-declared gaps not already covered, so nothing is silent.
  for (const gap of artifact.gaps) {
    if (!a.hasPath(gap)) {
      a.add(gap, "defaulted", "declared un-extractable by importer");
    }
  }

  // --- Snapshot context (identity-excluded parts) ---
  const provenance: Provenance = {
    source: artifact.source,
    rawArtifactRef: artifact.ref,
    reference: extracted.provenance?.reference ?? null,
    attribution: extracted.provenance?.attribution ?? null,
    importedAt: artifact.receivedAt,
  };
  const metadata: Metadata = {
    labels: extracted.metadata?.labels ?? [],
    league: extracted.metadata?.league ?? null,
  };
  const mainSkillName = loadouts[primaryIdx]?.skills.find((s) => s.isMain)?.gems[0]?.name;
  const displayCache = {
    labels: {
      className: character.className,
      ...(character.ascendancyName !== null ? { ascendancy: character.ascendancyName } : {}),
      ...(mainSkillName !== undefined ? { mainSkill: mainSkillName } : {}),
    },
  };

  const versioning = { gamePatch, snapshotFormatVersion: SNAPSHOT_FORMAT_VERSION };
  const identity = computeIdentity(character, loadouts, versioning);

  const snapshot: BuildSnapshot = {
    identity,
    character,
    loadouts,
    versioning,
    provenance,
    assumptions: a.list(),
    metadata,
    displayCache,
  };
  return deepFreeze(snapshot);
}

function defaultLoadout(a: Assumptions): ExtractedLoadout {
  a.add("loadouts", "defaulted", "no loadout in source; empty primary loadout created");
  return { id: "primary", primary: true };
}
