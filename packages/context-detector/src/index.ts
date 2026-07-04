// @exilelab/context-detector — Context Detector (GLOSSARY): data-driven,
// rule-based classification of what a build is trying to do (its Archetype),
// consumed before any judgment is made. No ML, no LLM, no network — plain
// deterministic TypeScript over a core BuildSnapshot (RFC-0001).

export { detectArchetype, type DetectOptions } from "./detect.js";

export type {
  ArchetypeDetection,
  AxisEmphasis,
  BuildSnapshot,
  BuildState,
  CalculationView,
  Character,
  DamageDelivery,
  DefensiveLayers,
  DetectionInput,
  DetectorSkill,
  DisplayCache,
  GoalPreset,
  LoadoutContext,
  LoadoutMetrics,
  PreferenceAxis,
  ResourceKind,
  ResourceState,
  SkillSetup,
} from "./types.js";

export { primaryLoadout, resolveInput } from "./types.js";

export {
  ARCHETYPE_RULES,
  FALLBACK_RULE,
  type ArchetypeRule,
} from "./rules.js";

export {
  extractFeatures,
  skillLabel,
  ES_TANK_FLOOR,
  SPIRIT_PRESSURE_FLOOR,
  type BuildFeatures,
  type EnrichedSkill,
} from "./features.js";

export {
  DEFAULT_SKILL_MECHANICS,
  defaultMechanicsFor,
  indexMechanics,
  resolveMechanics,
  type SkillActionType,
  type SkillMechanics,
} from "./skill-mechanics.js";
