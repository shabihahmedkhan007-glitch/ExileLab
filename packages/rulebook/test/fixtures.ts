import type { EngineOutputs } from '../src/types.js';

/**
 * The pivotal golden fixture: a build that is comfortably fine for fast mapping
 * at T10, yet materially under-defended for hardcore survivability at the same
 * tier. Its 40,000 EHP clears the fast-mapping floor (33,600) but falls far
 * short of the hardcore floor (67,200) — the exact "same numbers, different
 * verdict under different goals" case the rulebook exists to produce.
 */
export const MID_BUILD: EngineOutputs = {
  fullDps: 1_600_000,
  totalEHP: 40_000,
  maximumHitTaken: {
    physical: 12_000,
    fire: 12_500,
    cold: 12_200,
    lightning: 12_400,
    chaos: 12_100,
  },
  resists: {
    fire: { total: 78, max: 75 },
    cold: { total: 76, max: 75 },
    lightning: { total: 75, max: 75 },
    chaos: { total: 10, max: 75 },
  },
  ailmentProtection: { stunAvoidance: 40, freezeAvoidance: 50, shockAvoidance: 60, igniteAvoidance: 55 },
  defenses: {
    life: 4200,
    energyShield: 800,
    armour: 12_000,
    evasion: 5000,
    blockChance: 25,
    spellSuppression: 40,
    energyShieldRechargeProtected: true,
  },
  sustain: {
    netLifeRegen: 350,
    totalBuildDegen: 0,
    lifeLeechRatePerSecond: 900,
    energyShieldRechargeRate: 200,
  },
  skills: [{ name: 'Twister', manaCost: 20, lifeCost: 0 }],
  unreservedMana: 80,
  unreservedLife: 4200,
  warnings: [],
};

/** A deliberately broken build: undercapped resists, negative sustain, unusable skill. */
export const BROKEN_BUILD: EngineOutputs = {
  fullDps: 120_000,
  totalEHP: 9_000,
  maximumHitTaken: {
    physical: 3_000,
    fire: 2_800,
    cold: 3_100,
    lightning: 2_900,
    chaos: 1_500,
  },
  resists: {
    fire: { total: 40, max: 75 },
    cold: { total: 55, max: 75 },
    lightning: { total: 60, max: 75 },
    chaos: { total: -60, max: 75 },
  },
  ailmentProtection: { stunAvoidance: 0, freezeAvoidance: 0, shockAvoidance: 0, igniteAvoidance: 0 },
  defenses: {
    life: 2200,
    energyShield: 3000,
    armour: 0,
    evasion: 800,
    blockChance: 0,
    spellSuppression: 0,
    energyShieldRechargeProtected: false,
  },
  sustain: {
    netLifeRegen: -180,
    totalBuildDegen: 200,
    lifeLeechRatePerSecond: 0,
    energyShieldRechargeRate: 0,
  },
  skills: [{ name: 'Firestorm', manaCost: 140, lifeCost: 0 }],
  unreservedMana: 60,
  unreservedLife: 2200,
  warnings: ['This skill cannot be supported by that support gem'],
};

/** A clean, well-rounded build that should pass every rule under balanced goals. */
export const HEALTHY_BUILD: EngineOutputs = {
  fullDps: 3_000_000,
  totalEHP: 120_000,
  maximumHitTaken: {
    physical: 30_000,
    fire: 31_000,
    cold: 30_500,
    lightning: 30_800,
    chaos: 29_000,
  },
  resists: {
    fire: { total: 75, max: 75 },
    cold: { total: 75, max: 75 },
    lightning: { total: 75, max: 75 },
    chaos: { total: 40, max: 75 },
  },
  ailmentProtection: { stunAvoidance: 100, freezeAvoidance: 100, shockAvoidance: 100, igniteAvoidance: 100 },
  defenses: {
    life: 5500,
    energyShield: 2000,
    armour: 25_000,
    evasion: 12_000,
    blockChance: 40,
    spellSuppression: 50,
    energyShieldRechargeProtected: true,
  },
  sustain: {
    netLifeRegen: 1200,
    totalBuildDegen: 0,
    lifeLeechRatePerSecond: 2500,
    energyShieldRechargeRate: 600,
  },
  skills: [{ name: 'Boneshatter', manaCost: 15, lifeCost: 0 }],
  unreservedMana: 120,
  unreservedLife: 5500,
  warnings: [],
};
