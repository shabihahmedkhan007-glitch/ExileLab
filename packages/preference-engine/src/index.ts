// @exilelab/preference-engine — the deterministic scoring heart of ExileLab.
//
// Turns engine-computed metrics (from a Calculation Result) plus the player's
// axis weights and satisficing constraints into a single Weighted Score, and
// scores candidate changes as weighted-score deltas with a per-axis
// decomposition. Pure, deterministic, satisficing-first. Never calls the LLM;
// never talks to external platforms.

export { PREFERENCE_AXES } from './axes.js';
export type { PreferenceAxis, AxisWeights } from './axes.js';

export type {
  EngineMetrics,
  TargetBand,
  FloorConstraint,
  FloorViolation,
  ScoreConstraints,
} from './metrics.js';

export {
  DEFAULT_AXIS_SCALES,
  normalizeAxis,
  satisfice,
  diminishing,
  clamp01,
} from './normalize.js';

export {
  PRESETS,
  PRESET_LIST,
  DEFAULT_PRESET_ID,
  getPreset,
} from './presets.js';
export type { GoalPreset } from './presets.js';

export {
  scoreBuild,
  scoreCandidate,
  normalizeWeights,
  evaluateFloors,
} from './score.js';
export type {
  AxisScore,
  WeightedScoreResult,
  AxisDelta,
  CandidateScore,
} from './score.js';
