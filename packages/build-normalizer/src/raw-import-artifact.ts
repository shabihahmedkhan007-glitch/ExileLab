// Raw Import Artifact + the source-neutral intermediate the normalizer consumes.
//
// RFC-0001 AD-4: the Raw Import Artifact is the original payload an importer
// received — importer-owned, time-boxed retention, linked from Provenance, never
// part of the snapshot and never consumed downstream. Here it also carries the
// importer's *extraction* (a partial, source-neutral view) plus the fields the
// importer knows it could NOT extract ("declared gaps"), so the normalizer can
// honestly annotate assumptions (I3/I4) without re-parsing the source format.

import type { BuildSource } from "./model.js";

/** Partial character data an importer managed to extract. */
export interface ExtractedCharacter {
  readonly className?: string;
  readonly ascendancyName?: string;
  readonly level?: number;
}

/** Partial item data. */
export interface ExtractedItem {
  readonly id?: string;
  readonly slot?: string;
  readonly name?: string;
  readonly rarity?: string;
  readonly lines?: readonly string[];
}

/** Partial gem data. */
export interface ExtractedGem {
  readonly name?: string;
  readonly skillId?: string;
  readonly level?: number;
  readonly quality?: number;
}

/** Partial skill-group data. */
export interface ExtractedSkillGroup {
  readonly id?: string;
  readonly isMain?: boolean;
  readonly gems?: readonly ExtractedGem[];
}

/** Partial loadout data. */
export interface ExtractedLoadout {
  readonly id?: string;
  readonly name?: string;
  readonly primary?: boolean;
  readonly allocatedNodeIds?: readonly number[];
  readonly items?: readonly ExtractedItem[];
  readonly skills?: readonly ExtractedSkillGroup[];
  readonly configuration?: Readonly<Record<string, string | number | boolean>>;
  readonly resources?: Readonly<Record<string, string | number | boolean>>;
}

/** Provenance hints an importer can supply from the payload. */
export interface ExtractedProvenance {
  readonly reference?: string;
  readonly attribution?: string;
}

/** Metadata hints an importer can supply from the payload. */
export interface ExtractedMetadata {
  readonly labels?: readonly string[];
  readonly league?: string;
}

/**
 * A source-neutral, partial view of a build. Every field is optional: whatever an
 * importer omits becomes a declared gap or a normalizer default (with an origin).
 */
export interface ExtractedBuild {
  readonly gamePatch?: string;
  readonly character?: ExtractedCharacter;
  readonly loadouts?: readonly ExtractedLoadout[];
  readonly provenance?: ExtractedProvenance;
  readonly metadata?: ExtractedMetadata;
}

/**
 * The importer-owned artifact handed to the normalizer.
 * `payload` is the verbatim original input (retained per AD-4).
 * `gaps` are dotted canonical paths the importer *knows* it could not extract —
 * the PoB importer in particular declares these instead of silently guessing.
 */
export interface RawImportArtifact {
  readonly source: BuildSource;
  /** Stable reference used by Provenance.rawArtifactRef. */
  readonly ref: string;
  /** ISO-8601 time the importer received the payload. */
  readonly receivedAt: string;
  /** The original, unmodified payload text. */
  readonly payload: string;
  /** Source-neutral partial extraction. */
  readonly extracted: ExtractedBuild;
  /** Dotted canonical paths the importer could not extract (declared, not silent). */
  readonly gaps: readonly string[];
}
