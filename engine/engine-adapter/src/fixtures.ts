// @exilelab/engine-adapter — the MockEngine's own conformance suite (the FIRST suite).
//
// GOLDEN fixtures: input snapshots (+ an optional candidate mutation) paired with
// the exact metrics the current MockEngine formulas produce. The expected values
// are frozen constants checked into source — they guard the mock's formulas
// against accidental change and demonstrate the fixture format the real PoB2
// sidecar's parity suite will reuse. Regenerate with `scripts/gen-fixtures.ts`
// only on an INTENTIONAL formula change, and review the diff.

import type { BuildSnapshotInput, BuildMutationInput } from '@exilelab/core';
import type { ConformanceFixture } from './conformance.js';

/** A representative two-loadout Huntress build (base). */
export function twoLoadoutInput(): BuildSnapshotInput {
  return {
    buildState: {
      character: { class: 'Huntress', ascendancy: 'Ritualist', level: 92 },
      loadoutContexts: [
        {
          contextId: 'set-a',
          primary: true,
          passiveTree: {
            allocatedNodes: [101, 55, 2003, 7, 88, 412],
            masteryEffects: [
              { nodeId: 2003, effectId: 4 },
              { nodeId: 55, effectId: 1 },
            ],
          },
          equipment: [
            { slot: 'weapon1', itemRef: 'spear_base_7', rarity: 'rare', modifiers: ['+40 phys', '12% atk speed'] },
            { slot: 'helmet', itemRef: 'helm_base_3', rarity: 'rare', modifiers: ['+70 life', '+30% fire res'] },
            { slot: 'body', itemRef: 'armour_base_9', rarity: 'rare', modifiers: ['+120 armour', '+25% cold res'] },
          ],
          skills: [
            {
              setupId: 'main',
              isMainSkill: true,
              skillGemRef: 'twister',
              socket: 'weapon1',
              supports: ['melee_phys', 'added_cold', 'fork'],
            },
            {
              setupId: 'aura',
              isMainSkill: false,
              skillGemRef: 'hatred',
              socket: 'helmet',
              supports: [],
            },
          ],
        },
        {
          contextId: 'set-b',
          primary: false,
          passiveTree: { allocatedNodes: [7, 55], masteryEffects: [] },
          equipment: [
            { slot: 'weapon1', itemRef: 'crossbow_base_2', rarity: 'unique', modifiers: [] },
          ],
          skills: [
            { setupId: 'swap', isMainSkill: false, skillGemRef: 'gas_grenade', socket: 'weapon1', supports: [] },
          ],
        },
      ],
      configuration: [
        { key: 'enemy.isBoss', value: true },
        { key: 'enemy.level', value: 84 },
      ],
      assumptions: [{ path: 'character.level', origin: 'imported' }],
    },
    metadata: {
      patchVersion: '0.2.0g',
      formatVersion: '1',
      provenance: { source: 'pob-code', reference: 'abc123', importedAt: '2026-07-04T00:00:00.000Z' },
      label: 'Huntress',
      league: 'Standard',
    },
    displayCache: { names: { twister: 'Twister' }, icons: {} },
  };
}

/** A minimal single-loadout build (no gear mods, no supports). */
export function minimalInput(): BuildSnapshotInput {
  return {
    buildState: {
      character: { class: 'Warrior', ascendancy: null, level: 40 },
      loadoutContexts: [
        {
          contextId: 'only',
          primary: true,
          passiveTree: { allocatedNodes: [1, 2, 3], masteryEffects: [] },
          equipment: [{ slot: 'weapon1', itemRef: 'mace_base_1', rarity: 'normal', modifiers: [] }],
          skills: [
            { setupId: 'main', isMainSkill: true, skillGemRef: 'boneshatter', socket: 'weapon1', supports: [] },
          ],
        },
      ],
      configuration: [],
      assumptions: [],
    },
    metadata: {
      patchVersion: '0.2.0g',
      formatVersion: '1',
      provenance: { source: 'pob-code', importedAt: '2026-07-04T00:00:00.000Z' },
    },
    displayCache: { names: {}, icons: {} },
  };
}

/**
 * A candidate mutation against the two-loadout base: allocate two nodes and add a
 * support gem to the main skill. This changes structural features (node count +
 * support links) and therefore the promoted identity, so its metrics differ from
 * the base — the fixture that proves a mutation moves the numbers.
 */
export function twoLoadoutMutation(baseSnapshotId: string): BuildMutationInput {
  return {
    baseSnapshotId,
    operations: [
      { kind: 'allocatePassiveNode', loadoutContextId: 'set-a', nodeId: 999 },
      { kind: 'allocatePassiveNode', loadoutContextId: 'set-a', nodeId: 1000 },
      { kind: 'changeSupport', loadoutContextId: 'set-a', setupId: 'main', addSupportRef: 'increased_crit' },
    ],
  };
}

/**
 * Canonical Identity of {@link twoLoadoutInput}, frozen alongside the golden
 * metrics. Needed as the mutation fixture's `baseSnapshotId`. If the two-loadout
 * input ever changes, regenerate (scripts/gen-fixtures.ts).
 */
export const TWO_LOADOUT_IDENTITY =
  '0dff4039bee827409dc34d675eb1c07e4404d616a3c05f66872cabe55294e078';

// --- Golden expected metrics (frozen; generated by scripts/gen-fixtures.ts) ---
// Regenerated 2026-07-05 after the INTENTIONAL core identity change (RFC-0001
// §5.3/I2 fix: Assumptions excluded from Canonical Identity). The MockEngine's
// hash-seeded jitter derives from snapshot identity, so all golden metrics
// shifted with it.

const GOLDEN_TWO_LOADOUT: Record<string, number> = {
  dps: 26438,
  life: 3363,
  energyShield: 777,
  armour: 1856,
  evasion: 1495,
  ehp: 7232,
  fireResistance: 61,
  coldResistance: 55,
  lightningResistance: 44,
  chaosResistance: 2,
  fireResistanceOverCap: 0,
  coldResistanceOverCap: 0,
  lightningResistanceOverCap: 0,
  movementSpeed: 105,
  attackSpeed: 1.45,
  castSpeed: 1.08,
  manaRegen: 235,
};

const GOLDEN_MINIMAL: Record<string, number> = {
  dps: 6300,
  life: 1847,
  energyShield: 268,
  armour: 768,
  evasion: 647,
  ehp: 3671,
  fireResistance: 30,
  coldResistance: 27,
  lightningResistance: 42,
  chaosResistance: -28,
  fireResistanceOverCap: 0,
  coldResistanceOverCap: 0,
  lightningResistanceOverCap: 0,
  movementSpeed: 110,
  attackSpeed: 1.1,
  castSpeed: 1.4,
  manaRegen: 135,
};

const GOLDEN_TWO_LOADOUT_MUTATED: Record<string, number> = {
  dps: 28282,
  life: 3053,
  energyShield: 781,
  armour: 1810,
  evasion: 1622,
  ehp: 8265,
  fireResistance: 52,
  coldResistance: 54,
  lightningResistance: 61,
  chaosResistance: 3,
  fireResistanceOverCap: 0,
  coldResistanceOverCap: 0,
  lightningResistanceOverCap: 0,
  movementSpeed: 127,
  attackSpeed: 1.28,
  castSpeed: 1.15,
  manaRegen: 226,
};

/**
 * The MockEngine conformance suite — the first suite the {@link runConformanceSuite}
 * runner is exercised against. Exact-match (tolerance 0): the mock is fully
 * deterministic, so any drift is a real change.
 */
export function mockEngineFixtures(): ConformanceFixture[] {
  return [
    { name: 'two-loadout-base', snapshotInput: twoLoadoutInput(), expectedMetrics: GOLDEN_TWO_LOADOUT },
    { name: 'minimal-single-loadout', snapshotInput: minimalInput(), expectedMetrics: GOLDEN_MINIMAL },
    {
      name: 'two-loadout-mutated',
      snapshotInput: twoLoadoutInput(),
      mutationInput: twoLoadoutMutation(TWO_LOADOUT_IDENTITY),
      expectedMetrics: GOLDEN_TWO_LOADOUT_MUTATED,
    },
  ];
}
