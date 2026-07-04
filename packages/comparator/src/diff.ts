// Comparative Optimization: diff two BuildSnapshots category-by-category and
// emit each meaningful divergence as a candidate BuildMutation against snapshot A
// (RFC-0001 §8.1 "comparable"; PRODUCT_PLAN "Comparative Optimization Engine";
// UX_PRESENTATION §4.4 "the diff screen").
//
// The whole point: diffs become mutations. Every candidate is a valid
// BuildMutation that `promoteMutation` accepts, so downstream can engine-evaluate
// and preference-score it under the user's weights.

import type {
  BuildSnapshot,
  BuildMutation,
  GearItem,
  SkillSetup,
  ConfigValue,
  MutationOp,
  Provenance,
} from './model.js';
import { getPrimaryLoadout } from './model.js';

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

export type SlotStatus = 'added' | 'removed' | 'changed' | 'unchanged';

/** One gear slot compared A→B, with changed mod lines highlighted (UX §4.4). */
export interface GearSlotDiff {
  readonly slot: string;
  readonly status: SlotStatus;
  readonly a: GearItem | null;
  readonly b: GearItem | null;
  /** Mod lines present in B's item but not A's. */
  readonly addedModLines: readonly string[];
  /** Mod lines present in A's item but not B's. */
  readonly removedModLines: readonly string[];
}

export type SetupStatus = 'added' | 'removed' | 'changed' | 'unchanged';

/** One skill/gem socket group compared A→B. */
export interface SkillSetupDiff {
  readonly socketGroup: string;
  readonly status: SetupStatus;
  readonly a: SkillSetup | null;
  readonly b: SkillSetup | null;
}

export type ConfigStatus = 'added' | 'removed' | 'changed' | 'unchanged';

/** One calculation-config key compared A→B. */
export interface ConfigDiff {
  readonly key: string;
  readonly status: ConfigStatus;
  readonly a: ConfigValue | null;
  readonly b: ConfigValue | null;
}

/**
 * The structured diff of snapshot A vs B, plus the candidate changes it implies.
 * Each candidate is a BuildMutation against A carrying exactly one op.
 */
export interface SnapshotDiff {
  readonly fromId: string;
  readonly toId: string;
  /** The loadout ids actually compared (primary of each). */
  readonly loadoutId: string;
  readonly passiveTree: PassiveTreeDiff;
  readonly gear: readonly GearSlotDiff[];
  readonly skills: readonly SkillSetupDiff[];
  readonly config: readonly ConfigDiff[];
  /** Every meaningful difference, as a candidate BuildMutation against A. */
  readonly candidates: readonly BuildMutation[];
}

// --- Helpers -----------------------------------------------------------------

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function itemFingerprint(item: GearItem | null): string {
  if (item === null) return '∅';
  return fnv1a(`${item.name}|${item.baseType ?? ''}|${[...item.modLines].sort().join('¦')}`);
}

function setupFingerprint(setup: SkillSetup | null): string {
  if (setup === null) return '∅';
  return fnv1a(`${setup.mainSkill}|${[...setup.gems].sort().join('¦')}`);
}

/**
 * A stable semantic key for the change an op represents. Two candidates from
 * different sources that describe the *same* change share a changeKey — this is
 * what powers consensus detection in `compareMany`.
 */
export function changeKey(op: MutationOp): string {
  switch (op.kind) {
    case 'allocateNode':
      return `alloc:${op.loadoutId}:${op.nodeId}`;
    case 'deallocateNode':
      return `dealloc:${op.loadoutId}:${op.nodeId}`;
    case 'setGear':
      return `gear:${op.loadoutId}:${op.slot}:${itemFingerprint(op.item)}`;
    case 'setSkill':
      return `skill:${op.loadoutId}:${op.socketGroup}:${setupFingerprint(op.setup)}`;
    case 'setConfig':
      return `config:${op.loadoutId}:${op.key}:${op.value === null ? '∅' : String(op.value)}`;
  }
}

function candidate(baseSnapshotId: string, op: MutationOp, origin?: Provenance): BuildMutation {
  const key = changeKey(op);
  return {
    id: `mut_${fnv1a(`${baseSnapshotId}|${key}`)}`,
    baseSnapshotId,
    ops: [op],
    ...(origin ? { origin } : {}),
  };
}

function equipmentBySlot(items: readonly GearItem[]): Map<string, GearItem> {
  const map = new Map<string, GearItem>();
  for (const item of items) map.set(item.slot, item);
  return map;
}

function skillsByGroup(setups: readonly SkillSetup[]): Map<string, SkillSetup> {
  const map = new Map<string, SkillSetup>();
  for (const s of setups) map.set(s.socketGroup, s);
  return map;
}

// --- Core diff ---------------------------------------------------------------

/**
 * Diff two BuildSnapshots (their primary Loadout Contexts) category-by-category
 * and emit each meaningful difference as a candidate BuildMutation against `a`.
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

  const candidates: BuildMutation[] = [];

  // Determine the loadout id candidates target on A. If A has no loadout, there
  // is nothing to mutate; the diff is still reported against B's view.
  const loadoutId = la?.id ?? lb?.id ?? '';

  // Passive tree ------------------------------------------------------------
  const aNodes = new Set(la?.allocatedNodes ?? []);
  const bNodes = new Set(lb?.allocatedNodes ?? []);
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
      candidates.push(candidate(a.id, { kind: 'allocateNode', loadoutId: la.id, nodeId }, origin));
    }
    // Drop nodes yours has that theirs lacks.
    for (const nodeId of onlyInA) {
      candidates.push(candidate(a.id, { kind: 'deallocateNode', loadoutId: la.id, nodeId }, origin));
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
    const aMods = new Set(ai?.modLines ?? []);
    const bMods = new Set(bi?.modLines ?? []);
    const addedModLines = [...bMods].filter((m) => !aMods.has(m)).sort();
    const removedModLines = [...aMods].filter((m) => !bMods.has(m)).sort();

    let status: SlotStatus;
    if (ai === null) status = 'added';
    else if (bi === null) status = 'removed';
    else status = itemFingerprint(ai) === itemFingerprint(bi) ? 'unchanged' : 'changed';

    gear.push({ slot, status, a: ai, b: bi, addedModLines, removedModLines });

    if (status !== 'unchanged' && la) {
      candidates.push(candidate(a.id, { kind: 'setGear', loadoutId: la.id, slot, item: bi }, origin));
    }
  }

  // Skills / gems -----------------------------------------------------------
  const aSkills = skillsByGroup(la?.skills ?? []);
  const bSkills = skillsByGroup(lb?.skills ?? []);
  const groups = [...new Set([...aSkills.keys(), ...bSkills.keys()])].sort();
  const skills: SkillSetupDiff[] = [];
  for (const socketGroup of groups) {
    const as = aSkills.get(socketGroup) ?? null;
    const bs = bSkills.get(socketGroup) ?? null;

    let status: SetupStatus;
    if (as === null) status = 'added';
    else if (bs === null) status = 'removed';
    else status = setupFingerprint(as) === setupFingerprint(bs) ? 'unchanged' : 'changed';

    skills.push({ socketGroup, status, a: as, b: bs });

    if (status !== 'unchanged' && la) {
      candidates.push(candidate(a.id, { kind: 'setSkill', loadoutId: la.id, socketGroup, setup: bs }, origin));
    }
  }

  // Config ------------------------------------------------------------------
  const aConfig = la?.config ?? {};
  const bConfig = lb?.config ?? {};
  const configKeys = [...new Set([...Object.keys(aConfig), ...Object.keys(bConfig)])].sort();
  const config: ConfigDiff[] = [];
  for (const key of configKeys) {
    const av = key in aConfig ? aConfig[key]! : null;
    const bv = key in bConfig ? bConfig[key]! : null;

    let status: ConfigStatus;
    if (av === null) status = 'added';
    else if (bv === null) status = 'removed';
    else status = av === bv ? 'unchanged' : 'changed';

    config.push({ key, status, a: av, b: bv });

    if (status !== 'unchanged' && la) {
      candidates.push(candidate(a.id, { kind: 'setConfig', loadoutId: la.id, key, value: bv }, origin));
    }
  }

  return {
    fromId: a.id,
    toId: b.id,
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
