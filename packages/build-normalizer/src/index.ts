// @exilelab/build-normalizer — the importer/normalizer boundary (RFC-0001 §5.2).
// Importers are the ONLY components that know source formats; the normalizer owns
// canonicalization and declares every assumption. No network calls, ever.

// Canonical model (long-term home is @exilelab/core; re-exported here until it lands).
export type {
  AssumptionOrigin,
  Assumption,
  BuildSource,
  Character,
  PassiveTree,
  Item,
  Gem,
  SkillGroup,
  Configuration,
  Resources,
  LoadoutContext,
  Versioning,
  Provenance,
  DisplayCache,
  Metadata,
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

// Identity (canonicalization).
export { computeIdentity } from "./identity.js";
