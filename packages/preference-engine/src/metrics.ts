// Inputs to the Preference Engine.
//
// EngineMetrics is the deterministic, engine-computed slice each Preference
// Axis reads. These numbers originate in a Calculation Result (keyed by
// BuildSnapshot x engine version); the Preference Engine never re-derives them
// and never calls the engine itself — it is a pure scoring function over the
// numbers handed to it (RFC-0001 AD-7: calculated values live in Calculation
// Results, never in snapshots).

import type { PreferenceAxis } from './axes.js';

/**
 * The engine-computed metrics the eight Preference Axes read.
 *
 * All fields are plain numbers pulled from a Calculation Result. `changeCost-
 * Divines` is the only change-scoped field: it is 0 for a measured base build
 * and carries the priced cost of a BuildMutation for a candidate.
 */
export interface EngineMetrics {
  // Damage
  /** Full combined DPS of the build's main-skill rotation. */
  fullDPS: number;

  // Survivability
  /** Total effective HP (life/ES/mana-guard composite the engine reports). */
  totalEHP: number;
  /** Largest single hit the build can currently survive. */
  maximumHitTaken: number;

  // Movement Speed
  /** Effective movement-speed multiplier; 1.0 = base, 1.35 = +35%. */
  effectiveMovementSpeedMod: number;

  // Attack Speed / Cast Speed
  /** Attacks per second of the main attack skill. */
  attackRate: number;
  /** Casts per second of the main cast skill. */
  castRate: number;

  // Skill Mobility Efficiency (the Context Detector designates the
  // movement-carrying skill; these describe that skill).
  /** Uses per second of the movement-carrying skill. */
  mobilitySkillRate: number;
  /** Resource cost per use of the movement-carrying skill. */
  mobilitySkillCostPerUse: number;

  // Resource Sustain
  /** Unreserved mana pool available for the rotation. */
  unreservedMana: number;
  /** Mana regenerated per second. */
  manaRegenPerSecond: number;
  /** Sustained resource drain of the main rotation, per second. */
  skillCostPerSecond: number;

  // Currency Efficiency (change-scoped)
  /** Priced cost of the candidate change in Divines; 0 for a base build. */
  changeCostDivines: number;
}

/**
 * A satisficing target band for one axis.
 *
 * The axis score rises with diminishing returns toward `enough` and SATURATES
 * (score = 1.0) at and beyond it — so, e.g., a Boss Farming build is not
 * rewarded for overkill DPS past its band. `enough = null` disables
 * satisficing (pure maximize with diminishing returns) — used by the Maximum
 * DPS preset.
 */
export interface TargetBand {
  /**
   * Metric value at/above which the axis is fully satisfied (score saturates
   * at 1.0). `null` = never saturate (maximize with diminishing returns).
   */
  enough: number | null;
  /**
   * Optional characteristic scale controlling curvature of the approach to
   * `enough`. Defaults are derived from `enough` when omitted.
   */
  scale?: number;
}

/**
 * A Pro-mode floor constraint: the named metric must be >= `min`. A candidate
 * whose metric falls below the floor is marked `belowFloor` and excluded from
 * ranking (a hard constraint, not a penalty).
 */
export interface FloorConstraint {
  metric: keyof EngineMetrics;
  min: number;
}

/** A floor that a set of metrics failed to satisfy. */
export interface FloorViolation {
  metric: keyof EngineMetrics;
  min: number;
  actual: number;
}

/**
 * The satisficing context for scoring: per-axis target bands plus Pro-mode
 * floor constraints. Bundled together because a Goal Preset defines both.
 */
export interface ScoreConstraints {
  /** Per-axis satisficing bands. Axes without an entry use default curves. */
  targets?: Partial<Record<PreferenceAxis, TargetBand>>;
  /** Pro-mode floors; violating candidates are excluded from ranking. */
  floors?: FloorConstraint[];
}
