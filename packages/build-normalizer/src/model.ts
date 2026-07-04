// Canonical build model (BuildSnapshot) as consumed/produced by the normalizer.
//
// RFC-0001 defines BuildSnapshot as the immutable, normalized, source-independent
// representation of one build's complete state at one moment, on one game patch.
//
// NOTE ON OWNERSHIP: the long-term home of these types is @exilelab/core. At the
// time this package was implemented `core` is still a stub (`export {}`), so the
// canonical shape the normalizer must emit is defined here and re-exported from
// core's slot once it lands. Everything here follows RFC-0001 §5.3 categories and
// invariants I1-I7; when core publishes BuildSnapshot this module becomes a
// thin re-export/adapter with no behavioural change for consumers.

/**
 * Where a filled field's value came from. RFC-0001 I3/I4 "honesty over
 * completeness": every field the normalizer fills carries exactly one origin.
 * - imported:  taken verbatim from the source payload.
 * - inferred:  derived by the normalizer from other imported data.
 * - defaulted: no source data existed; the normalizer supplied a safe default.
 */
export type AssumptionOrigin = "imported" | "inferred" | "defaulted";

/** The external formats an importer can recognise. Consumers must stay source-blind. */
export type BuildSource = "native-json" | "pob-code";

/**
 * One declared assumption. RFC-0001 makes Assumptions a first-class structural
 * category (risk R3: no silent defaulting). Keyed by a dotted canonical path so
 * the Doctor / optimizer can point at exactly which datum was filled.
 */
export interface Assumption {
  /** Dotted path into the canonical model, e.g. "character.ascendancyName". */
  readonly path: string;
  readonly origin: AssumptionOrigin;
  /** Human-readable justification (never narrated by an LLM; deterministic text). */
  readonly note?: string;
}

/** Character-level build state (build-wide, not per-loadout). */
export interface Character {
  readonly className: string;
  readonly ascendancyName: string | null;
  readonly level: number;
}

/** Passive tree state for one Loadout Context. Node ids are canonically sorted. */
export interface PassiveTree {
  readonly allocatedNodeIds: readonly number[];
}

/** One equipped item. Kept structural and source-independent. */
export interface Item {
  /** Stable id within the snapshot (importer-assigned, canonicalised). */
  readonly id: string;
  /** Equipment slot, e.g. "Weapon 1", "Body Armour". */
  readonly slot: string;
  readonly name: string;
  readonly rarity: string | null;
  /** Raw mod/stat lines when the source provides them; empty when unknown. */
  readonly lines: readonly string[];
}

/** One socketed gem within a skill group. */
export interface Gem {
  readonly name: string;
  /** Engine skill identifier when the source provides it. */
  readonly skillId: string | null;
  readonly level: number | null;
  readonly quality: number | null;
}

/** A linked skill group; one group in the build is the designated main skill. */
export interface SkillGroup {
  readonly id: string;
  readonly isMain: boolean;
  readonly gems: readonly Gem[];
}

/**
 * Calculation configuration (RFC-0001 risk R5: config is build state, first-class,
 * inside identity). Free-form deterministic key/value context the engine consumes.
 */
export type Configuration = Readonly<Record<string, string | number | boolean>>;

/** Resource-related build state (life/mana/ES reservations etc.), source-neutral. */
export type Resources = Readonly<Record<string, string | number | boolean>>;

/**
 * One coherent equipment-and-tree configuration (PoE2 weapon set with its own
 * passive points). RFC-0001 AD-5: multiple Loadout Contexts from day one.
 */
export interface LoadoutContext {
  readonly id: string;
  readonly name: string | null;
  readonly primary: boolean;
  readonly passiveTree: PassiveTree;
  readonly equipment: readonly Item[];
  readonly skills: readonly SkillGroup[];
  readonly configuration: Configuration;
  readonly resources: Resources;
}

/** Snapshot versioning (RFC-0001 I5). Engine versions live on Calculation Results. */
export interface Versioning {
  /** Game patch the snapshot is interpretable against. */
  readonly gamePatch: string;
  /** Snapshot-format version, independent of the game patch (risk R7). */
  readonly snapshotFormatVersion: number;
}

/** Provenance (RFC-0001): source + attribution for compliance surfaces. */
export interface Provenance {
  readonly source: BuildSource;
  /** Opaque reference to the retained Raw Import Artifact (AD-4). */
  readonly rawArtifactRef: string;
  /** Original source reference/URL/handle when supplied (attribution). */
  readonly reference: string | null;
  /** Attribution string for comparison surfaces (charter §7.5). */
  readonly attribution: string | null;
  /** ISO-8601 import time. NOT part of Canonical Identity. */
  readonly importedAt: string;
}

/**
 * Rendering-only denormalized data (RFC-0001 AD-3). Excluded from Canonical
 * Identity; never a source of semantic truth.
 */
export interface DisplayCache {
  readonly labels: Readonly<Record<string, string>>;
}

/** Snapshot metadata (display labels, league). Excluded from Canonical Identity. */
export interface Metadata {
  readonly labels: readonly string[];
  readonly league: string | null;
}

/**
 * The canonical BuildSnapshot. Immutable (I1); identity computed over build state
 * only (I2); uniform shape with honest fidelity via `assumptions` (I3/I4);
 * version-aware (I5); self-contained by reference (I6).
 */
export interface BuildSnapshot {
  /**
   * Canonical Identity: deterministic hash over build state only
   * (character + loadout contexts). Metadata, Display Cache, Provenance and
   * Assumptions are excluded (I2).
   */
  readonly identity: string;
  readonly character: Character;
  /** One or more Loadout Contexts; exactly one has primary === true (AD-5). */
  readonly loadouts: readonly LoadoutContext[];
  readonly versioning: Versioning;
  readonly provenance: Provenance;
  /** Every field the normalizer filled, with its origin (I3/I4). */
  readonly assumptions: readonly Assumption[];
  readonly metadata: Metadata;
  readonly displayCache: DisplayCache;
}
