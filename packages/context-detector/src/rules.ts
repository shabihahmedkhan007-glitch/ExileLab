// The archetype rules table.
//
// This is the data-driven core of the Context Detector: a flat, ordered table
// of independent rules. Each rule is a self-contained, unit-testable object
// that (a) matches a predicate over the extracted features, (b) contributes
// tags, and (c) — if it is the highest-priority match — supplies the primary
// archetype, the suggested Goal Preset, per-axis hints, and a human-readable
// rationale. No buried if/else chains: `detectArchetype` just iterates this
// table. New archetypes are new rows.

import type {
  AxisEmphasis,
  GoalPreset,
  PreferenceAxis,
} from './types.js';
import { type BuildFeatures, skillLabel } from './features.js';

export interface ArchetypeRule {
  /** Stable rule id (used in ArchetypeDetection.matchedRules and tests). */
  id: string;
  /** Archetype label this rule assigns when it is the primary match. */
  archetype: string;
  /** Tags this rule contributes whenever it fires. */
  tags: readonly string[];
  /** Higher wins for primary-archetype / preset selection. */
  priority: number;
  /** Goal Preset suggested when this rule is primary. */
  suggestedPreset: GoalPreset;
  /** Per-axis emphasis hints suggested when this rule is primary. */
  axisHints: Partial<Record<PreferenceAxis, AxisEmphasis>>;
  /** Pure predicate over derived features. */
  matches: (f: BuildFeatures) => boolean;
  /** Human-readable rationale; MUST name the detected mechanic. Never empty. */
  rationale: (f: BuildFeatures) => string;
}

/**
 * The rules table, authored high-priority first for readability (selection does
 * not depend on array order — it sorts by `priority`).
 */
export const ARCHETYPE_RULES: readonly ArchetypeRule[] = [
  {
    id: 'attack-as-movement',
    archetype: 'attack-as-movement',
    tags: ['attack-as-movement', 'mobility-via-attack'],
    priority: 100,
    suggestedPreset: 'Fast Mapping',
    axisHints: {
      'Attack Speed': 'high',
      'Movement Speed': 'low',
      'Skill Mobility Efficiency': 'high',
    },
    matches: (f) => f.attackAsMovement,
    rationale: (f) =>
      `This build moves by attacking — its main skill (${skillLabel(
        f.mainSkill,
      )}) carries movement, so attack speed is your real movement stat; raw ` +
      `movement speed is a low priority.`,
  },
  {
    id: 'dash-loop-mobility',
    archetype: 'dash-loop-mobility',
    tags: ['dash-loop', 'mobility-via-dash'],
    priority: 90,
    suggestedPreset: 'Speed Clearing',
    axisHints: {
      'Skill Mobility Efficiency': 'high',
      'Movement Speed': 'medium',
      'Attack Speed': 'medium',
    },
    matches: (f) => f.dashLoopMobility,
    rationale: (f) => {
      const dash = f.skills.find(
        (s) => s.mechanics.isMovementSkill && s.mechanics.repeatedUseMobility,
      );
      return (
        `Mobility comes from repeatedly looping a movement skill ` +
        `(${skillLabel(dash)}); its cooldown and cost efficiency drive your ` +
        `movement, not flat movement speed.`
      );
    },
  },
  {
    id: 'es-tank',
    archetype: 'es-tank',
    tags: ['es-tank', 'energy-shield-defence'],
    priority: 80,
    suggestedPreset: 'Hardcore Survivability',
    axisHints: {
      Survivability: 'high',
      Damage: 'medium',
    },
    matches: (f) => f.esDominant,
    rationale: (f) =>
      `Energy shield is your dominant defensive layer (${
        f.defence.energyShield ?? 0
      } ES) — this is an ES-tank, so survivability and ES sustain outweigh raw ` +
      `damage.`,
  },
  {
    id: 'minion-damage',
    archetype: 'minion-commander',
    tags: ['minion-damage'],
    priority: 40,
    suggestedPreset: 'Boss Farming',
    axisHints: {
      'Resource Sustain': 'high',
      Survivability: 'medium',
    },
    matches: (f) => f.primaryDelivery === 'minion',
    rationale: (f) =>
      `Damage is delivered by minions (${skillLabel(
        f.mainSkill,
      )}) rather than your own hits — keeping minions alive via spirit sustain ` +
      `is central.`,
  },
  {
    id: 'damage-over-time',
    archetype: 'damage-over-time',
    tags: ['dot-damage'],
    priority: 40,
    suggestedPreset: 'Boss Farming',
    axisHints: {
      Damage: 'high',
      'Cast Speed': 'medium',
    },
    matches: (f) => f.primaryDelivery === 'dot',
    rationale: (f) =>
      `Your damage is delivered over time (${skillLabel(
        f.mainSkill,
      )}) rather than on hit — application and duration matter more than big ` +
      `single hits.`,
  },
  {
    id: 'hit-caster',
    archetype: 'hit-caster',
    tags: ['hit-damage', 'spellcaster'],
    priority: 30,
    suggestedPreset: 'Balanced',
    axisHints: {
      Damage: 'high',
      'Cast Speed': 'high',
    },
    matches: (f) =>
      f.primaryDelivery === 'hit' &&
      f.mainSkill?.mechanics.actionType === 'spell',
    rationale: (f) =>
      `This is a hit-based spellcaster (${skillLabel(
        f.mainSkill,
      )}); cast speed and per-hit spell damage drive it.`,
  },
  {
    id: 'hit-attacker',
    archetype: 'hit-attacker',
    tags: ['hit-damage', 'attacker'],
    priority: 30,
    suggestedPreset: 'Balanced',
    axisHints: {
      Damage: 'high',
      'Attack Speed': 'high',
    },
    matches: (f) =>
      f.primaryDelivery === 'hit' &&
      f.mainSkill?.mechanics.actionType === 'attack' &&
      !f.attackAsMovement,
    rationale: (f) =>
      `This is a hit-based attacker (${skillLabel(
        f.mainSkill,
      )}); attack speed and per-hit damage drive it.`,
  },
  {
    id: 'spirit-pressure',
    archetype: 'spirit-constrained',
    tags: ['spirit-pressure'],
    priority: 10,
    suggestedPreset: 'Balanced',
    axisHints: {
      'Resource Sustain': 'high',
    },
    matches: (f) => f.spiritPressure,
    rationale: () =>
      `Spirit is the binding resource here (reserved by persistent skills such ` +
      `as minions or auras) — spirit sustain gates what the build can run.`,
  },
  {
    id: 'mana-pressure',
    archetype: 'mana-constrained',
    tags: ['mana-pressure'],
    priority: 10,
    suggestedPreset: 'Balanced',
    axisHints: {
      'Resource Sustain': 'medium',
    },
    matches: (f) => f.manaPressure,
    rationale: () =>
      `Mana is the binding resource here — mana sustain against the main ` +
      `skill's cost keeps the build casting/attacking.`,
  },
];

/** Fallback when no rule fires (e.g. a snapshot with no skills). */
export const FALLBACK_RULE: ArchetypeRule = {
  id: 'unclassified',
  archetype: 'generalist',
  tags: ['unclassified'],
  priority: -1,
  suggestedPreset: 'Balanced',
  axisHints: {},
  matches: () => true,
  rationale: () =>
    `Not enough skill-mechanics data to classify this build — defaulting to a ` +
    `balanced profile until a main skill is designated.`,
};
