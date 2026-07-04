// @exilelab/core — BuildMutation factory + promotion (RFC-0001 AD-2).

import type {
  BuildMutation,
  BuildMutationInput,
  BuildSnapshot,
  BuildState,
  EquipmentItem,
  LoadoutContext,
  Metadata,
  MutationOperation,
  SkillSetup,
} from './types.js';
import { BuildMutationInputSchema } from './schema.js';
import { sha256Hex, stableStringify } from './canonical.js';
import { createBuildSnapshot } from './snapshot.js';

/**
 * Create a validated, immutable BuildMutation. The mutationId is the sha256 hex
 * of the canonical serialization of (baseSnapshotId, operations). Operation
 * order is SEMANTIC (apply sequence) and is preserved in the hash — two
 * mutations with the same operations in a different order are distinct.
 */
export function createBuildMutation(input: BuildMutationInput): BuildMutation {
  const parsed = BuildMutationInputSchema.parse(input);
  const mutationId = sha256Hex(
    stableStringify({ baseSnapshotId: parsed.baseSnapshotId, operations: parsed.operations }),
  );
  return Object.freeze({
    mutationId,
    baseSnapshotId: parsed.baseSnapshotId,
    operations: Object.freeze([...parsed.operations]) as readonly MutationOperation[],
  });
}

// Mutable mirrors of the readonly canonical types, used only inside the local
// structuredClone working copy during promotion.
type MutableSkillSetup = {
  setupId: string;
  isMainSkill: boolean;
  skillGemRef: string | null;
  socket: string | null;
  supports: string[];
};
type MutableLoadout = {
  contextId: string;
  primary: boolean;
  passiveTree: { allocatedNodes: number[]; masteryEffects: Array<{ nodeId: number; effectId: number }> };
  equipment: Array<{ slot: string; itemRef: string | null; rarity: string | null; modifiers: string[] }>;
  skills: MutableSkillSetup[];
};
type MutableBuildState = {
  character: BuildState['character'];
  loadoutContexts: MutableLoadout[];
  configuration: Array<{ key: string; value: string | number | boolean }>;
  assumptions: BuildState['assumptions'];
};

function requireLoadout(state: MutableBuildState, contextId: string): MutableLoadout {
  const lc = state.loadoutContexts.find((c) => c.contextId === contextId);
  if (!lc) {
    throw new Error(`promoteMutation: no Loadout Context with id "${contextId}"`);
  }
  return lc;
}

function requireSetup(loadout: MutableLoadout, setupId: string): MutableSkillSetup {
  const setup = loadout.skills.find((s) => s.setupId === setupId);
  if (!setup) {
    throw new Error(`promoteMutation: no skill setup with id "${setupId}" in loadout "${loadout.contextId}"`);
  }
  return setup;
}

function applyOperation(state: MutableBuildState, op: MutationOperation): void {
  switch (op.kind) {
    case 'allocatePassiveNode': {
      const lc = requireLoadout(state, op.loadoutContextId);
      if (!lc.passiveTree.allocatedNodes.includes(op.nodeId)) {
        lc.passiveTree.allocatedNodes.push(op.nodeId);
      }
      return;
    }
    case 'deallocatePassiveNode': {
      const lc = requireLoadout(state, op.loadoutContextId);
      lc.passiveTree.allocatedNodes = lc.passiveTree.allocatedNodes.filter((n) => n !== op.nodeId);
      return;
    }
    case 'swapItem': {
      const lc = requireLoadout(state, op.loadoutContextId);
      const item = structuredClone(op.item) as EquipmentItem as MutableLoadout['equipment'][number];
      lc.equipment = lc.equipment.filter((e) => e.slot !== op.item.slot);
      lc.equipment.push(item);
      return;
    }
    case 'changeGem': {
      const lc = requireLoadout(state, op.loadoutContextId);
      requireSetup(lc, op.setupId).skillGemRef = op.skillGemRef;
      return;
    }
    case 'changeSupport': {
      const lc = requireLoadout(state, op.loadoutContextId);
      const setup = requireSetup(lc, op.setupId);
      if (op.removeSupportRef !== undefined) {
        setup.supports = setup.supports.filter((s) => s !== op.removeSupportRef);
      }
      if (op.addSupportRef !== undefined && !setup.supports.includes(op.addSupportRef)) {
        setup.supports.push(op.addSupportRef);
      }
      return;
    }
    case 'changeConfig': {
      const entry = state.configuration.find((c) => c.key === op.key);
      if (entry) {
        entry.value = op.value;
      } else {
        state.configuration.push({ key: op.key, value: op.value });
      }
      return;
    }
    default: {
      const _exhaustive: never = op;
      throw new Error(`promoteMutation: unknown operation ${String((_exhaustive as { kind?: string }).kind)}`);
    }
  }
}

/**
 * Promote a BuildMutation against its base snapshot to produce a NEW immutable
 * BuildSnapshot (RFC-0001 AD-2). The base snapshot is NEVER mutated — the delta
 * is applied to a structuredClone of the base build state. Identity is recomputed
 * for the result (a changed build state yields a new identity; a no-op delta
 * yields the same identity).
 *
 * Provenance records the promotion: source "promoted-mutation" referencing the
 * originating mutationId. Metadata's patch/format versions carry over from the
 * base; DisplayCache is cloned (its staleness is a rendering concern only, R9).
 *
 * @throws if the mutation's baseSnapshotId does not match the base snapshot's
 *         identity, or an operation targets a non-existent loadout/setup.
 */
export function promoteMutation(base: BuildSnapshot, mutation: BuildMutation): BuildSnapshot {
  if (mutation.baseSnapshotId !== base.identity) {
    throw new Error(
      `promoteMutation: mutation.baseSnapshotId (${mutation.baseSnapshotId}) does not match base.identity (${base.identity})`,
    );
  }

  const nextState = structuredClone(base.buildState) as MutableBuildState;
  for (const op of mutation.operations) {
    applyOperation(nextState, op);
  }

  const metadata: Metadata = {
    patchVersion: base.metadata.patchVersion,
    formatVersion: base.metadata.formatVersion,
    provenance: {
      source: 'promoted-mutation',
      reference: mutation.mutationId,
      importedAt: base.metadata.provenance.importedAt,
      ...(base.metadata.provenance.attribution !== undefined
        ? { attribution: base.metadata.provenance.attribution }
        : {}),
    },
    ...(base.metadata.label !== undefined ? { label: base.metadata.label } : {}),
    ...(base.metadata.league !== undefined ? { league: base.metadata.league } : {}),
  };

  return createBuildSnapshot({
    buildState: nextState as unknown as BuildState,
    metadata,
    displayCache: structuredClone(base.displayCache),
  });
}

// Re-exported for consumers that only need the loadout/skill shapes at the
// mutation boundary without pulling the whole types module.
export type { LoadoutContext, SkillSetup };
