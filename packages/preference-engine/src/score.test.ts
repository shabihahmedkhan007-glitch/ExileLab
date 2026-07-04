import { describe, it, expect } from 'vitest';
import {
  scoreCandidate,
  scoreBuild,
  normalizeWeights,
} from './score.js';
import { getPreset, PRESET_LIST } from './presets.js';
import { PREFERENCE_AXES } from './axes.js';
import { satisfice, diminishing } from './normalize.js';
import type { EngineMetrics } from './metrics.js';
import type { GoalPreset } from './presets.js';

// A middling fast-mapper baseline. Damage already sits above the fast-mapping
// band but well below the boss-farming band.
const BASE: EngineMetrics = {
  fullDPS: 600_000,
  totalEHP: 30_000,
  maximumHitTaken: 8_000,
  effectiveMovementSpeedMod: 1.2,
  attackRate: 4.0,
  castRate: 1.0,
  mobilitySkillRate: 3.0,
  mobilitySkillCostPerUse: 15,
  unreservedMana: 200,
  manaRegenPerSecond: 80,
  skillCostPerSecond: 60,
  changeCostDivines: 0,
};

/** A boot swap: pure movement-speed gain, nothing else. */
const bootSwap = (cost = 0): EngineMetrics => ({
  ...BASE,
  effectiveMovementSpeedMod: 1.5,
  changeCostDivines: cost,
});

/** A ring swap: pure DPS gain, nothing else. */
const ringSwap = (cost = 0): EngineMetrics => ({
  ...BASE,
  fullDPS: 900_000,
  changeCostDivines: cost,
});

function preset(id: string): GoalPreset {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
}

describe('golden ordering 1: movement boot vs pure-DPS ring flips by goal', () => {
  it('Fast Mapping ranks the movement boot swap above the DPS ring swap', () => {
    const p = preset('fast-mapping');
    const boot = scoreCandidate(BASE, bootSwap(), p.weights, p.constraints);
    const ring = scoreCandidate(BASE, ringSwap(), p.weights, p.constraints);
    expect(boot.weightedScoreDelta).toBeGreaterThan(ring.weightedScoreDelta);
  });

  it('Boss Farming flips the ordering: the DPS ring swap wins', () => {
    const p = preset('boss-farming');
    const boot = scoreCandidate(BASE, bootSwap(), p.weights, p.constraints);
    const ring = scoreCandidate(BASE, ringSwap(), p.weights, p.constraints);
    expect(ring.weightedScoreDelta).toBeGreaterThan(boot.weightedScoreDelta);
  });

  it('the ordering genuinely flips between the two goals', () => {
    const fm = preset('fast-mapping');
    const bf = preset('boss-farming');
    const bootFm = scoreCandidate(BASE, bootSwap(), fm.weights, fm.constraints);
    const ringFm = scoreCandidate(BASE, ringSwap(), fm.weights, fm.constraints);
    const bootBf = scoreCandidate(BASE, bootSwap(), bf.weights, bf.constraints);
    const ringBf = scoreCandidate(BASE, ringSwap(), bf.weights, bf.constraints);
    const fastMapperFavorsBoot =
      bootFm.weightedScoreDelta > ringFm.weightedScoreDelta;
    const bossFarmerFavorsRing =
      ringBf.weightedScoreDelta > bootBf.weightedScoreDelta;
    expect(fastMapperFavorsBoot && bossFarmerFavorsRing).toBe(true);
  });
});

describe('golden ordering 2: satisficing — no reward for overkill damage', () => {
  it('Boss Farming: +20% DPS inside the damage band adds ~zero score', () => {
    const p = preset('boss-farming');
    // Base already exceeds the boss-farming damage band (2.5M).
    const inBand: EngineMetrics = { ...BASE, fullDPS: 3_000_000 };
    const overkill: EngineMetrics = { ...inBand, fullDPS: 3_600_000 };
    const res = scoreCandidate(inBand, overkill, p.weights, p.constraints);
    expect(Math.abs(res.weightedScoreDelta)).toBeLessThan(0.01);
    // The Damage axis specifically contributes nothing.
    const dmg = res.perAxisDecomposition.find((d) => d.axis === 'Damage');
    expect(dmg?.weightedDelta).toBe(0);
  });

  it('below the band, the same +20% DPS is clearly rewarded', () => {
    const p = preset('boss-farming');
    const below: EngineMetrics = { ...BASE, fullDPS: 600_000 };
    const more: EngineMetrics = { ...below, fullDPS: 720_000 };
    const res = scoreCandidate(below, more, p.weights, p.constraints);
    expect(res.weightedScoreDelta).toBeGreaterThan(0.5);
  });

  it('Maximum DPS (enough=null) keeps rewarding overkill', () => {
    const p = preset('maximum-dps');
    const inBand: EngineMetrics = { ...BASE, fullDPS: 3_000_000 };
    const overkill: EngineMetrics = { ...inBand, fullDPS: 3_600_000 };
    const res = scoreCandidate(inBand, overkill, p.weights, p.constraints);
    expect(res.weightedScoreDelta).toBeGreaterThan(0.5);
  });
});

describe('golden ordering 3: floor constraints exclude candidates', () => {
  it('a candidate that drops EHP below the Hardcore floor is belowFloor', () => {
    const p = preset('hardcore-survivability');
    const base: EngineMetrics = { ...BASE, totalEHP: 50_000, maximumHitTaken: 14_000 };
    // Huge DPS gain but EHP collapses below the 40k floor.
    const risky: EngineMetrics = {
      ...base,
      totalEHP: 35_000,
      fullDPS: 5_000_000,
    };
    const res = scoreCandidate(base, risky, p.weights, p.constraints);
    expect(res.belowFloor).toBe(true);
    expect(res.violatedFloors.some((v) => v.metric === 'totalEHP')).toBe(true);
  });

  it('a candidate that stays above every floor is not belowFloor', () => {
    const p = preset('hardcore-survivability');
    const base: EngineMetrics = { ...BASE, totalEHP: 50_000, maximumHitTaken: 14_000 };
    const safe: EngineMetrics = { ...base, totalEHP: 55_000 };
    const res = scoreCandidate(base, safe, p.weights, p.constraints);
    expect(res.belowFloor).toBe(false);
    expect(res.violatedFloors).toHaveLength(0);
  });

  it('excluding belowFloor candidates removes the top raw-score option', () => {
    const p = preset('hardcore-survivability');
    const base: EngineMetrics = { ...BASE, totalEHP: 50_000, maximumHitTaken: 14_000 };
    const risky: EngineMetrics = { ...base, totalEHP: 35_000, fullDPS: 5_000_000 };
    const safe: EngineMetrics = { ...base, totalEHP: 60_000 };
    const candidates = [risky, safe].map((c) =>
      scoreCandidate(base, c, p.weights, p.constraints),
    );
    const ranked = candidates
      .filter((c) => !c.belowFloor)
      .sort((a, b) => b.weightedScoreDelta - a.weightedScoreDelta);
    // Only the safe candidate survives the floor gate.
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.candidateScore).toBeGreaterThan(0);
  });
});

describe('golden ordering 4: determinism and decomposition integrity', () => {
  it('identical inputs produce identical output', () => {
    const p = preset('balanced');
    const a = scoreCandidate(BASE, ringSwap(2), p.weights, p.constraints);
    const b = scoreCandidate(BASE, ringSwap(2), p.weights, p.constraints);
    expect(a).toEqual(b);
  });

  it('the per-axis decomposition sums exactly to the total delta', () => {
    for (const p of PRESET_LIST) {
      const res = scoreCandidate(BASE, ringSwap(3), p.weights, p.constraints);
      const summed = res.perAxisDecomposition.reduce(
        (acc, d) => acc + d.weightedDelta,
        0,
      );
      expect(summed).toBe(res.weightedScoreDelta);
    }
  });

  it('scoreBuild per-axis contributions sum to the Weighted Score', () => {
    const p = preset('balanced');
    const res = scoreBuild(BASE, p.weights, p.constraints);
    const summed = res.perAxis.reduce((acc, a) => acc + a.weightedScore, 0);
    expect(summed).toBe(res.weightedScore);
    expect(res.weightedScore).toBeGreaterThanOrEqual(0);
    expect(res.weightedScore).toBeLessThanOrEqual(100);
  });
});

describe('normalization curves', () => {
  it('satisfice saturates at 1.0 at and beyond `enough`', () => {
    expect(satisfice(1_000_000, 1_000_000, 500_000)).toBe(1);
    expect(satisfice(5_000_000, 1_000_000, 500_000)).toBe(1);
    expect(satisfice(0, 1_000_000, 500_000)).toBe(0);
  });

  it('satisfice is monotonic and concave below `enough` (diminishing returns)', () => {
    const enough = 1_000_000;
    const scale = enough / 2;
    const s = (x: number) => satisfice(x, enough, scale);
    // strictly increasing
    expect(s(200_000)).toBeGreaterThan(s(100_000));
    expect(s(900_000)).toBeGreaterThan(s(800_000));
    // concave: earlier increments buy more than later ones
    const firstStep = s(200_000) - s(100_000);
    const laterStep = s(900_000) - s(800_000);
    expect(firstStep).toBeGreaterThan(laterStep);
  });

  it('diminishing returns is bounded in [0, 1) and monotonic', () => {
    expect(diminishing(0, 4)).toBe(0);
    expect(diminishing(4, 4)).toBeGreaterThan(0);
    expect(diminishing(4, 4)).toBeLessThan(1);
    // asymptotic to 1: never exceeds it even at extreme inputs
    expect(diminishing(1000, 4)).toBeLessThanOrEqual(1);
    expect(diminishing(8, 4)).toBeGreaterThan(diminishing(4, 4));
  });

  it('currency efficiency: free is best, cost decays the axis score', () => {
    const p = preset('budget-farming');
    const free = scoreBuild({ ...BASE, changeCostDivines: 0 }, p.weights, p.constraints);
    const pricey = scoreBuild({ ...BASE, changeCostDivines: 10 }, p.weights, p.constraints);
    const freeCE = free.perAxis.find((a) => a.axis === 'Currency Efficiency');
    const priceyCE = pricey.perAxis.find((a) => a.axis === 'Currency Efficiency');
    expect(freeCE?.normalized).toBe(1);
    expect(priceyCE?.normalized).toBeLessThan(1);
  });
});

describe('preset and weight invariants', () => {
  it('every preset defines a weight for all eight axes', () => {
    for (const p of PRESET_LIST) {
      for (const axis of PREFERENCE_AXES) {
        expect(typeof p.weights[axis]).toBe('number');
        expect(p.weights[axis]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('normalizeWeights yields a sum-constrained allocation (sums to 1)', () => {
    for (const p of PRESET_LIST) {
      const w = normalizeWeights(p.weights);
      const sum = PREFERENCE_AXES.reduce((acc, axis) => acc + w[axis], 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('an all-zero weight vector degenerates to a zero score without throwing', () => {
    const zero = Object.fromEntries(
      PREFERENCE_AXES.map((a) => [a, 0]),
    ) as Record<(typeof PREFERENCE_AXES)[number], number>;
    const res = scoreBuild(BASE, zero);
    expect(res.weightedScore).toBe(0);
  });
});
