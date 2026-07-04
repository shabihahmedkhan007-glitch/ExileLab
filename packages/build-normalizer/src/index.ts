// @exilelab/build-normalizer — the importer/normalizer boundary (RFC-0001 §5.2).
// Importers are the ONLY components that know source formats; the normalizer owns
// canonicalization and declares every assumption. No network calls, ever.

// Canonical model — re-exported straight from @exilelab/core (RFC-0001 landed).
// The normalizer emits core's BuildSnapshot natively; there is no local mirror.
export type {
  AssumptionOrigin,
  Assumption,
  BuildSource,
  Character,
  PassiveTreeAllocation,
  MasteryEffect,
  EquipmentItem,
  SkillSetup,
  ConfigEntry,
  LoadoutContext,
  Provenance,
  DisplayCache,
  Metadata,
  BuildState,
  BuildSnapshot,
} from "./model.js";

// Raw Import Artifact + source-neutral intermediate.
export type {
  ExtractedBuild,
  ExtractedCharacter,
  ExtractedItem,
  ExtractedGem,
  ExtractedSkillGroup,
  ExtractedLoadout,
  ExtractedProvenance,
  ExtractedMetadata,
  RawImportArtifact,
} from "./raw-import-artifact.js";

// Errors.
export {
  NormalizerError,
  UnknownSourceError,
  ImportError,
  NormalizeError,
} from "./errors.js";

// Importer boundary + concrete importers.
export type { Importer } from "./importers/importer.js";
export {
  NativeJsonImporter,
  nativeInterchangeSchema,
  NATIVE_FORMAT_TAG,
  type NativeInterchange,
} from "./importers/native-json.js";
export { PobCodeImporter, encodePobCode } from "./importers/pob-code.js";

// Routing.
export { detectSource, importAny, importers } from "./detect.js";

// Normalizer.
export {
  normalize,
  SNAPSHOT_FORMAT_VERSION,
  UNKNOWN_GAME_PATCH,
  type NormalizeOptions,
} from "./normalizer.js";

// Canonical Identity + canonicalization now live in @exilelab/core (RFC-0001 I2).
// Re-exported so importers/tools that need the identity function have one home.
export { computeBuildStateIdentity, createBuildSnapshot } from "@exilelab/core";
