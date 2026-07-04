// The skill-mechanics data table.
//
// This is the deterministic, data-driven knowledge the detector needs about
// active skills that the BuildSnapshot itself does not carry: whether a skill
// is a movement skill, whether it is channelled, whether it is an attack or a
// spell (or summons minions / is a pure travel skill), whether the build's
// movement is carried by *repeated use* of that skill (Twister-style attacks,
// dash loops), whether it deals damage over time, and which resource it spends.
//
// It is plain data: no ML, no LLM, no network. New skills are added as rows.

import type { ResourceKind } from './types.js';

/** The action category of a skill (covers "attack vs spell" + minion + travel). */
export type SkillActionType = 'attack' | 'spell' | 'minion' | 'travel';

/** One row of skill-mechanics knowledge, keyed by canonical skill id. */
export interface SkillMechanics {
  skillId: string;
  actionType: SkillActionType;
  /** Is this a dedicated movement skill (Dash, Blink, travel whirl)? */
  isMovementSkill: boolean;
  /** Is this a channelled skill? */
  isChannelled: boolean;
  /**
   * Is movement carried by *repeated use* of this skill? True for skills where
   * spamming the skill is how you traverse (Twister attack-as-movement, dash
   * loops, whirling travel). This is the flag the attack-as-movement and
   * dash-loop archetypes hinge on.
   */
  repeatedUseMobility: boolean;
  /** Does the skill deal damage over time (DoT) rather than on hit? */
  dealsDamageOverTime: boolean;
  /** Primary resource the skill spends / reserves. */
  resource: ResourceKind;
}

/**
 * Default skill-mechanics table. Deliberately small — enough to classify the
 * archetypes the product cares about at launch. Extend by adding rows.
 */
export const DEFAULT_SKILL_MECHANICS: readonly SkillMechanics[] = [
  // Attack-as-movement carriers: a damage attack that also moves you.
  {
    skillId: 'twister',
    actionType: 'attack',
    isMovementSkill: true,
    isChannelled: false,
    repeatedUseMobility: true,
    dealsDamageOverTime: false,
    resource: 'mana',
  },
  {
    skillId: 'whirling-assault',
    actionType: 'attack',
    isMovementSkill: true,
    isChannelled: false,
    repeatedUseMobility: true,
    dealsDamageOverTime: false,
    resource: 'mana',
  },

  // Dedicated travel / dash-loop mobility skills.
  {
    skillId: 'dash',
    actionType: 'travel',
    isMovementSkill: true,
    isChannelled: false,
    repeatedUseMobility: true,
    dealsDamageOverTime: false,
    resource: 'mana',
  },
  {
    skillId: 'blink',
    actionType: 'travel',
    isMovementSkill: true,
    isChannelled: false,
    repeatedUseMobility: true,
    dealsDamageOverTime: false,
    resource: 'mana',
  },

  // Hit spellcasters.
  {
    skillId: 'spark',
    actionType: 'spell',
    isMovementSkill: false,
    isChannelled: false,
    repeatedUseMobility: false,
    dealsDamageOverTime: false,
    resource: 'mana',
  },
  {
    skillId: 'fireball',
    actionType: 'spell',
    isMovementSkill: false,
    isChannelled: false,
    repeatedUseMobility: false,
    dealsDamageOverTime: false,
    resource: 'mana',
  },

  // Damage-over-time spells.
  {
    skillId: 'essence-drain',
    actionType: 'spell',
    isMovementSkill: false,
    isChannelled: false,
    repeatedUseMobility: false,
    dealsDamageOverTime: true,
    resource: 'mana',
  },
  {
    skillId: 'contagion',
    actionType: 'spell',
    isMovementSkill: false,
    isChannelled: false,
    repeatedUseMobility: false,
    dealsDamageOverTime: true,
    resource: 'mana',
  },

  // Minion skills (spirit-reserving commanders).
  {
    skillId: 'raise-skeletal-warrior',
    actionType: 'minion',
    isMovementSkill: false,
    isChannelled: false,
    repeatedUseMobility: false,
    dealsDamageOverTime: false,
    resource: 'spirit',
  },
  {
    skillId: 'summon-raging-spirit',
    actionType: 'minion',
    isMovementSkill: false,
    isChannelled: false,
    repeatedUseMobility: false,
    dealsDamageOverTime: false,
    resource: 'spirit',
  },
] as const;

/**
 * Conservative default for a skill absent from the table: a mana-spending hit
 * attack that carries no mobility. Unknown skills therefore never *invent* a
 * mobility archetype; they fall through to hit-based classification.
 */
export function defaultMechanicsFor(skillId: string): SkillMechanics {
  return {
    skillId,
    actionType: 'attack',
    isMovementSkill: false,
    isChannelled: false,
    repeatedUseMobility: false,
    dealsDamageOverTime: false,
    resource: 'mana',
  };
}

/** Build a fast lookup Map from a mechanics table. */
export function indexMechanics(
  table: readonly SkillMechanics[] = DEFAULT_SKILL_MECHANICS,
): ReadonlyMap<string, SkillMechanics> {
  const map = new Map<string, SkillMechanics>();
  for (const row of table) map.set(row.skillId, row);
  return map;
}

/** Resolve mechanics for a skill id, falling back to a conservative default. */
export function resolveMechanics(
  skillId: string,
  index: ReadonlyMap<string, SkillMechanics>,
): SkillMechanics {
  return index.get(skillId) ?? defaultMechanicsFor(skillId);
}
