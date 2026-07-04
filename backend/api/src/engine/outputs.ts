// Engine-output translation (backend-local, RFC-0001 AD-6/AD-7).
//
// The calculation engine lives in ONE place now: @exilelab/engine-adapter. Its
// EngineAdapter.calculate() returns a canonical Calculation Result whose `metrics`
// are a FLAT, engine-side numeric surface (dps, ehp, <ele>Resistance, …). The two
// backend consumers want richer, differently-shaped slices of that surface:
//
//   - the Preference Engine wants `EngineMetrics` (fullDPS, totalEHP, per-axis
//     rates) in the numeric RANGE its Goal-Preset bands and floors were tuned
//     against;
//   - the Character Doctor wants `EngineOutputs` (structured resistances, per-type
//     maximum-hit-taken, defensive pools, sustain) it can grade.
//
// This module is the SMALL translation from a Calculation Result to those two
// slices. It reads ONLY `result.metrics` — never a BuildSnapshot, never the engine
// input — so it can never bypass the adapter or re-introduce a second calculator.
// It is pure and deterministic: identical metrics in ⇒ identical slices out, which
// keeps "same snapshot → same numbers" true end to end.
//
// The scale constants below are documented v0 knobs. The MockEngine emits compact,
// content-derived magnitudes (dps ~10^4, ehp ~10^3-10^4); the Preference Engine's
// presets (normalize.ts / presets.ts) and the Doctor's thresholds were authored
// against PoB2-shaped magnitudes (fullDPS ~10^6, totalEHP ~10^4-10^5). These
// constants map the former into the latter monotonically, so ordering is preserved
// and the tuned bands stay meaningful. When the real PoB2 sidecar replaces the mock
// (in the engine-adapter package, per ADR-001) it emits PoB2-shaped numbers already;
// these knobs then collapse toward 1.0 (or move into the adapter's own mapping).

import { createCalculationResult } from "@exilelab/core";
import type { CalculationResult, CalculationResultKey } from "@exilelab/core";
import type { EngineMetrics } from "@exilelab/preference-engine";
import type { EngineOutputs } from "@exilelab/rulebook";

/** v0 range-mapping knobs (see file header). All pure, all documented. */
const SCALE = {
  /** dps → fullDPS: lands a ~18k mock dps near the ~10^6 preset Damage bands. */
  dps: 75,
  /**
   * ehp → totalEHP: lands a ~8.6k mock ehp in the ~40-70k Survivability band, so a
   * measured base clears the fast-mapping EHP floor but not the hardcore one, and a
   * defence-respecced candidate falls under the hardcore Pro-mode floor (presets.ts).
   */
  ehp: 4.77,
  /** Fraction of totalEHP taken as the representative single-hit ceiling. */
  maxHitOfEhp: 0.3,
  /** Chaos is the classic thin wall — the lowest max-hit layer. */
  chaosMaxHitOfEhp: 0.55 * 0.3,
  /** mock attackSpeed (~1.0-1.7) → attacks/sec in the attackScale (4.0) band. */
  attackRate: 3,
  /** mock castSpeed (~1.0-1.7) → casts/sec in the castScale (3.0) band. */
  castRate: 2,
  /** mock manaRegen (~200) → unreserved-mana pool. */
  manaPool: 2,
  /** mock manaRegen (~200) → mana/sec (kept below skillCostPerSecond so sustain is a real axis). */
  manaRegen: 0.35,
} as const;

/** Fixed v0 constants the flat metric surface does not carry (mirror the prior mock). */
const CONST = {
  mobilitySkillCostPerUse: 22,
  skillCostPerSecond: 120,
  mainSkillManaCost: 30,
  netLifeRegen: 250,
  resistCap: 75,
} as const;

/** Read a metric with a safe default (the mock always emits the full set). */
function m(metrics: Readonly<Record<string, number>>, key: string): number {
  const v = metrics[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * The Preference Engine input slice, mapped from a Calculation Result's metrics.
 * `changeCostDivines` is always 0 here (base measurement); the tune layer overlays
 * a candidate's priced cost before scoring (services.ts).
 */
export function toEngineMetrics(result: CalculationResult): EngineMetrics {
  const x = result.metrics;
  const fullDPS = Math.round(m(x, "dps") * SCALE.dps);
  const totalEHP = Math.max(1, Math.round(m(x, "ehp") * SCALE.ehp));
  const maximumHitTaken = Math.max(1, Math.round(totalEHP * SCALE.maxHitOfEhp));
  const manaRegen = m(x, "manaRegen");
  return {
    fullDPS,
    totalEHP,
    maximumHitTaken,
    effectiveMovementSpeedMod: m(x, "movementSpeed") / 100,
    attackRate: m(x, "attackSpeed") * SCALE.attackRate,
    castRate: m(x, "castSpeed") * SCALE.castRate,
    mobilitySkillRate: 1.4 * m(x, "attackSpeed"),
    mobilitySkillCostPerUse: CONST.mobilitySkillCostPerUse,
    unreservedMana: Math.round(manaRegen * SCALE.manaPool),
    manaRegenPerSecond: Math.round(manaRegen * SCALE.manaRegen),
    skillCostPerSecond: CONST.skillCostPerSecond,
    changeCostDivines: 0,
  };
}

/**
 * The Character Doctor input slice (structured EngineOutputs), mapped from a
 * Calculation Result's metrics. Doctor-specific structure the flat metric surface
 * lacks (per-type max-hit, capped resistances, ailment protection, sustain) is
 * derived here from those same metrics — never from a snapshot.
 */
export function toEngineOutputs(result: CalculationResult): EngineOutputs {
  const x = result.metrics;
  const pref = toEngineMetrics(result);
  const maxHit = pref.maximumHitTaken;
  const life = m(x, "life");
  return {
    fullDps: pref.fullDPS,
    totalEHP: pref.totalEHP,
    maximumHitTaken: {
      physical: maxHit,
      fire: maxHit,
      cold: maxHit,
      lightning: maxHit,
      chaos: Math.max(1, Math.round(pref.totalEHP * SCALE.chaosMaxHitOfEhp)),
    },
    resists: {
      fire: { total: m(x, "fireResistance"), max: CONST.resistCap },
      cold: { total: m(x, "coldResistance"), max: CONST.resistCap },
      lightning: { total: m(x, "lightningResistance"), max: CONST.resistCap },
      chaos: { total: m(x, "chaosResistance"), max: CONST.resistCap },
    },
    ailmentProtection: {
      stunAvoidance: 60,
      freezeAvoidance: 50,
      shockAvoidance: 50,
      igniteAvoidance: 50,
    },
    defenses: {
      life,
      energyShield: m(x, "energyShield"),
      armour: m(x, "armour"),
      evasion: m(x, "evasion"),
      blockChance: 0,
      spellSuppression: 0,
      energyShieldRechargeProtected: false,
    },
    sustain: {
      netLifeRegen: CONST.netLifeRegen,
      totalBuildDegen: 0,
      lifeLeechRatePerSecond: 0,
      energyShieldRechargeRate: 0,
    },
    skills: [{ name: "main-skill", manaCost: CONST.mainSkillManaCost, lifeCost: 0 }],
    unreservedMana: pref.unreservedMana,
    unreservedLife: life,
    warnings: [],
  };
}

/** The full backend measurement: both consumer slices, derived from one Result. */
export interface Measurement {
  /** Preference Engine input slice (Calculation Result numbers). */
  preference: EngineMetrics;
  /** Character Doctor input slice (same underlying Calculation Result). */
  doctor: EngineOutputs;
}

/** Derive both consumer slices from a single Calculation Result. */
export function toMeasurement(result: CalculationResult): Measurement {
  return { preference: toEngineMetrics(result), doctor: toEngineOutputs(result) };
}

/**
 * Re-wrap the adapter's Result as the artifact the API stores and returns: same
 * canonical key + timestamp, but its `metrics` are the mapped `EngineMetrics`
 * surface (fullDPS, totalEHP, …) the frontend and typed clients read. This does
 * NOT recalculate — it is a pure projection of the adapter's Result.
 */
export function toStoredResult(
  result: CalculationResult,
  measurement: Measurement,
  key: CalculationResultKey,
): CalculationResult {
  return createCalculationResult({
    key,
    metrics: { ...measurement.preference },
    computedAt: result.computedAt,
  });
}
