// @exilelab/core — canonical build model types (RFC-0001).
//
// These are DATA types with guarantees; they own no behavior (RFC-0001 §5.2).
// Terminology is canonical per docs/GLOSSARY.md — do not introduce synonyms.
//
// A BuildSnapshot is the immutable, normalized, source-independent representation
// of one build's complete state at one moment on one game patch. It carries a
// deterministic Canonical Identity computed over its build state ONLY
// (Metadata and DisplayCache are excluded — invariant I2).

// ---------------------------------------------------------------------------
// Build state (participates in Canonical Identity)
// ---------------------------------------------------------------------------

/** Character identity within a build (RFC-0001 §5.3 build state). */
export interface Character {
  /** Character class, e.g. "Huntress". Game-data reference by name/id. */
  readonly class: string;
  /** Ascendancy, e.g. "Ritualist", or null when none is chosen. */
  readonly ascendancy: string | null;
  /** Character level. */
  readonly level: number;
}

/** Passive tree allocation for a single Loadout Context. */
export interface PassiveTreeAllocation {
  /**
   * Allocated passive node ids. ORDER-INSENSITIVE: canonicalized by ascending
   * numeric sort before hashing (see canonical.ts).
   */
  readonly allocatedNodes: readonly number[];
  /**
   * Chosen mastery effects. ORDER-INSENSITIVE: canonicalized by (nodeId, effectId).
   */
  readonly masteryEffects: readonly MasteryEffect[];
}

export interface MasteryEffect {
  readonly nodeId: number;
  readonly effectId: number;
}

/** One equipped item in a slot. Item is referenced by game-data id (AD-3). */
export interface EquipmentItem {
  /** Canonical slot name, e.g. "weapon1", "helmet", "ring1". */
  readonly slot: string;
  /** Game-data reference for the base/unique item, or null for an empty slot. */
  readonly itemRef: string | null;
  /** Rarity classification, e.g. "normal" | "magic" | "rare" | "unique". */
  readonly rarity: string | null;
  /**
   * Rolled modifier lines. ORDER-INSENSITIVE: canonicalized by lexical sort.
   * Kept as reference-friendly strings; full mod modelling is importer/engine work.
   */
  readonly modifiers: readonly string[];
}

/** One skill setup (a main or supporting skill gem plus its support gems). */
export interface SkillSetup {
  /** Stable id for this setup within the loadout (importer-assigned). */
  readonly setupId: string;
  /** True for the build's designated main skill (RFC-0001 §5.3). */
  readonly isMainSkill: boolean;
  /** Game-data reference for the active skill gem, or null if the setup is empty. */
  readonly skillGemRef: string | null;
  /** Slot/host the setup is socketed into, if known (rendering-neutral reference). */
  readonly socket: string | null;
  /**
   * Support gem references. ORDER-INSENSITIVE: canonicalized by lexical sort.
   */
  readonly supports: readonly string[];
}

/** One coherent equipment-and-tree configuration within a build (RFC-0001 AD-5). */
export interface LoadoutContext {
  /** Stable id for this context (importer-assigned). */
  readonly contextId: string;
  /**
   * Exactly one context in a snapshot is primary. `primary` is semantic build
   * state (it selects the default calculation context), so it participates in
   * identity. Consumers MUST NOT assume exactly one context exists.
   */
  readonly primary: boolean;
  readonly passiveTree: PassiveTreeAllocation;
  /** Equipped items. ORDER-INSENSITIVE: canonicalized by slot. */
  readonly equipment: readonly EquipmentItem[];
  /** Skill setups. ORDER-INSENSITIVE: canonicalized by setupId. */
  readonly skills: readonly SkillSetup[];
}

/** A single calculation-context configuration value (RFC-0001 risk R5: first-class). */
export interface ConfigEntry {
  readonly key: string;
  readonly value: string | number | boolean;
}

/** Where a value came from (RFC-0001 I3/I4 honesty guarantees). */
export type AssumptionOrigin = 'imported' | 'inferred' | 'defaulted';

/**
 * A per-field declaration of data fidelity. Every gap an importer filled is
 * declared here rather than through structural variation (I3). Assumptions
 * ride WITH build state structurally but are EXCLUDED from Canonical Identity:
 * RFC-0001 §5.3 classifies them as snapshot context (about the import, not the
 * build), so the same build imported via different sources hashes identically (I2).
 */
export interface Assumption {
  /** Dotted path to the field this annotation covers, e.g. "character.level". */
  readonly path: string;
  readonly origin: AssumptionOrigin;
  /** Optional human-neutral note explaining the inference/default. */
  readonly note?: string;
}

/**
 * The canonical build state — the ONLY input to Canonical Identity.
 * Everything here is semantic truth about the build itself.
 */
export interface BuildState {
  readonly character: Character;
  /** One or more Loadout Contexts (RFC-0001 AD-5); one has `primary: true`. */
  readonly loadoutContexts: readonly LoadoutContext[];
  /** Calculation-context configuration. ORDER-INSENSITIVE: canonicalized by key. */
  readonly configuration: readonly ConfigEntry[];
  /** Data-fidelity declarations. ORDER-INSENSITIVE; EXCLUDED from Canonical Identity (snapshot context per RFC-0001 §5.3). */
  readonly assumptions: readonly Assumption[];
}

// ---------------------------------------------------------------------------
// Snapshot context (NOT part of Canonical Identity)
// ---------------------------------------------------------------------------

/** Source attribution and re-normalization linkage (RFC-0001 §5.3, charter §7.5). */
export interface Provenance {
  /** Importer/source identifier, e.g. "pob-code", "pobb.in", "promoted-mutation". */
  readonly source: string;
  /** Source reference (share code id, url, or originating mutation id). */
  readonly reference?: string;
  /** ISO-8601 timestamp of when the snapshot was produced/imported. */
  readonly importedAt: string;
  /** Author/community attribution for display surfaces. */
  readonly attribution?: string;
  /** Link to the importer-owned Raw Import Artifact (never embedded here). */
  readonly rawImportArtifactId?: string;
}

/**
 * About the snapshot, not the build. EXCLUDED from Canonical Identity (I2).
 * Carries the game patch and the snapshot-format version (I5).
 */
export interface Metadata {
  /** Game patch the snapshot is interpretable against (I5/I6). */
  readonly patchVersion: string;
  /** Snapshot-format version, independent of game patch (I5, risk R7). */
  readonly formatVersion: string;
  readonly provenance: Provenance;
  /** Optional user-facing labels/league context (identity-excluded). */
  readonly label?: string;
  readonly league?: string;
}

/**
 * Minimal denormalized rendering data (names/icons-level) so UI surfaces —
 * including statically-rendered shared reports — can render historical
 * snapshots without a historical-game-data lookup (RFC-0001 AD-3).
 * Rendering-only; EXCLUDED from Canonical Identity; never semantic truth (R9).
 */
export interface DisplayCache {
  /** Game-data id → display name. */
  readonly names: Readonly<Record<string, string>>;
  /** Game-data id → icon reference. */
  readonly icons: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// BuildSnapshot
// ---------------------------------------------------------------------------

/**
 * The canonical internal language for builds (RFC-0001). Immutable (I1),
 * deterministically identified (I2), source-independent (I3), engine-sufficient
 * with declared assumptions (I4), version-aware (I5), self-contained by
 * reference (I6).
 */
export interface BuildSnapshot {
  /**
   * Canonical Identity: sha256 hex over the canonically serialized BuildState
   * ONLY. Stable under key/array reordering; independent of Metadata/DisplayCache.
   */
  readonly identity: string;
  readonly buildState: BuildState;
  readonly metadata: Metadata;
  readonly displayCache: DisplayCache;
}

/** Input to {@link createBuildSnapshot}; identity is computed, never supplied. */
export interface BuildSnapshotInput {
  readonly buildState: BuildState;
  readonly metadata: Metadata;
  readonly displayCache: DisplayCache;
}

// ---------------------------------------------------------------------------
// BuildMutation
// ---------------------------------------------------------------------------

/**
 * Typed candidate-change operations (RFC-0001 AD-2). Operation ORDER IS
 * SEMANTIC (apply sequence) and is therefore preserved, not canonicalized.
 */
export type MutationOperation =
  | { readonly kind: 'allocatePassiveNode'; readonly loadoutContextId: string; readonly nodeId: number }
  | { readonly kind: 'deallocatePassiveNode'; readonly loadoutContextId: string; readonly nodeId: number }
  | { readonly kind: 'swapItem'; readonly loadoutContextId: string; readonly item: EquipmentItem }
  | { readonly kind: 'changeGem'; readonly loadoutContextId: string; readonly setupId: string; readonly skillGemRef: string | null }
  | {
      readonly kind: 'changeSupport';
      readonly loadoutContextId: string;
      readonly setupId: string;
      readonly removeSupportRef?: string;
      readonly addSupportRef?: string;
    }
  | { readonly kind: 'changeConfig'; readonly key: string; readonly value: string | number | boolean };

/**
 * An immutable delta referencing a base snapshot by identity (RFC-0001 AD-2).
 * Promoted to a NEW BuildSnapshot on acceptance via {@link promoteMutation}.
 */
export interface BuildMutation {
  /** Deterministic id: sha256 hex over (baseSnapshotId, operations). */
  readonly mutationId: string;
  /** Canonical Identity of the base snapshot this delta applies to. */
  readonly baseSnapshotId: string;
  readonly operations: readonly MutationOperation[];
}

/** Input to {@link createBuildMutation}; mutationId is computed, never supplied. */
export interface BuildMutationInput {
  readonly baseSnapshotId: string;
  readonly operations: readonly MutationOperation[];
}

// ---------------------------------------------------------------------------
// Calculation Result (separate artifact — NEVER embedded in a snapshot, AD-7)
// ---------------------------------------------------------------------------

/** Composite key for a Calculation Result (RFC-0001 AD-7). */
export interface CalculationResultKey {
  readonly snapshotId: string;
  /** Present when the result is for a base snapshot + candidate mutation. */
  readonly mutationId?: string;
  /** Engine version belongs to the result, never to the snapshot (I5). */
  readonly engineVersion: string;
}

/** Engine output for a (snapshot, mutation?, engineVersion) triple. */
export interface CalculationResult {
  readonly key: CalculationResultKey;
  /** Engine-computed metrics; the engine is the sole calculator (principle #1). */
  readonly metrics: Readonly<Record<string, number>>;
  /** ISO-8601 timestamp of computation. */
  readonly computedAt: string;
}

// ---------------------------------------------------------------------------
// Raw Import Artifact (importer-owned — never part of a snapshot, AD-4)
// ---------------------------------------------------------------------------

/** Time-boxed retention note for a Raw Import Artifact (RFC-0001 AD-4, OQ-1). */
export interface RetentionNote {
  /** ISO-8601 timestamp after which the artifact may be purged. */
  readonly expiresAt: string;
  /** Human-neutral note describing the retention policy applied. */
  readonly note: string;
}

/**
 * The original payload an importer received (RFC-0001 AD-4). Importer-owned,
 * time-boxed, internal-only; linked from a snapshot's Provenance but NEVER part
 * of a snapshot and NEVER consumed downstream.
 */
export interface RawImportArtifact {
  readonly artifactId: string;
  /** Source identifier matching the importer that produced it. */
  readonly source: string;
  /** ISO-8601 timestamp of fetch/receipt. */
  readonly fetchedAt: string;
  /** Opaque original payload (e.g. a pasted PoB code). */
  readonly payload: string;
  readonly retention: RetentionNote;
}
