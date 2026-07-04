// Feature extraction: turn a BuildSnapshot slice + the skill-mechanics table
// into a flat, deterministic feature set that the rules table matches against.
//
// Keeping extraction separate from the rules keeps both testable in isolation:
// features are pure derivations; rules are pure predicates over features.

import type {
  BuildSnapshot,
  DamageDelivery,
  DefensiveLayers,
  LoadoutContext,
  ResourceKind,
  SnapshotSkill,
} from './types.js';
import {
  DEFAULT_SKILL_MECHANICS,
  indexMechanics,
  resolveMechanics,
  type SkillMechanics,
} from './skill-mechanics.js';

/** Absolute floor (in ES) above which energy shield can be a tank layer. */
export const ES_TANK_FLOOR = 1500;
/** Reserved-spirit floor above which a build is considered spirit-constrained. */
export const SPIRIT_PRESSURE_FLOOR = 30;

/** A snapshot skill paired with its resolved mechanics. */
export interface EnrichedSkill {
  skill: SnapshotSkill;
  mechanics: SkillMechanics;
}

/** Flat feature set derived from a snapshot; the rules table matches on this. */
export interface BuildFeatures {
  /** The designated main skill (or the first skill if none is designated). */
  mainSkill?: EnrichedSkill;
  /** All skills of the primary loadout, enriched with mechanics. */
  skills: EnrichedSkill[];
  /** Movement is carried by repeatedly using the main *attack* skill (Twister). */
  attackAsMovement: boolean;
  /** Movement is carried by looping a dedicated travel/dash skill. */
  dashLoopMobility: boolean;
  /** How the main skill delivers damage. */
  primaryDelivery: DamageDelivery;
  /** Defensive layers of the primary loadout. */
  defence: DefensiveLayers;
  /** Energy shield is the dominant defensive layer above the tank floor. */
  esDominant: boolean;
  /** The main skill's resource. */
  resource: ResourceKind;
  /** Build is constrained by spirit (minions/auras reserving spirit). */
  spiritPressure: boolean;
  /** Build is constrained by mana (mana-spending main skill). */
  manaPressure: boolean;
}

/** Pick the primary Loadout Context (RFC-0001 AD-5: never assume exactly one). */
export function primaryLoadout(snapshot: BuildSnapshot): LoadoutContext | undefined {
  return snapshot.loadouts.find((l) => l.isPrimary) ?? snapshot.loadouts[0];
}

function deliveryOf(m: SkillMechanics): DamageDelivery {
  if (m.actionType === 'minion') return 'minion';
  if (m.dealsDamageOverTime) return 'dot';
  return 'hit';
}

/**
 * Extract the feature set. Pure: same snapshot + table ⇒ same features
 * (supports RFC-0001 reproducibility).
 */
export function extractFeatures(
  snapshot: BuildSnapshot,
  table: readonly SkillMechanics[] = DEFAULT_SKILL_MECHANICS,
): BuildFeatures {
  const index = indexMechanics(table);
  const loadout = primaryLoadout(snapshot);

  const skills: EnrichedSkill[] = (loadout?.skills ?? []).map((skill) => ({
    skill,
    mechanics: resolveMechanics(skill.skillId, index),
  }));

  const mainSkill =
    skills.find((s) => s.skill.isMainSkill === true) ?? skills[0];

  const attackAsMovement =
    mainSkill !== undefined &&
    mainSkill.mechanics.actionType === 'attack' &&
    mainSkill.mechanics.repeatedUseMobility;

  const dashLoopMobility =
    !attackAsMovement &&
    skills.some(
      (s) =>
        s.mechanics.isMovementSkill &&
        s.mechanics.repeatedUseMobility &&
        s.mechanics.actionType === 'travel',
    );

  const primaryDelivery: DamageDelivery = mainSkill
    ? deliveryOf(mainSkill.mechanics)
    : 'hit';

  const defence: DefensiveLayers = loadout?.defence ?? {};
  const es = defence.energyShield ?? 0;
  const esDominant =
    es >= ES_TANK_FLOOR &&
    es >= (defence.life ?? 0) &&
    es >= (defence.armour ?? 0) &&
    es >= (defence.evasion ?? 0);

  const resource: ResourceKind = mainSkill?.mechanics.resource ?? 'mana';
  const reservedSpirit = loadout?.resources?.reservedSpirit ?? 0;
  // Resource pressure is only meaningful when the build actually casts/attacks
  // something — an empty loadout has no binding resource.
  const spiritPressure =
    mainSkill !== undefined &&
    (resource === 'spirit' ||
      reservedSpirit >= SPIRIT_PRESSURE_FLOOR ||
      skills.some((s) => s.mechanics.resource === 'spirit'));
  const manaPressure =
    mainSkill !== undefined && resource === 'mana' && !spiritPressure;

  return {
    mainSkill,
    skills,
    attackAsMovement,
    dashLoopMobility,
    primaryDelivery,
    defence,
    esDominant,
    resource,
    spiritPressure,
    manaPressure,
  };
}

/** Convenience: a readable name for a skill (Display Cache, else the id). */
export function skillLabel(s: EnrichedSkill | undefined): string {
  if (!s) return 'the main skill';
  return s.skill.displayName ?? s.skill.skillId;
}
