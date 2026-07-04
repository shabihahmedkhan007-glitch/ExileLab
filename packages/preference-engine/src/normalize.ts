// Per-axis normalization curves.
//
// Every axis maps its engine metric(s) into a normalized [0, 1] score using a
// DIMINISHING-RETURNS curve. Axes with a SATISFICING target band (Damage,
// Survivability) saturate at 1.0 once the band is reached, so the optimizer
// stops chasing overkill and spends remaining budget on the user's other
// priorities. All functions are pure and deterministic.

import type { PreferenceAxis } from './axes.js';
import type { EngineMetrics, TargetBand } from './metrics.js';

/**
 * Default characteristic scales for axes and for the secondary terms of
 * composite axes. Exposed for transparency/tuning; presets override the
 * primary `enough` thresholds via `TargetBand`s.
 */
export const DEFAULT_AXIS_SCALES = {
  /** Movement bonus (mod - 1) scale, e.g. 0.5 => +50% reaches ~0.63. */
  moveScale: 0.5,
  /** Attacks/sec scale. */
  attackScale: 4.0,
  /** Casts/sec scale. */
  castScale: 3.0,
  /** Mobility skill uses/sec scale. */
  mobRateScale: 2.5,
  /** Mobility skill cost-per-use scale (affordability). */
  mobCostScale: 30,
  /** Max-hit-taken scale for the survivability secondary term. */
  maxHitScale: 15000,
  /** Seconds-of-pool-buffer scale for resource sustain. */
  poolSecondsScale: 4.0,
  /** Regen-ratio curve scale for resource sustain. */
  regenScale: 0.5,
  /** Divine-cost decay scale for currency efficiency. */
  currencyDivScale: 5.0,
  /** Fallback damage scale when no band is given (maximize mode). */
  damageDefaultScale: 3_000_000,
  /** Fallback EHP scale when no band is given. */
  ehpDefaultScale: 40_000,
} as const;

const EPSILON = 1e-9;

export function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

/**
 * Pure diminishing-returns curve on [0, inf) -> [0, 1): `1 - e^(-x/scale)`.
 * Monotonic increasing, concave — every unit of the metric is worth a little
 * less than the last, but more is always at least as good.
 */
export function diminishing(x: number, scale: number): number {
  if (x <= 0) return 0;
  return 1 - Math.exp(-x / scale);
}

/**
 * Satisficing normalization. Rises with diminishing returns toward `enough`,
 * reaching exactly 1.0 at `enough`, and stays saturated at 1.0 above it. When
 * `enough` is null, falls back to unbounded diminishing returns (maximize).
 */
export function satisfice(
  x: number,
  enough: number | null,
  scale: number,
): number {
  if (x <= 0) return 0;
  if (enough === null) return diminishing(x, scale);
  if (x >= enough) return 1;
  const cap = 1 - Math.exp(-enough / scale);
  if (cap <= EPSILON) return 1;
  return clamp01((1 - Math.exp(-x / scale)) / cap);
}

/** Resolve a band into an (enough, scale) pair with sensible defaults. */
function resolveBand(
  band: TargetBand | undefined,
  fallbackScale: number,
): { enough: number | null; scale: number } {
  const enough = band?.enough ?? null;
  const scale =
    band?.scale ??
    (enough !== null && enough > 0 ? enough / 2 : fallbackScale);
  return { enough, scale };
}

type AxisNormalizer = (m: EngineMetrics, band?: TargetBand) => number;

const NORMALIZERS: Record<PreferenceAxis, AxisNormalizer> = {
  Damage: (m, band) => {
    const { enough, scale } = resolveBand(
      band,
      DEFAULT_AXIS_SCALES.damageDefaultScale,
    );
    return satisfice(m.fullDPS, enough, scale);
  },

  Survivability: (m, band) => {
    const { enough, scale } = resolveBand(
      band,
      DEFAULT_AXIS_SCALES.ehpDefaultScale,
    );
    const ehpScore = satisfice(m.totalEHP, enough, scale);
    // One-shot protection is a secondary but real survivability signal.
    const hitScore = diminishing(
      m.maximumHitTaken,
      DEFAULT_AXIS_SCALES.maxHitScale,
    );
    return clamp01(0.75 * ehpScore + 0.25 * hitScore);
  },

  'Movement Speed': (m, band) => {
    const bonus = Math.max(0, m.effectiveMovementSpeedMod - 1);
    const { enough, scale } = resolveBand(band, DEFAULT_AXIS_SCALES.moveScale);
    return satisfice(bonus, enough, scale);
  },

  'Attack Speed': (m, band) => {
    const { enough, scale } = resolveBand(band, DEFAULT_AXIS_SCALES.attackScale);
    return satisfice(m.attackRate, enough, scale);
  },

  'Cast Speed': (m, band) => {
    const { enough, scale } = resolveBand(band, DEFAULT_AXIS_SCALES.castScale);
    return satisfice(m.castRate, enough, scale);
  },

  'Skill Mobility Efficiency': (m) => {
    // Composite: how often the movement-carrying skill fires, discounted by
    // how much resource each use costs (cheap + frequent = high mobility).
    const throughput = diminishing(
      m.mobilitySkillRate,
      DEFAULT_AXIS_SCALES.mobRateScale,
    );
    const affordability =
      1 / (1 + Math.max(0, m.mobilitySkillCostPerUse) / DEFAULT_AXIS_SCALES.mobCostScale);
    return clamp01(throughput * (0.5 + 0.5 * affordability));
  },

  'Resource Sustain': (m) => {
    const cost = Math.max(m.skillCostPerSecond, EPSILON);
    const regenRatio = m.manaRegenPerSecond / cost;
    const poolSeconds = m.unreservedMana / cost;
    // Full self-sustain (regen >= cost) satisfices; pool is the buffer.
    const regenScore = satisfice(regenRatio, 1.0, DEFAULT_AXIS_SCALES.regenScale);
    const poolScore = diminishing(
      poolSeconds,
      DEFAULT_AXIS_SCALES.poolSecondsScale,
    );
    return clamp01(0.65 * regenScore + 0.35 * poolScore);
  },

  'Currency Efficiency': (m) => {
    // A free change (0 div) scores 1.0; cost decays the score, so under a
    // budget-weighted preset expensive marginal upgrades are penalized.
    const cost = Math.max(0, m.changeCostDivines);
    return Math.exp(-cost / DEFAULT_AXIS_SCALES.currencyDivScale);
  },
};

/** Normalize one axis's metric(s) to [0, 1] under an optional target band. */
export function normalizeAxis(
  axis: PreferenceAxis,
  metrics: EngineMetrics,
  band?: TargetBand,
): number {
  return NORMALIZERS[axis](metrics, band);
}
