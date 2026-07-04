// Public types for the Context Detector.
//
// The canonical BuildSnapshot now lives in @exilelab/core (RFC-0001 landed) and is
// re-exported here — there is no package-local structural mirror anymore. The
// detector is a source-blind consumer (RFC-0001 §8.1): it reads build state
// (character, loadout contexts, skills) from the core snapshot and resolves skill
// display names from its Display Cache.
//
// Engine-derived defensive/resource MAGNITUDES (energy shield, reserved spirit, …)
// are NOT build state — RFC-0001 AD-7 keeps calculated values in Calculation
// Results, never in the snapshot. So they arrive through an OPTIONAL companion
// `CalculationView` overlay keyed by Loadout Context id; without it, detection
// keys off skill mechanics alone, which is sufficient for the launch rules table.

import type { BuildSnapshot, LoadoutContext } from "@exilelab/core";

export type {
  BuildSnapshot,
  BuildState,
  LoadoutContext,
  SkillSetup,
  Character,
  DisplayCache,
} from "@exilelab/core";

/**
 * The eight Preference Axes (GLOSSARY — exact names, do not rename).
 * The detector never sets weights itself; it emits qualitative *hints* the
 * Preference Engine / UI can turn into slider defaults.
 */
export type PreferenceAxis =
  | "Damage"
  | "Survivability"
  | "Movement Speed"
  | "Attack Speed"
  | "Cast Speed"
  | "Skill Mobility Efficiency"
  | "Resource Sustain"
  | "Currency Efficiency";

/** Qualitative emphasis a detected archetype suggests for an axis. */
export type AxisEmphasis = "high" | "medium" | "low";

/**
 * Goal Preset names (GLOSSARY canonical + PRODUCT_PLAN "The Preference Engine").
 * A detection suggests exactly one; the user always sees and may override it.
 */
export type GoalPreset =
  | "Fast Mapping"
  | "Speed Clearing"
  | "Boss Farming"
  | "Hardcore Survivability"
  | "Tanky"
  | "Budget Farming"
  | "Balanced";

/** How a skill delivers its damage (PRODUCT_PLAN: hit / DoT / minion). */
export type DamageDelivery = "hit" | "dot" | "minion";

/** The two PoE2 active-skill resources under pressure in a build. */
export type ResourceKind = "mana" | "spirit";

// ---------------------------------------------------------------------------
// Engine-derived overlay (Calculation Result slice, RFC-0001 AD-7 — NOT in the
// snapshot). Optional: supplied when calculated numbers are available.
// ---------------------------------------------------------------------------

/** Snapshot-external defensive layer magnitudes for a loadout (engine-derived). */
export interface DefensiveLayers {
  energyShield?: number;
  armour?: number;
  evasion?: number;
  life?: number;
  block?: number;
}

/** Snapshot-external resource state for a loadout (engine-derived). */
export interface ResourceState {
  unreservedMana?: number;
  unreservedSpirit?: number;
  /** Total spirit reserved by persistent skills / minions / auras. */
  reservedSpirit?: number;
  /** Main-skill resource cost per use. */
  mainSkillCost?: number;
}

/** Engine-derived metrics for one Loadout Context. */
export interface LoadoutMetrics {
  defence?: DefensiveLayers;
  resources?: ResourceState;
}

/** Engine-derived overlay keyed by Loadout Context id (RFC-0001 AD-7). */
export type CalculationView = Readonly<Record<string, LoadoutMetrics>>;

/**
 * The detector's input: a canonical core BuildSnapshot plus the OPTIONAL
 * engine-derived overlay. A bare BuildSnapshot is accepted directly (calc absent).
 */
export interface DetectionInput {
  snapshot: BuildSnapshot;
  calc?: CalculationView;
}

/** Normalize either accepted input form to the {snapshot, calc} shape. */
export function resolveInput(input: BuildSnapshot | DetectionInput): DetectionInput {
  return "buildState" in input ? { snapshot: input } : input;
}

/** The detector's normalized per-skill view (skillId + display name + main flag). */
export interface DetectorSkill {
  /** Patch-scoped canonical skill id (skillGemRef, falling back to setupId). */
  skillId: string;
  /** Display Cache name (rendering only; never semantic truth — RFC-0001 AD-3). */
  displayName?: string;
  /** Main-skill designation (RFC-0001 §5.3 build state). */
  isMainSkill: boolean;
}

/** Resolve the primary Loadout Context (RFC-0001 AD-5: never assume exactly one). */
export function primaryLoadout(snapshot: BuildSnapshot): LoadoutContext | undefined {
  const loadouts = snapshot.buildState.loadoutContexts;
  return loadouts.find((l) => l.primary) ?? loadouts[0];
}

// ---------------------------------------------------------------------------
// Detection output.
// ---------------------------------------------------------------------------

/**
 * The Context Detector's output for a snapshot (a Derived Analysis, never
 * embedded in the snapshot — RFC-0001 AD-7).
 */
export interface ArchetypeDetection {
  /** Primary archetype label (the single most-defining classification). */
  archetype: string;
  /** Every mechanic/archetype tag detected across all matched rules. */
  tags: string[];
  /** The suggested Goal Preset (user always sees + may override). */
  suggestedPreset: GoalPreset;
  /** Human-readable explanation naming the detected mechanic. Never empty. */
  rationale: string;
  /** Qualitative per-axis emphasis hints (e.g. Attack Speed high, Movement low). */
  axisHints: Partial<Record<PreferenceAxis, AxisEmphasis>>;
  /** Ids of every rule that fired, most-defining first (for auditability). */
  matchedRules: string[];
}
