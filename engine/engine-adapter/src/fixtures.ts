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
  '4ee9f4e5fce5317bf0a557f099b93d210a384dcaf2e791ae4c0bcd3a3424cac9';

// --- Golden expected metrics (frozen; generated by scripts/gen-fixtures.ts) ---

const GOLDEN_TWO_LOADOUT: Record<string, number> = {
  dps: 27257,
  life: 3044,
  energyShield: 757,
  armour: 1883,
  evasion: 1600,
  ehp: 7410,
  fireResistance: 64,
  coldResistance: 68,
  lightningResistance: 72,
  chaosResistance: 18,
  fireResistanceOverCap: 0,
  coldResistanceOverCap: 0,
  lightningResistanceOverCap: 0,
  movementSpeed: 125,
  attackSpeed: 1.52,
  castSpeed: 1.06,
  manaRegen: 232,
};

const GOLDEN_MINIMAL: Record<string, number> = {
  dps: 7177,
  life: 1653,
  energyShield: 265,
  armour: 796,
  evasion: 582,
  ehp: 3861,
  fireResistance: 37,
  coldResistance: 38,
  lightningResistance: 36,
  chaosResistance: -6,
  fireResistanceOverCap: 0,
  coldResistanceOverCap: 0,
  lightningResistanceOverCap: 0,
  movementSpeed: 128,
  attackSpeed: 1.44,
  castSpeed: 1.14,
  manaRegen: 100,
};

const GOLDEN_TWO_LOADOUT_MUTATED: Record<string, number> = {
  dps: 30434,
  life: 3522,
  energyShield: 729,
  armour: 2107,
  evasion: 1509,
  ehp: 8633,
  fireResistance: 58,
  coldResistance: 51,
  lightningResistance: 69,
  chaosResistance: -18,
  fireResistanceOverCap: 0,
  coldResistanceOverCap: 0,
  lightningResistanceOverCap: 0,
  movementSpeed: 122,
  attackSpeed: 1.71,
  castSpeed: 1.22,
  manaRegen: 221,
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
