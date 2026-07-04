// detectArchetype — the Context Detector entry point.
//
// Consumes a BuildSnapshot (RFC-0001) plus the skill-mechanics table, extracts
// features, evaluates the rules table, and produces a Derived Analysis: the
// primary Archetype, all detected tags, a suggested Goal Preset, per-axis hints,
// and a human-readable rationale. Deterministic and side-effect-free.

import type { ArchetypeDetection, BuildSnapshot } from './types.js';
import { extractFeatures } from './features.js';
import { ARCHETYPE_RULES, FALLBACK_RULE, type ArchetypeRule } from './rules.js';
import {
  DEFAULT_SKILL_MECHANICS,
  type SkillMechanics,
} from './skill-mechanics.js';

export interface DetectOptions {
  /** Override the skill-mechanics table (defaults to DEFAULT_SKILL_MECHANICS). */
  mechanics?: readonly SkillMechanics[];
}

/**
 * Classify what a build is trying to do.
 *
 * Selection: every rule whose predicate matches fires and contributes its tags;
 * the highest-`priority` match becomes the *primary* archetype and supplies the
 * suggested preset, axis hints, and rationale. Ties break by table order (the
 * earlier-authored rule wins), keeping output stable and reproducible.
 */
export function detectArchetype(
  snapshot: BuildSnapshot,
  options: DetectOptions = {},
): ArchetypeDetection {
  const table = options.mechanics ?? DEFAULT_SKILL_MECHANICS;
  const features = extractFeatures(snapshot, table);

  const matched: ArchetypeRule[] = ARCHETYPE_RULES.filter((rule) =>
    rule.matches(features),
  );

  // Stable, priority-first ordering. Array#sort is not guaranteed stable across
  // all engines for large inputs, so we break ties on original index explicitly.
  const ordered = matched
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => b.rule.priority - a.rule.priority || a.index - b.index)
    .map((entry) => entry.rule);

  const primary: ArchetypeRule = ordered[0] ?? FALLBACK_RULE;

  // Union of tags across every matched rule, de-duplicated, primary rule first.
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const rule of ordered.length > 0 ? ordered : [FALLBACK_RULE]) {
    for (const tag of rule.tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }
  }

  return {
    archetype: primary.archetype,
    tags,
    suggestedPreset: primary.suggestedPreset,
    rationale: primary.rationale(features),
    axisHints: { ...primary.axisHints },
    matchedRules: (ordered.length > 0 ? ordered : [FALLBACK_RULE]).map(
      (rule) => rule.id,
    ),
  };
}
