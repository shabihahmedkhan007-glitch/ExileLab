// Snapshot fixture factories for tests.
//
// NOTE: RFC-0001's BuildSnapshot factories live in @exilelab/core, which is
// still a stub at time of writing (it exports nothing). These local factories
// build the structural BuildSnapshot view this package consumes; when core
// ships its canonical factories, these are the natural replacement seam.

import type {
  BuildSnapshot,
  DefensiveLayers,
  LoadoutContext,
  ResourceState,
  SnapshotSkill,
} from './types.js';

let counter = 0;

/** Build a minimal, valid BuildSnapshot with one primary Loadout Context. */
export function makeSnapshot(input: {
  skills: SnapshotSkill[];
  defence?: DefensiveLayers;
  resources?: ResourceState;
  className?: string;
  ascendancy?: string;
}): BuildSnapshot {
  counter += 1;
  const loadout: LoadoutContext = {
    id: `loadout-${counter}`,
    isPrimary: true,
    skills: input.skills,
    defence: input.defence,
    resources: input.resources,
  };
  return {
    snapshotFormatVersion: '1',
    gamePatch: '0.1.0',
    character: {
      className: input.className,
      ascendancy: input.ascendancy,
      level: 90,
    },
    loadouts: [loadout],
  };
}

/** A Twister Huntress: movement carried by a repeated attack skill. */
export function twisterSnapshot(): BuildSnapshot {
  return makeSnapshot({
    className: 'Huntress',
    ascendancy: 'Amazon',
    skills: [
      { skillId: 'twister', displayName: 'Twister', isMainSkill: true },
      { skillId: 'blink', displayName: 'Blink' },
    ],
    defence: { life: 3200, evasion: 6000, energyShield: 0, armour: 0 },
    resources: { unreservedMana: 120, mainSkillCost: 8 },
  });
}

/** An energy-shield tank: ES is the dominant defensive layer. */
export function esTankSnapshot(): BuildSnapshot {
  return makeSnapshot({
    className: 'Sorceress',
    ascendancy: 'Chronomancer',
    skills: [{ skillId: 'spark', displayName: 'Spark', isMainSkill: true }],
    defence: { energyShield: 9000, life: 1200, armour: 500, evasion: 400 },
    resources: { unreservedMana: 200, mainSkillCost: 10 },
  });
}

/** A dash-loop mobility build: a spell attacker that traverses via dash loops. */
export function dashLoopSnapshot(): BuildSnapshot {
  return makeSnapshot({
    className: 'Monk',
    ascendancy: 'Invoker',
    skills: [
      { skillId: 'fireball', displayName: 'Fireball', isMainSkill: true },
      { skillId: 'dash', displayName: 'Dash' },
    ],
    defence: { life: 4000, evasion: 3000, energyShield: 800, armour: 0 },
    resources: { unreservedMana: 150, mainSkillCost: 12 },
  });
}

/** A plain hit-based caster with no special mobility or tank profile. */
export function plainCasterSnapshot(): BuildSnapshot {
  return makeSnapshot({
    className: 'Witch',
    ascendancy: 'Infernalist',
    skills: [{ skillId: 'fireball', displayName: 'Fireball', isMainSkill: true }],
    defence: { life: 4200, energyShield: 600, armour: 300, evasion: 200 },
    resources: { unreservedMana: 180, mainSkillCost: 15 },
  });
}

/** A minion commander: damage delivered by spirit-reserving minions. */
export function minionSnapshot(): BuildSnapshot {
  return makeSnapshot({
    className: 'Witch',
    ascendancy: 'Blood Mage',
    skills: [
      {
        skillId: 'raise-skeletal-warrior',
        displayName: 'Raise Skeletal Warrior',
        isMainSkill: true,
      },
    ],
    defence: { life: 3800, energyShield: 500, armour: 200, evasion: 200 },
    resources: { unreservedSpirit: 20, reservedSpirit: 100, mainSkillCost: 0 },
  });
}

/** A DoT caster: damage delivered over time. */
export function dotCasterSnapshot(): BuildSnapshot {
  return makeSnapshot({
    className: 'Witch',
    ascendancy: 'Infernalist',
    skills: [
      {
        skillId: 'essence-drain',
        displayName: 'Essence Drain',
        isMainSkill: true,
      },
    ],
    defence: { life: 4000, energyShield: 700, armour: 200, evasion: 300 },
    resources: { unreservedMana: 160, mainSkillCost: 20 },
  });
}
