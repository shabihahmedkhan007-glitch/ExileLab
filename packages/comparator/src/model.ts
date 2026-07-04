// Local mirror of the canonical build model contract (RFC-0001).
//
// NOTE: The authoritative `BuildSnapshot` / `BuildMutation` types and
// `promoteMutation` belong to `@exilelab/core`, which is still a stub at the
// time this package was implemented (it exports nothing). To stay self-contained
// and testable now, the comparator defines the minimal, RFC-0001-compliant shape
// it depends on here. When core lands its real types, this module should be
// replaced by a re-export from `@exilelab/core` — the shapes below are the
// contract comparator was written against.
//
// This module models BUILD STATE ONLY (RFC-0001 §5.3 / AD-7). No calculated or
// derived values live in a snapshot; those are separate artifacts.

/** A single equipment item on one gear slot. Mod lines are raw stat text. */
export interface GearItem {
  readonly slot: string;
  readonly name: string;
  readonly baseType?: string;
  /** Explicit/implicit stat lines, e.g. "+42 to maximum Life". */
  readonly modLines: readonly string[];
}

/** One skill/gem setup occupying a socket group. */
export interface SkillSetup {
  /** Stable key for the socket group (e.g. "weapon-1", "helmet"). */
  readonly socketGroup: string;
  /** The main active skill gem name for this group. */
  readonly mainSkill: string;
  /** Support/aux gem names linked in the group, order-insensitive. */
  readonly gems: readonly string[];
}

/** A calculation-context value (RFC-0001 §5.3: Configuration is build state). */
export type ConfigValue = string | number | boolean;

/**
 * One coherent equipment-and-tree configuration within a build (RFC-0001 AD-5).
 * A BuildSnapshot carries one or more; one is designated primary.
 */
export interface LoadoutContext {
  readonly id: string;
  /** Allocated passive tree node ids. */
  readonly allocatedNodes: readonly number[];
  /** Equipment keyed by gear slot. */
  readonly equipment: readonly GearItem[];
  /** Skill/gem setups keyed by socket group. */
  readonly skills: readonly SkillSetup[];
  /** Calculation-context configuration for this loadout. */
  readonly config: Readonly<Record<string, ConfigValue>>;
}

/** Provenance: attribution data (RFC-0001 §5.3). Never used to branch logic. */
export interface Provenance {
  /** Source platform/identifier label, e.g. "maxroll", "user". */
  readonly source: string;
  /** Optional reference (share code, url slug) for attribution display. */
  readonly reference?: string;
  /** Optional display label for the source build. */
  readonly label?: string;
}

/**
 * The immutable, normalized, source-independent representation of one build's
 * complete state at one moment, on one game patch (RFC-0001).
 *
 * `id` is the Canonical Identity, computed deterministically over build state
 * only (character + loadouts + primary designation). Provenance, metadata and
 * display data are excluded from identity (I2).
 */
export interface BuildSnapshot {
  readonly id: string;
  readonly formatVersion: number;
  readonly gamePatch: string;
  readonly character: {
    readonly className: string;
    readonly ascendancy?: string;
    readonly level: number;
  };
  readonly loadouts: readonly LoadoutContext[];
  readonly primaryLoadoutId: string;
  readonly provenance: Provenance;
}

/** The build-state slice that participates in Canonical Identity (I2). */
type IdentityState = Pick<BuildSnapshot, 'character' | 'primaryLoadoutId'> & {
  loadouts: readonly LoadoutContext[];
};

// --- One mutation operation (a single candidate change) ----------------------

export type MutationOp =
  | { readonly kind: 'allocateNode'; readonly loadoutId: string; readonly nodeId: number }
  | { readonly kind: 'deallocateNode'; readonly loadoutId: string; readonly nodeId: number }
  | { readonly kind: 'setGear'; readonly loadoutId: string; readonly slot: string; readonly item: GearItem | null }
  | { readonly kind: 'setSkill'; readonly loadoutId: string; readonly socketGroup: string; readonly setup: SkillSetup | null }
  | { readonly kind: 'setConfig'; readonly loadoutId: string; readonly key: string; readonly value: ConfigValue | null };

/**
 * A lightweight, immutable delta referencing a base BuildSnapshot, describing
 * one candidate change (RFC-0001 AD-2). Accepted mutations are *promoted*:
 * applied to their base to produce a new BuildSnapshot.
 */
export interface BuildMutation {
  readonly id: string;
  readonly baseSnapshotId: string;
  readonly ops: readonly MutationOp[];
  /** Optional attribution: which source build motivated this candidate. */
  readonly origin?: Provenance;
}

// --- Canonical identity ------------------------------------------------------

/** FNV-1a 32-bit hash of a string → stable, dependency-free identity token. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, kept in 32-bit range
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Deterministic JSON with recursively sorted object keys. */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(',')}}`;
}

function canonicalizeLoadout(loadout: LoadoutContext): unknown {
  return {
    id: loadout.id,
    allocatedNodes: [...loadout.allocatedNodes].sort((a, b) => a - b),
    equipment: [...loadout.equipment]
      .sort((a, b) => a.slot.localeCompare(b.slot))
      .map((item) => ({
        slot: item.slot,
        name: item.name,
        baseType: item.baseType ?? null,
        modLines: [...item.modLines].sort(),
      })),
    skills: [...loadout.skills]
      .sort((a, b) => a.socketGroup.localeCompare(b.socketGroup))
      .map((s) => ({ socketGroup: s.socketGroup, mainSkill: s.mainSkill, gems: [...s.gems].sort() })),
    config: loadout.config,
  };
}

/**
 * Compute the Canonical Identity of a snapshot's build state (RFC-0001 I2).
 * Identical build state ⇒ identical id, independent of source/import time.
 */
export function computeCanonicalIdentity(state: IdentityState): string {
  const canonical = canonicalStringify({
    character: state.character,
    primaryLoadoutId: state.primaryLoadoutId,
    loadouts: [...state.loadouts]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(canonicalizeLoadout),
  });
  return `bs_${fnv1a(canonical)}`;
}

/** Rebuild the `id` field of a snapshot from its current build state. */
function withRecomputedIdentity(snapshot: BuildSnapshot): BuildSnapshot {
  return { ...snapshot, id: computeCanonicalIdentity(snapshot) };
}

// --- Loadout helpers ---------------------------------------------------------

/**
 * Resolve the loadout a consumer should operate on: the designated primary,
 * falling back to the first present. Returns undefined when a snapshot carries
 * no loadouts (consumers must not assume exactly one exists — AD-5).
 */
export function getPrimaryLoadout(snapshot: BuildSnapshot): LoadoutContext | undefined {
  return snapshot.loadouts.find((l) => l.id === snapshot.primaryLoadoutId) ?? snapshot.loadouts[0];
}

// --- Promotion ---------------------------------------------------------------

/** Thrown when a mutation is applied to a snapshot that is not its base. */
export class MutationBaseMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(`BuildMutation base ${expected} does not match snapshot ${actual}`);
    this.name = 'MutationBaseMismatchError';
  }
}

function applyOp(loadouts: LoadoutContext[], op: MutationOp): LoadoutContext[] {
  const idx = loadouts.findIndex((l) => l.id === op.loadoutId);
  if (idx === -1) {
    throw new Error(`BuildMutation targets unknown loadout "${op.loadoutId}"`);
  }
  const loadout = loadouts[idx]!;
  let next: LoadoutContext;
  switch (op.kind) {
    case 'allocateNode': {
      const nodes = new Set(loadout.allocatedNodes);
      nodes.add(op.nodeId);
      next = { ...loadout, allocatedNodes: [...nodes].sort((a, b) => a - b) };
      break;
    }
    case 'deallocateNode': {
      next = { ...loadout, allocatedNodes: loadout.allocatedNodes.filter((n) => n !== op.nodeId) };
      break;
    }
    case 'setGear': {
      const equipment = loadout.equipment.filter((g) => g.slot !== op.slot);
      if (op.item !== null) equipment.push(op.item);
      next = { ...loadout, equipment };
      break;
    }
    case 'setSkill': {
      const skills = loadout.skills.filter((s) => s.socketGroup !== op.socketGroup);
      if (op.setup !== null) skills.push(op.setup);
      next = { ...loadout, skills };
      break;
    }
    case 'setConfig': {
      const config: Record<string, ConfigValue> = { ...loadout.config };
      if (op.value === null) delete config[op.key];
      else config[op.key] = op.value;
      next = { ...loadout, config };
      break;
    }
  }
  const updated = [...loadouts];
  updated[idx] = next;
  return updated;
}

/**
 * Promote a BuildMutation: apply its delta to its base BuildSnapshot to produce
 * a NEW, immutable snapshot with a freshly computed Canonical Identity
 * (RFC-0001 AD-2, I1). The base is never modified.
 *
 * @throws MutationBaseMismatchError if the mutation's base id ≠ the snapshot id.
 */
export function promoteMutation(base: BuildSnapshot, mutation: BuildMutation): BuildSnapshot {
  if (mutation.baseSnapshotId !== base.id) {
    throw new MutationBaseMismatchError(mutation.baseSnapshotId, base.id);
  }
  let loadouts: LoadoutContext[] = base.loadouts.map((l) => ({
    ...l,
    allocatedNodes: [...l.allocatedNodes],
    equipment: [...l.equipment],
    skills: [...l.skills],
    config: { ...l.config },
  }));
  for (const op of mutation.ops) {
    loadouts = applyOp(loadouts, op);
  }
  return withRecomputedIdentity({ ...base, loadouts });
}

/** Convenience constructor that fills in a deterministic Canonical Identity. */
export function makeSnapshot(input: Omit<BuildSnapshot, 'id'>): BuildSnapshot {
  return withRecomputedIdentity({ ...input, id: '' });
}
