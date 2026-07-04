// Client-side re-scoring — the mechanism behind Presentation Law 1
// ("the sliders are the product"). The API returns, for every candidate, a
// per-axis decomposition (baseNormalized, candidateNormalized) computed under
// the active preset's satisficing bands. Moving a slider changes only the
// WEIGHTS, so we can recompute every candidate's Weighted Score delta locally
// and instantly — no round-trip — exactly as the Preference Engine would:
//
//   delta = Σ  w_norm[axis] · (candidateNormalized − baseNormalized) · 100
//
// This mirrors scoreCandidate() in @exilelab/preference-engine bit-for-bit for
// the weight dimension. New satisficing bands (a different preset) still require
// a re-fetch; a slider drag never does.

import type { AxisWeights, PreferenceAxis, Recommendation } from "./types";
import { PREFERENCE_AXES } from "./types";

export type WeightVector = Record<PreferenceAxis, number>;

export function zeroWeights(): WeightVector {
  const out = {} as WeightVector;
  for (const a of PREFERENCE_AXES) out[a] = 0;
  return out;
}

/** Normalize an arbitrary non-negative weight vector to sum to 1 (clamp <0). */
export function normalizeWeights(weights: AxisWeights): WeightVector {
  let sum = 0;
  for (const a of PREFERENCE_AXES) {
    const w = weights[a];
    if (w > 0) sum += w;
  }
  const out = {} as WeightVector;
  for (const a of PREFERENCE_AXES) {
    const w = weights[a];
    out[a] = sum > 0 && w > 0 ? w / sum : 0;
  }
  return out;
}

export interface ScoredRecommendation extends Recommendation {
  /** Re-computed delta under the live slider weights. */
  liveDelta: number;
  /** Absolute base Weighted Score under the live weights (0–100). */
  liveBaseScore: number;
  /** liveBaseScore + liveDelta. */
  liveCandidateScore: number;
  /** Per-axis weighted delta under the live weights, keyed by axis. */
  liveByAxis: Record<string, number>;
}

/** Re-score + re-rank one candidate against a live weight vector. */
function rescoreOne(
  rec: Recommendation,
  norm: WeightVector,
): ScoredRecommendation {
  let liveDelta = 0;
  let liveBaseScore = 0;
  const liveByAxis: Record<string, number> = {};
  for (const c of rec.perAxis) {
    const w = norm[c.axis as PreferenceAxis] ?? 0;
    const contribution = w * (c.candidateNormalized - c.baseNormalized) * 100;
    liveByAxis[c.axis] = contribution;
    liveDelta += contribution;
    liveBaseScore += w * c.baseNormalized * 100;
  }
  return {
    ...rec,
    liveDelta,
    liveBaseScore,
    liveCandidateScore: liveBaseScore + liveDelta,
    liveByAxis,
  };
}

/**
 * Re-score every recommendation under the live weights and rank by delta desc
 * (stable tiebreak by mutationId — identical to the server's ordering rule).
 */
export function rescoreAndRank(
  recs: Recommendation[],
  weights: AxisWeights,
): ScoredRecommendation[] {
  const norm = normalizeWeights(weights);
  return recs
    .map((r) => rescoreOne(r, norm))
    .sort(
      (a, b) =>
        b.liveDelta - a.liveDelta || a.mutationId.localeCompare(b.mutationId),
    );
}

/** The live absolute base score (build as-is) under the current weights. */
export function liveBaseScore(
  recs: Recommendation[],
  weights: AxisWeights,
): number {
  const first = recs[0];
  if (!first) return 0;
  return rescoreOne(first, normalizeWeights(weights)).liveBaseScore;
}

/**
 * "What the build delivers" per axis, in [0,1] — the radar's delivers-polygon.
 * Taken from any candidate's baseNormalized (identical across candidates for a
 * given preset, since it describes the base build).
 */
export function deliversByAxis(
  recs: Recommendation[],
): Record<PreferenceAxis, number> {
  const out = {} as Record<PreferenceAxis, number>;
  for (const a of PREFERENCE_AXES) out[a] = 0;
  const first = recs[0];
  if (!first) return out;
  for (const c of first.perAxis) {
    out[c.axis as PreferenceAxis] = c.baseNormalized;
  }
  return out;
}
