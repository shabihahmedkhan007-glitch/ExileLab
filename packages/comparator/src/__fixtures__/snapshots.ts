// Deterministic fixture snapshots for golden diff tests. Two versions of one
// archetype ("Twister Huntress" speed-mapper) plus variants used to exercise
// consensus. Build-state only (RFC-0001 AD-7).

import type { BuildSnapshot, Provenance } from '../model.js';
import { makeSnapshot } from '../model.js';

function base(
  provenance: Provenance,
  overrides: {
    nodes: number[];
    bodyMods: string[];
    weaponSkillGems: string[];
    config: Record<string, string | number | boolean>;
  },
): BuildSnapshot {
  return makeSnapshot({
    formatVersion: 1,
    gamePatch: '0.1.0',
    character: { className: 'Huntress', ascendancy: 'Ritualist', level: 92 },
    primaryLoadoutId: 'primary',
    loadouts: [
      {
        id: 'primary',
        allocatedNodes: overrides.nodes,
        equipment: [
          { slot: 'weapon1', name: 'Spine Spear', baseType: 'Spear', modLines: ['Adds 20 Physical Damage', '25% increased Attack Speed'] },
          { slot: 'body', name: 'Astral Plate', baseType: 'Body Armour', modLines: overrides.bodyMods },
        ],
        skills: [
          { socketGroup: 'weapon1', mainSkill: 'Whirling Assault', gems: overrides.weaponSkillGems },
          { socketGroup: 'boots', mainSkill: 'Herald of Ash', gems: [] },
        ],
        config: overrides.config,
      },
    ],
    provenance,
  });
}

/** The user's build. */
export const userBuild: BuildSnapshot = base(
  { source: 'user', label: 'My Twister Huntress' },
  {
    nodes: [101, 102, 103, 200, 201],
    bodyMods: ['+80 to maximum Life', '30% increased Armour'],
    weaponSkillGems: ['Martial Tempo', 'Primal Armament'],
    config: { enemyLevel: 84, shockedEnemy: false },
  },
);

/** Maxroll's version of the same archetype: extra crit cluster, better body, adds Ancestral Urgency. */
export const maxrollBuild: BuildSnapshot = base(
  { source: 'maxroll', reference: 'twister-huntress', label: 'Maxroll Twister' },
  {
    nodes: [101, 102, 103, 200, 300, 301], // drops 201, adds 300, 301
    bodyMods: ['+80 to maximum Life', '30% increased Armour', '+25% to Fire Resistance'],
    weaponSkillGems: ['Martial Tempo', 'Ancestral Urgency'], // swaps Primal Armament → Ancestral Urgency
    config: { enemyLevel: 84, shockedEnemy: true }, // shockedEnemy flipped
  },
);

/** Mobalytics version: diverges only in its own unique node — shares none of Maxroll/ninja's changes. */
export const mobalyticsBuild: BuildSnapshot = base(
  { source: 'mobalytics', reference: 'twister', label: 'Mobalytics Twister' },
  {
    nodes: [101, 102, 103, 200, 201, 500], // user's nodes + one unique node
    bodyMods: ['+80 to maximum Life', '30% increased Armour'], // same as user
    weaponSkillGems: ['Martial Tempo', 'Primal Armament'], // same as user
    config: { enemyLevel: 84, shockedEnemy: false }, // same as user
  },
);

/** poe.ninja top-player version: shares the crit cluster + skill swap with Maxroll (consensus). */
export const ninjaBuild: BuildSnapshot = base(
  { source: 'poe.ninja', reference: 'char/TopPlayer', label: 'poe.ninja #1' },
  {
    nodes: [101, 102, 103, 200, 300, 301, 400], // shares 300/301, drops 201, adds unique 400
    bodyMods: ['+80 to maximum Life', '30% increased Armour'], // same body as user
    weaponSkillGems: ['Martial Tempo', 'Ancestral Urgency'], // same skill swap as Maxroll
    config: { enemyLevel: 84, shockedEnemy: false }, // same as user
  },
);
