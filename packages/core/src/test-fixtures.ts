// Test-only fixtures. Not exported from the package entrypoint.
import type { BuildSnapshotInput } from './types.js';

/** Recursively strip `readonly` so tests can build variant inputs by assignment. */
type DeepWritable<T> = T extends readonly (infer U)[]
  ? DeepWritable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
    : T;

/** A representative, valid two-loadout build snapshot input (deeply mutable). */
export function sampleSnapshotInput(): DeepWritable<BuildSnapshotInput> {
  return {
    buildState: {
      character: { class: 'Huntress', ascendancy: 'Ritualist', level: 92 },
      loadoutContexts: [
        {
          contextId: 'set-a',
          primary: true,
          passiveTree: {
            allocatedNodes: [101, 55, 2003, 7],
            masteryEffects: [
              { nodeId: 2003, effectId: 4 },
              { nodeId: 55, effectId: 1 },
            ],
          },
          equipment: [
            { slot: 'weapon1', itemRef: 'spear_base_7', rarity: 'rare', modifiers: ['+40 phys', '12% atk speed'] },
            { slot: 'helmet', itemRef: 'helm_base_3', rarity: 'rare', modifiers: ['+70 life'] },
          ],
          skills: [
            {
              setupId: 'main',
              isMainSkill: true,
              skillGemRef: 'twister',
              socket: 'weapon1',
              supports: ['melee_phys', 'added_cold'],
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
        { key: 'buff.charges', value: 'max' },
      ],
      assumptions: [
        { path: 'configuration.enemy.level', origin: 'defaulted', note: 'source omitted enemy level' },
        { path: 'character.level', origin: 'imported' },
      ],
    },
    metadata: {
      patchVersion: '0.2.0g',
      formatVersion: '1',
      provenance: {
        source: 'pob-code',
        reference: 'abc123',
        importedAt: '2026-07-04T00:00:00.000Z',
        attribution: 'community-author',
      },
      label: 'My Huntress',
      league: 'Standard',
    },
    displayCache: {
      names: { twister: 'Twister', spear_base_7: 'Advanced Spear' },
      icons: { twister: 'icon://twister' },
    },
  };
}
