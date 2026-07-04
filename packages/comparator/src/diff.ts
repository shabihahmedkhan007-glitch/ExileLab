// Comparative Optimization: diff two BuildSnapshots category-by-category and
// emit each meaningful divergence as a candidate BuildMutation against snapshot A
// (RFC-0001 §8.1 "comparable"; PRODUCT_PLAN "Comparative Optimization Engine";
// UX_PRESENTATION §4.4 "the diff screen").
//
// The whole point: diffs become mutations. Every candidate is a valid core
// BuildMutation whose operations are core's MutationOperation vocabulary, so
// `promoteMutation` (core) accepts it — downstream can then engine-evaluate and
// preference-score it under the user's weights.

import type {
  BuildSnapshot,
  BuildMutation,
  EquipmentItem,
  SkillSetup,
  MutationOperation,
  Provenance,
} from "./model.js";
import { createBuildMutation, getPrimaryLoadout } from "./model.js";

// --- Candidate (a promotable core BuildMutation + optional attribution) -------

/**
 * A candidate change: a core BuildMutation (promotable as-is) with an OPTIONAL
 * `origin` carrying the source build's Provenance for attribution display
 * (RFC-0001 §8.1 — attribution is the only sanctioned use of Provenance). The
 * `origin` field is extra metadata core's promoteMutation ignores.
 */
export interface Candidate extends BuildMutation {
  readonly origin?: Provenance;
}

// --- Diff result shapes ------------------------------------------------------

/** Passive tree node membership across the two builds (UX §4.4 overlay diff). */
export interface PassiveTreeDiff {
  /** Nodes allocated by A but not B ("only yours", sorted). */
  readonly onlyInA: readonly number[];
  /** Nodes allocated by B but not A ("only theirs", sorted). */
  readonly onlyInB: readonly number[];
  /** Nodes allocated by both ("allocated by both", sorted). */
  readonly shared: readonly number[];
}

export type SlotStatus = "added" | "removed" | "changed" | "unchanged";

/** One gear slot compared A→B, with changed mod lines highlighted (UX §4.4). */
export interface GearSlotDiff {
  readonly slot: string;
  readonly status: SlotStatus;
  readonly a: EquipmentItem | null;
  readonly b: EquipmentItem | null;
  /** Mod lines present in B's item but not A's. */
  readonly addedModLines: readonly string[];
  /** Mod lines present in A's item but not B's. */
  readonly removedModLines: readonly string[];
}

export type SetupStatus = "added" | "removed" | "changed" | "unchanged";

/** One skill/gem setup compared A→B (keyed by setupId). */
export interface SkillSetupDiff {
  readonly setupId: string;
  readonly status: SetupStatus;
  readonly a: SkillSetup | null;
  readonly b: SkillSetup | null;
}

export type ConfigStatus = "added" | "removed" | "changed" | "unchanged";

/** One calculation-config key compared A→B (build-state configuration). */
export interface ConfigDiff {
  readonly key: string;
  readonly status: ConfigStatus;
  readonly a: string | number | boolean | null;
  readonly b: string | number | boolean | null;
}

/**
 * The structured diff of snapshot A vs B, plus the candidate changes it implies.
 * Each candidate is a core BuildMutation against A carrying exactly one operation.
 */
export interface SnapshotDiff {
  readonly fromId: string;
  readonly toId: string;
  /** The loadout id actually compared (primary of each). */
  readonly loadoutId: string;
  readonly passiveTree: PassiveTreeDiff;
  readonly gear: readonly GearSlotDiff[];
  readonly skills: readonly SkillSetupDiff[];
  readonly config: readonly ConfigDiff[];
  /** Every meaningful difference, as a candidate BuildMutation against A. */
  readonly candidates: readonly Candidate[];
}

// --- Helpers -----------------------------------------------------------------

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function itemFingerprint(item: EquipmentItem | null): string {
  if (item === null) return "∅";
  return fnv1a(
    `${item.itemRef ?? ""}|${item.rarity ?? ""}|${[...item.modifiers].sort().join("¦")}`,
  );
}

function setupFingerprint(setup: SkillSetup | null): string {
  if (setup === null) return "∅";
  return fnv1a(`${setup.skillGemRef ?? ""}|${[...setup.supports].sort().join("¦")}`);
}

/**
 * A stable semantic key for the change an op represents. Two candidates from
 * different sources that describe the *same* change share a changeKey — this is
 * what powers consensus detection in `compareMany`.
 */
export function changeKey(op: MutationOperation): string {
  switch (op.kind) {
    case "allocatePassiveNode":
      return `alloc:${op.loadoutContextId}:${op.nodeId}`;
    case "deallocatePassiveNode":
      return `dealloc:${op.loadoutContextId}:${op.nodeId}`;
    case "swapItem":
      return `gear:${op.loadoutContextId}:${op.item.slot}:${itemFingerprint(op.item)}`;
    case "changeGem":
      return `gem:${op.loadoutContextId}:${op.setupId}:${op.skillGemRef ?? "∅"}`;
    case "changeSupport":
      return `support:${op.loadoutContextId}:${op.setupId}:+${op.addSupportRef ?? ""}:-${op.removeSupportRef ?? ""}`;
    case "changeConfig":
      return `config:${op.key}:${op.value === null ? "∅" : String(op.value)}`;
  }
}

function candidate(baseSnapshotId: string, op: MutationOperation, origin?: Provenance): Candidate {
  const mutation = createBuildMutation({ baseSnapshotId, operations: [op] });
  return origin ? { ...mutation, origin } : { ...mutation };
}

function equipmentBySlot(items: readonly EquipmentItem[]): Map<string, EquipmentItem> {
  const map = new Map<string, EquipmentItem>();
  for (const item of items) map.set(item.slot, item);
  return map;
}

function skillsBySetup(setups: readonly SkillSetup[]): Map<string, SkillSetup> {
  const map = new Map<string, SkillSetup>();
  for (const s of setups) map.set(s.setupId, s);
  return map;
}

function configMap(entries: readonly { key: string; value: string | number | boolean }[]): Map<string, string | number | boolean> {
  const map = new Map<string, string | number | boolean>();
  for (const e of entries) map.set(e.key, e.value);
  return map;
}

// --- Core diff ---------------------------------------------------------------

/**
 * Diff two BuildSnapshots (their primary Loadout Contexts, plus build-state
 * configuration) category-by-category and emit each meaningful difference as a
 * candidate core BuildMutation against `a`.
 *
 * `diffSnapshots(a, a)` is empty: no onlyIn* nodes, all slots/setups/config
 * `unchanged`, and zero candidates.
 *
 * @param origin Optional attribution stamped onto every emitted candidate
 *   (the source build `b` came from). Set by `compareMany`.
 */
export function diffSnapshots(a: BuildSnapshot, b: BuildSnapshot, origin?: Provenance): SnapshotDiff {
  const la = getPrimaryLoadout(a);
  const lb = getPrimaryLoadout(b);

  const candidates: Candidate[] = [];

  // Determine the loadout id candidates target on A. If A has no loadout, there
  // is nothing to mutate; the diff is still reported against B's view.
  const loadoutId = la?.contextId ?? lb?.contextId ?? "";

  // Passive tree ------------------------------------------------------------
  const aNodes = new Set(la?.passiveTree.allocatedNodes ?? []);
  const bNodes = new Set(lb?.passiveTree.allocatedNodes ?? []);
  const onlyInA: number[] = [];
  const onlyInB: number[] = [];
  const shared: number[] = [];
  for (const n of aNodes) (bNodes.has(n) ? shared : onlyInA).push(n);
  for (const n of bNodes) if (!aNodes.has(n)) onlyInB.push(n);
  onlyInA.sort((x, y) => x - y);
  onlyInB.sort((x, y) => x - y);
  shared.sort((x, y) => x - y);

  if (la) {
    // Adopt nodes theirs has that yours lacks.
    for (const nodeId of onlyInB) {
      candidates.push(
        candidate(a.identity, { kind: "allocatePassiveNode", loadoutContextId: la.contextId, nodeId }, origin),
      );
    }
    // Drop nodes yours has that theirs lacks.
    for (const nodeId of onlyInA) {
      candidates.push(
        candidate(a.identity, { kind: "deallocatePassiveNode", loadoutContextId: la.contextId, nodeId }, origin),
      );
    }
  }

  // Gear (per slot) ---------------------------------------------------------
  const aGear = equipmentBySlot(la?.equipment ?? []);
  const bGear = equipmentBySlot(lb?.equipment ?? []);
  const gearSlots = [...new Set([...aGear.keys(), ...bGear.keys()])].sort();
  const gear: GearSlotDiff[] = [];
  for (const slot of gearSlots) {
    const ai = aGear.get(slot) ?? null;
    const bi = bGear.get(slot) ?? null;
    const aMods = new Set(ai?.modifiers ?? []);
    const bMods = new Set(bi?.modifiers ?? []);
    const addedModLines = [...bMods].filter((m) => !aMods.has(m)).sort();
    const removedModLines = [...aMods].filter((m) => !bMods.has(m)).sort();

    let status: SlotStatus;
    if (ai === null) status = "added";
    else if (bi === null) status = "removed";
    else status = itemFingerprint(ai) === itemFingerprint(bi) ? "unchanged" : "changed";

    gear.push({ slot, status, a: ai, b: bi, addedModLines, removedModLines });

    // Adopt B's item when it has one (core swapItem replaces/adds a slot; it has
    // no "remove item" op, so a pure removal produces no candidate).
    if (status !== "unchanged" && la && bi !== null) {
      candidates.push(
        candidate(a.identity, { kind: "swapItem", loadoutContextId: la.contextId, item: bi }, origin),
      );
    }
  }

  // Skills / gems -----------------------------------------------------------
  const aSkills = skillsBySetup(la?.skills ?? []);
  const bSkills = skillsBySetup(lb?.skills ?? []);
  const setupIds = [...new Set([...aSkills.keys(), ...bSkills.keys()])].sort();
  const skills: SkillSetupDiff[] = [];
  for (const setupId of setupIds) {
    const as = aSkills.get(setupId) ?? null;
    const bs = bSkills.get(setupId) ?? null;

    let status: SetupStatus;
    if (as === null) status = "added";
    else if (bs === null) status = "removed";
    else status = setupFingerprint(as) === setupFingerprint(bs) ? "unchanged" : "changed";

    skills.push({ setupId, status, a: as, b: bs });

    // Emit atomic, promotable ops to adopt B's setup on A.
    if (status !== "unchanged" && la && bs !== null && as !== null) {
      if ((as.skillGemRef ?? null) !== (bs.skillGemRef ?? null)) {
        candidates.push(
          candidate(
            a.identity,
            { kind: "changeGem", loadoutContextId: la.contextId, setupId, skillGemRef: bs.skillGemRef },
            origin,
          ),
        );
      }
      const aSupports = new Set(as.supports);
      const bSupports = new Set(bs.supports);
      for (const addSupportRef of [...bSupports].filter((s) => !aSupports.has(s)).sort()) {
        candidates.push(
          candidate(
            a.identity,
            { kind: "changeSupport", loadoutContextId: la.contextId, setupId, addSupportRef },
            origin,
          ),
        );
      }
      for (const removeSupportRef of [...aSupports].filter((s) => !bSupports.has(s)).sort()) {
        candidates.push(
          candidate(
            a.identity,
            { kind: "changeSupport", loadoutContextId: la.contextId, setupId, removeSupportRef },
            origin,
          ),
        );
      }
    }
  }

  // Config (build-state configuration, RFC-0001 §5.3) -----------------------
  const aConfig = configMap(a.buildState.configuration);
  const bConfig = configMap(b.buildState.configuration);
  const configKeys = [...new Set([...aConfig.keys(), ...bConfig.keys()])].sort();
  const config: ConfigDiff[] = [];
  for (const key of configKeys) {
    const av = aConfig.has(key) ? aConfig.get(key)! : null;
    const bv = bConfig.has(key) ? bConfig.get(key)! : null;

    let status: ConfigStatus;
    if (av === null) status = "added";
    else if (bv === null) status = "removed";
    else status = av === bv ? "unchanged" : "changed";

    config.push({ key, status, a: av, b: bv });

    // core changeConfig sets a build-state key; it cannot delete, so a removal
    // (present in A only) produces no candidate.
    if (status !== "unchanged" && bv !== null) {
      candidates.push(candidate(a.identity, { kind: "changeConfig", key, value: bv }, origin));
    }
  }

  return {
    fromId: a.identity,
    toId: b.identity,
    loadoutId,
    passiveTree: { onlyInA, onlyInB, shared },
    gear,
    skills,
    config,
    candidates,
  };
}

/** True when a diff found no meaningful divergences (no candidates). */
export function isEmptyDiff(diff: SnapshotDiff): boolean {
  return diff.candidates.length === 0;
}
