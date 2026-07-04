// Goal-aware threshold derivation (PRODUCT_PLAN Phase 2 item 3).
//
// A build's raw engine outputs mean nothing without a bar to clear. The bar is
// set by two inputs: the *content tier* (bigger hits, higher DPS expectation as
// tier rises) and the *declared goal* (hardcore-survivability tightens the
// defensive floors; speed-clear relaxes them). `computeThresholds` is the one
// pure function that turns (goal, tier) into the numeric floors every rule
// compares against — so the same EngineOutputs can pass one goal and fail
// another purely through these numbers.
import type { ContentTier, DoctorThresholds, Goal, Severity } from './types.js';

/** Per-goal scaling of the tier baseline. Every field is a design knob. */
interface GoalProfile {
  /** Scales the required TotalEHP. */
  ehpMultiplier: number;
  /** Scales the required MaximumHitTaken vs the expected tier hit. */
  maxHitMultiplier: number;
  /** Absolute chaos-resist floor, in percent. */
  chaosResFloor: number;
  /** Required stun avoidance, percent. */
  stunAvoidanceFloor: number;
  /** Required freeze/shock/ignite avoidance, percent. */
  ailmentAvoidanceFloor: number;
  /** Scales the net-life-regen floor. */
  netRegenMultiplier: number;
  /** Scales the expected DPS band (satisficing: goals want *enough*, not max). */
  dpsMultiplier: number;
  /** Overcap beyond this many points reads as recoverable waste. */
  resistOvercapWaste: number;
  /** Highest severity DOC-5 may reach under this goal. */
  layeringCap: Severity;
}

/**
 * The goal table. Survivability-leaning goals push defensive floors up and
 * relax the DPS expectation; speed/DPS goals do the reverse. These are the
 * numbers that make the Doctor "grade against the active goal".
 */
export const GOAL_PROFILES: Record<Goal, GoalProfile> = {
  'fast-mapping': {
    ehpMultiplier: 0.8,
    maxHitMultiplier: 0.9,
    chaosResFloor: -30,
    stunAvoidanceFloor: 0,
    ailmentAvoidanceFloor: 0,
    netRegenMultiplier: 0.6,
    dpsMultiplier: 1.0,
    resistOvercapWaste: 10,
    layeringCap: 'minor',
  },
  'speed-clearing': {
    ehpMultiplier: 0.8,
    maxHitMultiplier: 0.9,
    chaosResFloor: -30,
    stunAvoidanceFloor: 0,
    ailmentAvoidanceFloor: 0,
    netRegenMultiplier: 0.6,
    dpsMultiplier: 1.1,
    resistOvercapWaste: 10,
    layeringCap: 'minor',
  },
  'boss-farming': {
    ehpMultiplier: 1.1,
    maxHitMultiplier: 1.3,
    chaosResFloor: 0,
    stunAvoidanceFloor: 50,
    ailmentAvoidanceFloor: 40,
    netRegenMultiplier: 1.0,
    dpsMultiplier: 1.3,
    resistOvercapWaste: 20,
    layeringCap: 'major',
  },
  'party-carry': {
    ehpMultiplier: 1.0,
    maxHitMultiplier: 1.1,
    chaosResFloor: 0,
    stunAvoidanceFloor: 40,
    ailmentAvoidanceFloor: 30,
    netRegenMultiplier: 0.9,
    dpsMultiplier: 1.4,
    resistOvercapWaste: 20,
    layeringCap: 'major',
  },
  tanky: {
    ehpMultiplier: 1.4,
    maxHitMultiplier: 1.35,
    chaosResFloor: 20,
    stunAvoidanceFloor: 75,
    ailmentAvoidanceFloor: 60,
    netRegenMultiplier: 1.3,
    dpsMultiplier: 0.7,
    resistOvercapWaste: 25,
    layeringCap: 'major',
  },
  'hardcore-survivability': {
    ehpMultiplier: 1.6,
    maxHitMultiplier: 1.5,
    chaosResFloor: 25,
    stunAvoidanceFloor: 100,
    ailmentAvoidanceFloor: 75,
    netRegenMultiplier: 1.5,
    dpsMultiplier: 0.6,
    resistOvercapWaste: 30,
    layeringCap: 'critical',
  },
  'budget-farming': {
    ehpMultiplier: 0.9,
    maxHitMultiplier: 0.95,
    chaosResFloor: -20,
    stunAvoidanceFloor: 20,
    ailmentAvoidanceFloor: 10,
    netRegenMultiplier: 0.7,
    dpsMultiplier: 0.8,
    resistOvercapWaste: 10,
    layeringCap: 'minor',
  },
  'smooth-gameplay': {
    ehpMultiplier: 1.0,
    maxHitMultiplier: 1.0,
    chaosResFloor: 0,
    stunAvoidanceFloor: 50,
    ailmentAvoidanceFloor: 40,
    netRegenMultiplier: 1.1,
    dpsMultiplier: 0.9,
    resistOvercapWaste: 15,
    layeringCap: 'major',
  },
  'maximum-dps': {
    ehpMultiplier: 0.7,
    maxHitMultiplier: 0.8,
    chaosResFloor: -40,
    stunAvoidanceFloor: 0,
    ailmentAvoidanceFloor: 0,
    netRegenMultiplier: 0.5,
    dpsMultiplier: 1.5,
    resistOvercapWaste: 5,
    layeringCap: 'minor',
  },
  balanced: {
    ehpMultiplier: 1.0,
    maxHitMultiplier: 1.0,
    chaosResFloor: 0,
    stunAvoidanceFloor: 40,
    ailmentAvoidanceFloor: 30,
    netRegenMultiplier: 1.0,
    dpsMultiplier: 1.0,
    resistOvercapWaste: 15,
    layeringCap: 'major',
  },
};

/** The default resistance cap in PoE2 (before max-res investment). */
export const DEFAULT_RESIST_CAP = 75;

/**
 * Tier baseline (goal-independent): the representative largest hit a build must
 * survive at a tier, and the DPS baseline expected to clear it. Deliberately
 * simple linear models — they are the calibration seam, tuned against the build
 * corpus once Build Market data exists (PRD DOC-7 note).
 */
export function tierBaseline(tier: ContentTier): { expectedHit: number; expectedDps: number } {
  const t = Math.max(0, tier);
  return {
    expectedHit: 2500 + t * 800,
    expectedDps: Math.max(1, t) * 150_000,
  };
}

/**
 * Turn a declared goal + content tier into the concrete numeric floors the
 * rules test against. Pure and total.
 */
export function computeThresholds(goal: Goal, tier: ContentTier): DoctorThresholds {
  const profile = GOAL_PROFILES[goal];
  const base = tierBaseline(tier);
  return {
    goal,
    tier,
    resistFloor: DEFAULT_RESIST_CAP,
    resistOvercapWaste: profile.resistOvercapWaste,
    chaosResFloor: profile.chaosResFloor,
    expectedTierHit: base.expectedHit,
    ehpFloor: Math.round(base.expectedHit * 4 * profile.ehpMultiplier),
    maxHitFloorMultiplier: profile.maxHitMultiplier,
    expectedDps: Math.round(base.expectedDps * profile.dpsMultiplier),
    stunAvoidanceFloor: profile.stunAvoidanceFloor,
    ailmentAvoidanceFloor: profile.ailmentAvoidanceFloor,
    netRegenFloor: Math.round(base.expectedHit * 0.02 * profile.netRegenMultiplier),
    layeringCap: profile.layeringCap,
  };
}
