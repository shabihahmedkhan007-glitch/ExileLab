// Goal Presets — named, pre-tuned bundles of axis weights, satisficing target
// bands, and Pro-mode floor constraints (docs/GLOSSARY.md "Goal Preset").
// Selecting a preset sets the sliders; users may then adjust.

import type { AxisWeights } from './axes.js';
import type { ScoreConstraints } from './metrics.js';

/** A named, pre-tuned Goal Preset. */
export interface GoalPreset {
  id: string;
  name: string;
  description: string;
  /** Sum-constrained weight allocation across the eight axes. */
  weights: AxisWeights;
  /** Satisficing bands + floors that condition normalization and ranking. */
  constraints: ScoreConstraints;
}

// --- Fast Mapping -----------------------------------------------------------
// Movement is king; damage only needs to be "enough" to clear packs fast.
const FAST_MAPPING: GoalPreset = {
  id: 'fast-mapping',
  name: 'Fast Mapping',
  description:
    'Clear maps quickly. Movement and attack/mobility speed dominate; damage ' +
    'only needs to be enough to delete packs, not bosses.',
  weights: {
    Damage: 0.18,
    Survivability: 0.1,
    'Movement Speed': 0.28,
    'Attack Speed': 0.12,
    'Cast Speed': 0.06,
    'Skill Mobility Efficiency': 0.14,
    'Resource Sustain': 0.06,
    'Currency Efficiency': 0.06,
  },
  constraints: {
    targets: {
      Damage: { enough: 400_000 },
      Survivability: { enough: 25_000 },
    },
  },
};

// --- Boss Farming -----------------------------------------------------------
// Single-target damage and enough bulk to eat boss hits. Movement barely matters.
const BOSS_FARMING: GoalPreset = {
  id: 'boss-farming',
  name: 'Boss Farming',
  description:
    'Kill bosses. Damage and survivability dominate; movement speed is nearly ' +
    'irrelevant. Damage still satisfices at a high band — no reward for overkill.',
  weights: {
    Damage: 0.42,
    Survivability: 0.24,
    'Movement Speed': 0.03,
    'Attack Speed': 0.06,
    'Cast Speed': 0.05,
    'Skill Mobility Efficiency': 0.03,
    'Resource Sustain': 0.12,
    'Currency Efficiency': 0.05,
  },
  constraints: {
    targets: {
      Damage: { enough: 2_500_000 },
      Survivability: { enough: 45_000 },
    },
  },
};

// --- Hardcore Survivability -------------------------------------------------
// Survivability above all, with a hard EHP floor: candidates that drop below
// are excluded from ranking, not merely penalized.
const HARDCORE_SURVIVABILITY: GoalPreset = {
  id: 'hardcore-survivability',
  name: 'Hardcore Survivability',
  description:
    'Do not die. Survivability dominates and a hard EHP floor excludes any ' +
    'candidate that would drop below it, regardless of its other gains.',
  weights: {
    Damage: 0.15,
    Survivability: 0.45,
    'Movement Speed': 0.05,
    'Attack Speed': 0.04,
    'Cast Speed': 0.04,
    'Skill Mobility Efficiency': 0.05,
    'Resource Sustain': 0.15,
    'Currency Efficiency': 0.07,
  },
  constraints: {
    targets: {
      Damage: { enough: 800_000 },
      Survivability: { enough: 70_000 },
    },
    floors: [
      { metric: 'totalEHP', min: 40_000 },
      { metric: 'maximumHitTaken', min: 12_000 },
    ],
  },
};

// --- Budget Farming ---------------------------------------------------------
// Currency efficiency is a first-class priority: avoid over-optimization.
const BUDGET_FARMING: GoalPreset = {
  id: 'budget-farming',
  name: 'Budget Farming',
  description:
    'Get the most objective per Divine. Currency efficiency is weighted high, ' +
    'so expensive marginal upgrades are penalized (avoid over-optimization).',
  weights: {
    Damage: 0.2,
    Survivability: 0.18,
    'Movement Speed': 0.15,
    'Attack Speed': 0.08,
    'Cast Speed': 0.05,
    'Skill Mobility Efficiency': 0.08,
    'Resource Sustain': 0.06,
    'Currency Efficiency': 0.2,
  },
  constraints: {
    targets: {
      Damage: { enough: 300_000 },
      Survivability: { enough: 20_000 },
    },
  },
};

// --- Balanced ---------------------------------------------------------------
const BALANCED: GoalPreset = {
  id: 'balanced',
  name: 'Balanced',
  description:
    'A well-rounded default: damage and survivability lead, with meaningful ' +
    'weight on speed, sustain, and cost.',
  weights: {
    Damage: 0.2,
    Survivability: 0.2,
    'Movement Speed': 0.12,
    'Attack Speed': 0.1,
    'Cast Speed': 0.08,
    'Skill Mobility Efficiency': 0.1,
    'Resource Sustain': 0.1,
    'Currency Efficiency': 0.1,
  },
  constraints: {
    targets: {
      Damage: { enough: 1_000_000 },
      Survivability: { enough: 40_000 },
    },
  },
};

// --- Maximum DPS ------------------------------------------------------------
// The anti-satisficing preset: damage never saturates (enough = null), so more
// DPS is always better. Included to contrast with the goal-based philosophy.
const MAXIMUM_DPS: GoalPreset = {
  id: 'maximum-dps',
  name: 'Maximum DPS',
  description:
    'Maximize damage with no satisficing cap — the classic "higher DPS is ' +
    'always better" objective, kept as an explicit opt-in contrast.',
  weights: {
    Damage: 0.7,
    Survivability: 0.1,
    'Movement Speed': 0.03,
    'Attack Speed': 0.06,
    'Cast Speed': 0.04,
    'Skill Mobility Efficiency': 0.02,
    'Resource Sustain': 0.03,
    'Currency Efficiency': 0.02,
  },
  constraints: {
    targets: {
      Damage: { enough: null },
      Survivability: { enough: 15_000 },
    },
  },
};

/** All built-in Goal Presets, keyed by id. */
export const PRESETS: Record<string, GoalPreset> = {
  [FAST_MAPPING.id]: FAST_MAPPING,
  [BOSS_FARMING.id]: BOSS_FARMING,
  [HARDCORE_SURVIVABILITY.id]: HARDCORE_SURVIVABILITY,
  [BUDGET_FARMING.id]: BUDGET_FARMING,
  [BALANCED.id]: BALANCED,
  [MAXIMUM_DPS.id]: MAXIMUM_DPS,
};

/** Ordered list of built-in presets (stable, deterministic order). */
export const PRESET_LIST: readonly GoalPreset[] = [
  FAST_MAPPING,
  BOSS_FARMING,
  HARDCORE_SURVIVABILITY,
  BUDGET_FARMING,
  BALANCED,
  MAXIMUM_DPS,
];

export const DEFAULT_PRESET_ID = BALANCED.id;

/** Look up a preset by id, or `undefined` if unknown. */
export function getPreset(id: string): GoalPreset | undefined {
  return PRESETS[id];
}
