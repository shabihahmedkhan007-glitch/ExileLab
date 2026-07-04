// MockEngine — a DETERMINISTIC v0 stand-in for the PoB2 Engine Sidecar.
//
// SEAM: RFC-0001 names an "Engine boundary adapter" (@exilelab/engine-adapter)
// that translates a BuildSnapshot into what the unmodified PoB2 engine consumes
// and returns real metrics. That package is still a stub, so this module provides
// a deterministic heuristic engine behind the same `EngineAdapter` interface.
// When @exilelab/engine-adapter lands, swap the implementation here — nothing
// else in the API changes. This mock is NOT PoB2 and never calls one; it derives
// plausible, monotonic metrics purely from canonical build state so that
// mutations produce meaningful, reproducible metric deltas for scoring.
//
// PRINCIPLES: deterministic (no LLM, no network); the engine is the sole
// calculator (metrics never live in a snapshot — they become Calculation Results
// keyed by snapshot × engine version, AD-7).

import { createCalculationResult } from "@exilelab/core";
import type {
  BuildSnapshot as CoreSnapshot,
  BuildState,
  CalculationResult,
} from "@exilelab/core";
import type { EngineMetrics } from "@exilelab/preference-engine";
import type { EngineOutputs } from "@exilelab/rulebook";

/** Engine identity recorded on every Calculation Result key (I5/AD-7). */
export const ENGINE_VERSION = "mock-0.1.0";

/** The full measurement the mock produces for one snapshot. */
export interface Measurement {
  /** Preference Engine input slice (Calculation Result numbers). */
  preference: EngineMetrics;
  /** Character Doctor input slice (same underlying calculation). */
  doctor: EngineOutputs;
  /** Flat numeric surface stored in the Calculation Result artifact. */
  metrics: Readonly<Record<string, number>>;
}

/** The engine boundary contract (the seam @exilelab/engine-adapter will fill). */
export interface EngineAdapter {
  readonly version: string;
  measure(snapshot: CoreSnapshot): Measurement;
}

interface Features {
  level: number;
  /** Node counts bucketed by (nodeId mod 8) — each bucket feeds one metric family. */
  buckets: number[];
  offensiveMods: number;
  defensiveMods: number;
  movementMods: number;
  lifePenaltyMods: number;
  mainSkillName: string;
  mainSkillCost: number;
}

const DEFENSIVE_KEYWORDS = [
  "life",
  "energy shield",
  "armour",
  "evasion",
  "resist",
  "block",
  "suppress",
];

function classifyModifier(
  raw: string,
  f: Pick<Features, "offensiveMods" | "defensiveMods" | "movementMods" | "lifePenaltyMods">,
): void {
  const mod = raw.toLowerCase();
  const reducedLife = mod.includes("reduced") && mod.includes("life");
  if (reducedLife) {
    f.lifePenaltyMods += 1;
    return;
  }
  if (mod.includes("movement speed")) {
    f.movementMods += 1;
    return;
  }
  if (DEFENSIVE_KEYWORDS.some((k) => mod.includes(k))) {
    f.defensiveMods += 1;
    return;
  }
  f.offensiveMods += 1;
}

function extract(state: BuildState): Features {
  const primary =
    state.loadoutContexts.find((l) => l.primary) ?? state.loadoutContexts[0];
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const node of primary?.passiveTree.allocatedNodes ?? []) {
    const b = ((node % 8) + 8) % 8;
    buckets[b] = (buckets[b] ?? 0) + 1;
  }
  const mods = { offensiveMods: 0, defensiveMods: 0, movementMods: 0, lifePenaltyMods: 0 };
  for (const item of primary?.equipment ?? []) {
    for (const line of item.modifiers) classifyModifier(line, mods);
  }
  const mainSetup = primary?.skills.find((s) => s.isMainSkill) ?? primary?.skills[0];
  const skillRef = mainSetup?.skillGemRef ?? mainSetup?.setupId ?? "unknown-skill";

  return {
    level: state.character.level,
    buckets,
    ...mods,
    mainSkillName: skillRef,
    mainSkillCost: 30,
  };
}

function b(features: Features, i: number): number {
  return features.buckets[i] ?? 0;
}

/**
 * The deterministic metric model. Every coefficient is a documented v0 knob;
 * the shape is monotonic so "more of a good stat" never lowers its axis.
 */
function computePreference(f: Features): EngineMetrics {
  const fullDPS = 850_000 + b(f, 0) * 55_000 + f.offensiveMods * 45_000 + f.level * 2_500;
  const totalEHP = Math.max(
    1,
    44_000 + b(f, 1) * 2_200 + f.defensiveMods * 3_500 + f.level * 90 - f.lifePenaltyMods * 34_000,
  );
  const maximumHitTaken = Math.max(1, Math.round(totalEHP * 0.3));
  return {
    fullDPS,
    totalEHP,
    maximumHitTaken,
    effectiveMovementSpeedMod: 1.08 + b(f, 2) * 0.05 + f.movementMods * 0.07,
    attackRate: 3.4 + b(f, 3) * 0.3,
    castRate: 2.2 + b(f, 4) * 0.3,
    mobilitySkillRate: 1.6 + b(f, 5) * 0.18,
    mobilitySkillCostPerUse: 22,
    unreservedMana: 380 + b(f, 6) * 70,
    manaRegenPerSecond: 60 + b(f, 6) * 22,
    skillCostPerSecond: 120,
    // Change-scoped: 0 for a measured build; the tune layer overlays a mutation's
    // priced cost before scoring a candidate.
    changeCostDivines: 0,
  };
}

function computeDoctor(f: Features, p: EngineMetrics): EngineOutputs {
  const maxHit = p.maximumHitTaken;
  const life = Math.round(p.totalEHP * 0.45);
  return {
    fullDps: p.fullDPS,
    totalEHP: p.totalEHP,
    maximumHitTaken: {
      physical: maxHit,
      fire: maxHit,
      cold: maxHit,
      lightning: maxHit,
      // Chaos is the classic thin wall — deliberately the lowest layer.
      chaos: Math.max(1, Math.round(maxHit * 0.55)),
    },
    resists: {
      fire: { total: 75, max: 75 },
      cold: { total: 75, max: 75 },
      lightning: { total: 75, max: 75 },
      // 10% chaos res clears speed goals (floor -30) but fails hardcore (floor 25).
      chaos: { total: 10, max: 75 },
    },
    ailmentProtection: {
      stunAvoidance: 60,
      freezeAvoidance: 50,
      shockAvoidance: 50,
      igniteAvoidance: 50,
    },
    defenses: {
      life,
      energyShield: 0,
      armour: 2_000,
      evasion: 6_000,
      blockChance: 0,
      spellSuppression: 0,
      energyShieldRechargeProtected: false,
    },
    sustain: {
      netLifeRegen: 250,
      totalBuildDegen: 0,
      lifeLeechRatePerSecond: 0,
      energyShieldRechargeRate: 0,
    },
    skills: [{ name: f.mainSkillName, manaCost: f.mainSkillCost, lifeCost: 0 }],
    unreservedMana: p.unreservedMana,
    unreservedLife: life,
    warnings: [],
  };
}

/** The deterministic mock engine. Pure: same snapshot → same measurement. */
export class MockEngine implements EngineAdapter {
  readonly version = ENGINE_VERSION;

  measure(snapshot: CoreSnapshot): Measurement {
    const features = extract(snapshot.buildState);
    const preference = computePreference(features);
    const doctor = computeDoctor(features, preference);
    const metrics: Record<string, number> = {
      fullDPS: preference.fullDPS,
      totalEHP: preference.totalEHP,
      maximumHitTaken: preference.maximumHitTaken,
      effectiveMovementSpeedMod: preference.effectiveMovementSpeedMod,
      attackRate: preference.attackRate,
      castRate: preference.castRate,
      mobilitySkillRate: preference.mobilitySkillRate,
      mobilitySkillCostPerUse: preference.mobilitySkillCostPerUse,
      unreservedMana: preference.unreservedMana,
      manaRegenPerSecond: preference.manaRegenPerSecond,
      skillCostPerSecond: preference.skillCostPerSecond,
    };
    return { preference, doctor, metrics };
  }
}

/** Wrap a measurement into a validated, frozen Calculation Result artifact. */
export function toCalculationResult(
  snapshotId: string,
  measurement: Measurement,
  engineVersion: string,
  mutationId?: string,
): CalculationResult {
  return createCalculationResult({
    key: {
      snapshotId,
      ...(mutationId !== undefined ? { mutationId } : {}),
      engineVersion,
    },
    metrics: measurement.metrics,
    computedAt: new Date().toISOString(),
  });
}
