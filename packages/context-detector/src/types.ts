// Public types for the Context Detector.
//
// NOTE ON @exilelab/core: RFC-0001 defines BuildSnapshot as the canonical,
// immutable, source-independent build model. At the time this package was
// written, `@exilelab/core` is still a stub and exports no BuildSnapshot type.
// Per the consumer contract in RFC-0001 §8.1, a consumer is "source-blind" and
// only needs the *slice* of the snapshot it actually reads. We therefore model
// that slice structurally here as `BuildSnapshot`. When core lands its canonical
// type, core's BuildSnapshot is expected to be assignable to this structural
// view (the categories below are drawn directly from RFC-0001 §5.3), so the
// detector keeps working without change.

/**
 * The eight Preference Axes (GLOSSARY — exact names, do not rename).
 * The detector never sets weights itself; it emits qualitative *hints* the
 * Preference Engine / UI can turn into slider defaults.
 */
export type PreferenceAxis =
  | 'Damage'
  | 'Survivability'
  | 'Movement Speed'
  | 'Attack Speed'
  | 'Cast Speed'
  | 'Skill Mobility Efficiency'
  | 'Resource Sustain'
  | 'Currency Efficiency';

/** Qualitative emphasis a detected archetype suggests for an axis. */
export type AxisEmphasis = 'high' | 'medium' | 'low';

/**
 * Goal Preset names (GLOSSARY canonical + PRODUCT_PLAN "The Preference Engine").
 * A detection suggests exactly one; the user always sees and may override it.
 */
export type GoalPreset =
  | 'Fast Mapping'
  | 'Speed Clearing'
  | 'Boss Farming'
  | 'Hardcore Survivability'
  | 'Tanky'
  | 'Budget Farming'
  | 'Balanced';

/** How a skill delivers its damage (PRODUCT_PLAN: hit / DoT / minion). */
export type DamageDelivery = 'hit' | 'dot' | 'minion';

/** The two PoE2 active-skill resources under pressure in a build. */
export type ResourceKind = 'mana' | 'spirit';

// ---------------------------------------------------------------------------
// Structural BuildSnapshot view (RFC-0001 §5.3 categories — build state only).
// ---------------------------------------------------------------------------

/** One active/support skill as it appears in a snapshot's Skills & Gems. */
export interface SnapshotSkill {
  /** Patch-scoped canonical skill id (RFC-0001 AD-3 — the authoritative ref). */
  skillId: string;
  /** Display Cache name (rendering only; never semantic truth — RFC-0001 AD-3). */
  displayName?: string;
  /** Main-skill designation (RFC-0001 §5.3 build state). */
  isMainSkill?: boolean;
}

/** Snapshot-carried defensive layer magnitudes for the loadout. */
export interface DefensiveLayers {
  energyShield?: number;
  armour?: number;
  evasion?: number;
  life?: number;
  block?: number;
}

/** Snapshot-carried resource state for the loadout. */
export interface ResourceState {
  unreservedMana?: number;
  unreservedSpirit?: number;
  /** Total spirit reserved by persistent skills / minions / auras. */
  reservedSpirit?: number;
  /** Main-skill resource cost per use. */
  mainSkillCost?: number;
}

/**
 * One Loadout Context (RFC-0001 AD-5): a coherent equipment-and-tree config.
 * A snapshot has one or more; consumers must not assume exactly one exists.
 */
export interface LoadoutContext {
  id: string;
  isPrimary: boolean;
  skills: SnapshotSkill[];
  defence?: DefensiveLayers;
  resources?: ResourceState;
}

/** Character build-state slice the detector reads. */
export interface SnapshotCharacter {
  className?: string;
  ascendancy?: string;
  level?: number;
}

/**
 * Structural view of a BuildSnapshot — the slice the Context Detector consumes.
 * Immutable input (RFC-0001 I1): the detector never mutates it.
 */
export interface BuildSnapshot {
  snapshotFormatVersion: string;
  gamePatch: string;
  character: SnapshotCharacter;
  loadouts: LoadoutContext[];
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
