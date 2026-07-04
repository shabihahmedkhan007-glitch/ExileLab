// The scoring heart of the Preference Engine.
//
// Weighted Score = Sum_i w_i * normalize_i(metric_i), a single 0-100 number
// under a set of axis weights and satisficing constraints (docs/GLOSSARY.md
// "Weighted Score"). scoreCandidate produces the weighted-score DELTA with a
// per-axis decomposition — every ranking surface consumes deltas with a
// decomposition, because explainability is a product principle.
//
// All functions are pure and deterministic: identical inputs -> identical
// output, and a decomposition always sums exactly to its reported total.

import { PREFERENCE_AXES } from './axes.js';
import type { AxisWeights, PreferenceAxis } from './axes.js';
import { normalizeAxis } from './normalize.js';
import type {
  EngineMetrics,
  FloorViolation,
  ScoreConstraints,
} from './metrics.js';

/** Per-axis contribution to an absolute Weighted Score. */
export interface AxisScore {
  axis: PreferenceAxis;
  /** Normalized axis value in [0, 1]. */
  normalized: number;
  /** Sum-normalized weight applied to this axis, in [0, 1]. */
  weight: number;
  /** Contribution to the 0-100 Weighted Score: weight * normalized * 100. */
  weightedScore: number;
}

/** An absolute Weighted Score for one build's metrics. */
export interface WeightedScoreResult {
  /** The build's Weighted Score, 0-100. */
  weightedScore: number;
  /** Per-axis decomposition; contributions sum to `weightedScore`. */
  perAxis: AxisScore[];
  /** True if the metrics violate any floor constraint. */
  belowFloor: boolean;
  /** The specific floors violated (empty when `belowFloor` is false). */
  violatedFloors: FloorViolation[];
}

/** Per-axis contribution to a Weighted Score delta (candidate vs base). */
export interface AxisDelta {
  axis: PreferenceAxis;
  baseNormalized: number;
  candidateNormalized: number;
  weight: number;
  /** Contribution to the delta: weight * (candNorm - baseNorm) * 100. */
  weightedDelta: number;
}

/** The result of scoring a candidate change against a base build. */
export interface CandidateScore {
  /** Sum of the per-axis weighted deltas (the ranking key). */
  weightedScoreDelta: number;
  /** Per-axis decomposition; deltas sum exactly to `weightedScoreDelta`. */
  perAxisDecomposition: AxisDelta[];
  /**
   * True if the candidate violates a floor constraint. Ranking surfaces MUST
   * exclude these candidates rather than merely ranking them low.
   */
  belowFloor: boolean;
  /** Floors the candidate violated (empty when `belowFloor` is false). */
  violatedFloors: FloorViolation[];
  /** Absolute Weighted Score of the base metrics, 0-100. */
  baseScore: number;
  /** Absolute Weighted Score of the candidate metrics, 0-100. */
  candidateScore: number;
}

/**
 * Normalize an arbitrary weight vector into a sum-constrained allocation
 * (sums to 1). Negative weights are clamped to 0. An all-zero vector yields
 * an all-zero allocation (a degenerate but well-defined score of 0).
 */
export function normalizeWeights(weights: AxisWeights): AxisWeights {
  let sum = 0;
  for (const axis of PREFERENCE_AXES) {
    const w = weights[axis];
    if (w > 0) sum += w;
  }
  const out = {} as AxisWeights;
  for (const axis of PREFERENCE_AXES) {
    const w = weights[axis];
    out[axis] = sum > 0 && w > 0 ? w / sum : 0;
  }
  return out;
}

/** Evaluate floor constraints against a set of metrics. */
export function evaluateFloors(
  metrics: EngineMetrics,
  constraints?: ScoreConstraints,
): FloorViolation[] {
  const floors = constraints?.floors;
  if (!floors || floors.length === 0) return [];
  const violations: FloorViolation[] = [];
  for (const floor of floors) {
    const actual = metrics[floor.metric];
    if (actual < floor.min) {
      violations.push({ metric: floor.metric, min: floor.min, actual });
    }
  }
  return violations;
}

/** Compute the absolute Weighted Score (0-100) of one build's metrics. */
export function scoreBuild(
  metrics: EngineMetrics,
  weights: AxisWeights,
  constraints?: ScoreConstraints,
): WeightedScoreResult {
  const w = normalizeWeights(weights);
  const targets = constraints?.targets;
  const perAxis: AxisScore[] = [];
  let total = 0;
  for (const axis of PREFERENCE_AXES) {
    const normalized = normalizeAxis(axis, metrics, targets?.[axis]);
    const weight = w[axis];
    const weightedScore = weight * normalized * 100;
    total += weightedScore;
    perAxis.push({ axis, normalized, weight, weightedScore });
  }
  const violatedFloors = evaluateFloors(metrics, constraints);
  return {
    weightedScore: total,
    perAxis,
    belowFloor: violatedFloors.length > 0,
    violatedFloors,
  };
}

/**
 * Score a candidate change against a base build under a set of axis weights
 * and satisficing constraints. Returns the Weighted Score delta with a full
 * per-axis decomposition and a `belowFloor` flag for hard-constraint exclusion.
 *
 * The reported `weightedScoreDelta` is the exact sum of the per-axis deltas,
 * so any consumer can audit the number by adding up the decomposition.
 */
export function scoreCandidate(
  baseMetrics: EngineMetrics,
  candidateMetrics: EngineMetrics,
  weights: AxisWeights,
  constraints?: ScoreConstraints,
): CandidateScore {
  const w = normalizeWeights(weights);
  const targets = constraints?.targets;

  const perAxisDecomposition: AxisDelta[] = [];
  let baseScore = 0;
  let candidateScore = 0;
  let weightedScoreDelta = 0;

  for (const axis of PREFERENCE_AXES) {
    const band = targets?.[axis];
    const baseNormalized = normalizeAxis(axis, baseMetrics, band);
    const candidateNormalized = normalizeAxis(axis, candidateMetrics, band);
    const weight = w[axis];

    baseScore += weight * baseNormalized * 100;
    candidateScore += weight * candidateNormalized * 100;

    const weightedDelta =
      weight * (candidateNormalized - baseNormalized) * 100;
    weightedScoreDelta += weightedDelta;

    perAxisDecomposition.push({
      axis,
      baseNormalized,
      candidateNormalized,
      weight,
      weightedDelta,
    });
  }

  const violatedFloors = evaluateFloors(candidateMetrics, constraints);

  return {
    weightedScoreDelta,
    perAxisDecomposition,
    belowFloor: violatedFloors.length > 0,
    violatedFloors,
    baseScore,
    candidateScore,
  };
}
