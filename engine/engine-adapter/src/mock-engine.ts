/**
 * S1 stand-in — replaced by the PoB2 LuaJIT sidecar per ADR-001; the conformance
 * suite below holds the boundary.
 *
 * The MockEngine is a DETERMINISTIC {@link EngineAdapter}: it derives plausible
 * PoE2-shaped metrics (DPS, EHP, resistances, speeds…) purely from the content
 * of the translated build input, so identical snapshots ALWAYS produce identical
 * Calculation Results. It performs no real calculation and makes no external
 * calls — it exists only to give downstream systems a stable, reproducible
 * engine to build against until the real LuaJIT sidecar slots in behind the same
 * {@link EngineAdapter} interface (ADR-001).
 */

import type { BuildSnapshot, BuildMutation, CalculationResult } from '@exilelab/core';
import { createCalculationResult, promoteMutation, sha256Hex } from '@exilelab/core';
import type { EngineAdapter } from './adapter.js';
import { makeResultKey } from './adapter.js';
import type { EngineBuildInput } from './engine-input.js';
import { translateSnapshot } from './engine-input.js';

/** Default engine version tag for the mock. Real adapters carry the pinned PoB2 build. */
export const MOCK_ENGINE_VERSION = 'mock-1';

/**
 * Default (deterministic) computation timestamp. The mock has no real clock, so
 * its Calculation Results carry a fixed `computedAt` — this is what makes two
 * runs over the same snapshot byte-identical artifacts. Real adapters inject a
 * real clock; consumers key off the identity triple, never off this field.
 */
export const MOCK_COMPUTED_AT = '2026-07-04T00:00:00.000Z';

export interface MockEngineOptions {
  /** Override the engine version tag (results are cached per version). */
  readonly engineVersion?: string;
  /** Injectable clock for `computedAt`; defaults to a fixed deterministic value. */
  readonly clock?: () => string;
}

/**
 * Deterministic unit float in [0, 1) seeded by a string. Uses core's sha256 so
 * the value is stable across platforms and Node versions: take the leading 52
 * bits of the digest and divide by 2^52.
 */
function seededUnit(seed: string): number {
  const hex = sha256Hex(seed).slice(0, 13); // 13 hex digits = 52 bits
  return parseInt(hex, 16) / 0x10000000000000;
}

/** Structural features the mock's formulas read off the engine input. */
interface Features {
  readonly nodeCount: number;
  readonly masteryCount: number;
  readonly gearCount: number;
  readonly modCount: number;
  readonly supportLinks: number;
  readonly mainSkillCount: number;
  readonly level: number;
  readonly bossConfig: number;
}

function extractFeatures(input: EngineBuildInput): Features {
  const lc = input.activeLoadout;
  let gearCount = 0;
  let modCount = 0;
  for (const item of lc.items) {
    if (item.itemRef !== null) gearCount += 1;
    modCount += item.modifiers.length;
  }
  let supportLinks = 0;
  let mainSkillCount = 0;
  for (const g of lc.skillGroups) {
    supportLinks += g.supports.length;
    if (g.isMain && g.skillGemRef !== null) mainSkillCount += 1;
  }
  const boss = input.config['enemy.isBoss'];
  return {
    nodeCount: lc.allocatedNodes.length,
    masteryCount: lc.masteryCount,
    gearCount,
    modCount,
    supportLinks,
    mainSkillCount,
    level: input.character.level,
    bossConfig: boss === true ? 1 : 0,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Derive the deterministic metric set from a translated engine input.
 *
 * The seed for all per-metric jitter is the translated input's source snapshot
 * identity plus the engine version, so:
 *   - identical build state ⇒ identical metrics (the determinism guarantee), and
 *   - a mutation that changes build state changes the promoted identity, hence
 *     the seed AND the structural features, hence the metrics.
 *
 * DOCUMENTED FORMULAS (all values finite; jitter is a ±10% deterministic band):
 *   dps            = (nodes·250 + supportLinks·1800 + mainSkills·4000 + mods·120)
 *                    · (1 + level/100) · (1 + 0.15·boss) · jitter
 *   energyShield/  \
 *   armour/evasion  } layered from gear + nodes + level, each with its own jitter
 *   life           = (500 + level·30 + nodes·12) · jitter
 *   ehp            = (1500 + level·45 + gear·650 + nodes·35) · jitter
 *   <ele>Resistance= clamp(20 + mods·4 + 30·jitter, -60, 90)
 *   chaosResistance= clamp(-30 + mods·2 + 40·jitter, -60, 80)
 *   <ele>ResistanceOverCap = max(0, res - 75)
 *   movementSpeed  = clamp(round(100 + nodes·0.4 + 30·jitter), 100, 250)  [% of base]
 *   attackSpeed    = 1 + supportLinks·0.05 + 0.6·jitter                   [attacks/sec]
 *   castSpeed      = 1 + nodes·0.01 + 0.6·jitter                          [casts/sec]
 *   manaRegen      = round(20 + level·2 + 40·jitter)
 */
export function computeMockMetrics(
  input: EngineBuildInput,
  engineVersion: string,
): Record<string, number> {
  const f = extractFeatures(input);
  const base = `${input.sourceSnapshotId}:${engineVersion}`;
  const j = (metric: string): number => 0.9 + 0.2 * seededUnit(`${base}:${metric}`);

  const dpsRaw =
    f.nodeCount * 250 + f.supportLinks * 1800 + f.mainSkillCount * 4000 + f.modCount * 120;
  const dps = Math.round(dpsRaw * (1 + f.level / 100) * (1 + 0.15 * f.bossConfig) * j('dps'));

  const life = Math.round((500 + f.level * 30 + f.nodeCount * 12) * j('life'));
  const energyShield = Math.round((f.gearCount * 220 + f.nodeCount * 8) * j('es'));
  const armour = Math.round((f.gearCount * 340 + f.level * 10) * j('armour'));
  const evasion = Math.round((f.gearCount * 300 + f.level * 8) * j('evasion'));
  const ehp = Math.round(
    (1500 + f.level * 45 + f.gearCount * 650 + f.nodeCount * 35) * j('ehp'),
  );

  const fireResistance = Math.round(clamp(20 + f.modCount * 4 + 30 * seededUnit(`${base}:fireRes`), -60, 90));
  const coldResistance = Math.round(clamp(20 + f.modCount * 4 + 30 * seededUnit(`${base}:coldRes`), -60, 90));
  const lightningResistance = Math.round(clamp(20 + f.modCount * 4 + 30 * seededUnit(`${base}:lightRes`), -60, 90));
  const chaosResistance = Math.round(clamp(-30 + f.modCount * 2 + 40 * seededUnit(`${base}:chaosRes`), -60, 80));

  const movementSpeed = Math.round(clamp(100 + f.nodeCount * 0.4 + 30 * seededUnit(`${base}:ms`), 100, 250));
  const attackSpeed = Math.round((1 + f.supportLinks * 0.05 + 0.6 * seededUnit(`${base}:atk`)) * 100) / 100;
  const castSpeed = Math.round((1 + f.nodeCount * 0.01 + 0.6 * seededUnit(`${base}:cast`)) * 100) / 100;
  const manaRegen = Math.round(20 + f.level * 2 + 40 * seededUnit(`${base}:mana`));

  return {
    dps,
    life,
    energyShield,
    armour,
    evasion,
    ehp,
    fireResistance,
    coldResistance,
    lightningResistance,
    chaosResistance,
    fireResistanceOverCap: Math.max(0, fireResistance - 75),
    coldResistanceOverCap: Math.max(0, coldResistance - 75),
    lightningResistanceOverCap: Math.max(0, lightningResistance - 75),
    movementSpeed,
    attackSpeed,
    castSpeed,
    manaRegen,
  };
}

/**
 * S1 stand-in — replaced by the PoB2 LuaJIT sidecar per ADR-001; the conformance
 * suite holds the boundary. A deterministic {@link EngineAdapter} that derives
 * metrics from snapshot content only.
 */
export class MockEngine implements EngineAdapter {
  readonly engineVersion: string;
  readonly #clock: () => string;

  constructor(options: MockEngineOptions = {}) {
    this.engineVersion = options.engineVersion ?? MOCK_ENGINE_VERSION;
    this.#clock = options.clock ?? (() => MOCK_COMPUTED_AT);
  }

  async calculate(snapshot: BuildSnapshot, mutation?: BuildMutation): Promise<CalculationResult> {
    // Translate the EFFECTIVE build: with a candidate mutation, promote it to a
    // new snapshot first (real semantics via core), then translate that. The
    // result's key still carries the base snapshot id + the mutation id (AD-7).
    const effective = mutation ? promoteMutation(snapshot, mutation) : snapshot;
    const input = translateSnapshot(effective);
    const metrics = computeMockMetrics(input, this.engineVersion);

    return createCalculationResult({
      key: makeResultKey(snapshot, mutation, this.engineVersion),
      metrics,
      computedAt: this.#clock(),
    });
  }
}
