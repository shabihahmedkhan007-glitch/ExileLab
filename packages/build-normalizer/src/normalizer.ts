// The Normalizer — translates a Raw Import Artifact into a canonical BuildSnapshot.
// It maps the importer's source-neutral extraction into @exilelab/core's exact
// shapes and hands them to `createBuildSnapshot`, which owns canonicalization and
// the deterministic Canonical Identity (RFC-0001 I2). The normalizer declares
// every field it fills with an assumption origin (imported | inferred | defaulted)
// per the honesty-over-completeness invariant (I3/I4). It never contacts an
// external platform.
//
// There is no package-local identity anymore: core's computeBuildStateIdentity
// (invoked inside createBuildSnapshot) is the ONE identity. Assumptions ride with
// build state but are EXCLUDED from identity (RFC-0001 §5.3), which core enforces.

import { NormalizeError } from "./errors.js";
import { createBuildSnapshot } from "./model.js";
import type {
  Assumption,
  AssumptionOrigin,
  BuildSnapshot,
  BuildState,
  Character,
  ConfigEntry,
  DisplayCache,
  EquipmentItem,
  LoadoutContext,
  Metadata,
  Provenance,
  SkillSetup,
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
  list(): Assumption[] {
    return this.records;
  }
  hasPath(path: string): boolean {
    return this.records.some((r) => r.path === path);
  }
}

/** core's `.min(1)` string fields reject "" — coerce empty/absent strings to null. */
function nonEmptyOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Map one extracted gem-group into a core SkillSetup: the first gem is the active
 * skill (skillGemRef); the rest are support gems (supports). Gem display names are
 * recorded into the Display Cache collector (RFC-0001 AD-3; rendering only).
 */
function normalizeSkillGroup(
  group: ExtractedSkillGroup,
  index: number,
  loadoutPath: string,
  forcedMain: boolean,
  a: Assumptions,
  names: Record<string, string>,
): SkillSetup {
  const setupId = nonEmptyOrNull(group.id) ?? `group-${index + 1}`;
  const path = `${loadoutPath}.skills[${index}]`;
  const gems = group.gems ?? [];

  const recordName = (gem: ExtractedGem, ref: string | null): void => {
    const name = nonEmptyOrNull(gem.name);
    if (ref !== null && name !== null) names[ref] = name;
  };
  const refOf = (gem: ExtractedGem, gi: number): string | null => {
    if (gem.name === undefined) {
      a.add(`${path}.gems[${gi}].name`, "defaulted", "gem name absent from source");
    }
    return nonEmptyOrNull(gem.skillId ?? gem.name);
  };

  const head = gems[0];
  const skillGemRef = head !== undefined ? refOf(head, 0) : null;
  if (head !== undefined) recordName(head, skillGemRef);

  const supports: string[] = [];
  for (let gi = 1; gi < gems.length; gi += 1) {
    const gem = gems[gi]!;
    const ref = refOf(gem, gi);
    recordName(gem, ref);
    if (ref !== null) supports.push(ref);
  }

  return {
    setupId,
    isMainSkill: forcedMain,
    skillGemRef,
    socket: null,
    supports,
  };
}

function normalizeItem(
  item: ExtractedItem,
  index: number,
  loadoutPath: string,
  a: Assumptions,
): EquipmentItem {
  const path = `${loadoutPath}.equipment[${index}]`;
  let slot = item.slot;
  if (slot === undefined) {
    slot = "unknown";
    a.add(`${path}.slot`, "defaulted", "equipment slot not resolvable from source");
  }
  if (item.name === undefined) {
    a.add(`${path}.name`, "defaulted", "item name absent from source");
  }
  return {
    slot: nonEmptyOrNull(slot) ?? "unknown",
    itemRef: nonEmptyOrNull(item.name),
    rarity: nonEmptyOrNull(item.rarity),
    modifiers: [...(item.lines ?? [])],
  };
}

function normalizeLoadout(
  loadout: ExtractedLoadout,
  index: number,
  isPrimary: boolean,
  primaryOriginInferred: boolean,
  a: Assumptions,
  names: Record<string, string>,
): LoadoutContext {
  const contextId = nonEmptyOrNull(loadout.id) ?? `loadout-${index + 1}`;
  if (loadout.id === undefined) a.add(`loadouts[${index}].id`, "defaulted", "loadout id synthesised");
  const path = `loadouts[${index}]`;

  if (primaryOriginInferred) {
    a.add(`${path}.primary`, "inferred", "no explicit primary loadout; first loadout chosen");
  }

  // Passive tree.
  const rawNodes = loadout.allocatedNodeIds ?? [];
  const allocatedNodes = [...rawNodes].sort((x, y) => x - y);
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
    normalizeSkillGroup(
      g,
      i,
      path,
      anyMain ? i === explicitMainIdx : i === 0 && rawSkills.length > 0,
      a,
      names,
    ),
  );
  if (loadout.skills === undefined) {
    a.add(`${path}.skills`, "defaulted", "no skills in source");
  } else if (!anyMain && rawSkills.length > 0) {
    a.add(`${path}.skills[0].isMain`, "inferred", "no main skill designated; first group chosen");
  } else if (anyMain) {
    a.add(`${path}.skills[${explicitMainIdx}].isMain`, "imported");
  }

  return {
    contextId,
    primary: isPrimary,
    passiveTree: { allocatedNodes, masteryEffects: [] },
    equipment,
    skills,
  };
}

/** Lift the primary loadout's calculation configuration to build-state (RFC-0001 §5.3). */
function normalizeConfiguration(primaryRaw: ExtractedLoadout | undefined, a: Assumptions): ConfigEntry[] {
  const config = primaryRaw?.configuration;
  if (config === undefined) {
    a.add("configuration", "defaulted", "no calculation configuration in source");
    return [];
  }
  a.add("configuration", "imported");
  return Object.entries(config)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, value]) => ({ key, value }));
}

/**
 * Normalize a Raw Import Artifact into a canonical, immutable BuildSnapshot (core).
 * Throws NormalizeError only on internal contradictions; missing source data is
 * handled by defaulting + declared assumptions, never by throwing. Identity is
 * computed by core over build state ONLY (I2) — re-importing the same build is
 * deterministic on identity.
 */
export function normalize(artifact: RawImportArtifact, options?: NormalizeOptions): BuildSnapshot {
  if (artifact === null || typeof artifact !== "object") {
    throw new NormalizeError("artifact is not an object");
  }
  const a = new Assumptions();
  const names: Record<string, string> = {};
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
  const character: Character = {
    class: nonEmptyOrNull(className) ?? "Unknown",
    ascendancy: nonEmptyOrNull(ascendancyName),
    level,
  };

  // --- Versioning (patch → metadata.patchVersion; I5) ---
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
  const loadoutContexts: LoadoutContext[] = rawLoadouts.map((l, i) =>
    normalizeLoadout(l, i, i === primaryIdx, primaryInferred && i === primaryIdx, a, names),
  );

  const configuration = normalizeConfiguration(rawLoadouts[primaryIdx], a);

  // Fold in any importer-declared gaps not already covered, so nothing is silent.
  for (const gap of artifact.gaps) {
    if (!a.hasPath(gap)) {
      a.add(gap, "defaulted", "declared un-extractable by importer");
    }
  }

  // --- Snapshot context (identity-excluded parts) ---
  const reference = nonEmptyOrNull(extracted.provenance?.reference);
  const attribution = nonEmptyOrNull(extracted.provenance?.attribution);
  const rawRef = nonEmptyOrNull(artifact.ref);
  const provenance: Provenance = {
    source: artifact.source,
    ...(reference !== null ? { reference } : {}),
    importedAt: artifact.receivedAt,
    ...(attribution !== null ? { attribution } : {}),
    ...(rawRef !== null ? { rawImportArtifactId: rawRef } : {}),
  };

  const labels = extracted.metadata?.labels ?? [];
  const league = nonEmptyOrNull(extracted.metadata?.league);
  const label = labels.length > 0 ? labels.join(", ") : undefined;
  const metadata: Metadata = {
    patchVersion: nonEmptyOrNull(gamePatch) ?? UNKNOWN_GAME_PATCH,
    formatVersion: String(SNAPSHOT_FORMAT_VERSION),
    provenance,
    ...(label !== undefined ? { label } : {}),
    ...(league !== null ? { league } : {}),
  };

  const displayCache: DisplayCache = { names, icons: {} };

  const buildState: BuildState = {
    character,
    loadoutContexts,
    configuration,
    assumptions: a.list(),
  };

  return createBuildSnapshot({ buildState, metadata, displayCache });
}

function defaultLoadout(a: Assumptions): ExtractedLoadout {
  a.add("loadouts", "defaulted", "no loadout in source; empty primary loadout created");
  return { id: "primary", primary: true };
}
