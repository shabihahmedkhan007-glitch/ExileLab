// Canonical build model (BuildSnapshot) as consumed/produced by the normalizer.
//
// RFC-0001 defines BuildSnapshot as the immutable, normalized, source-independent
// representation of one build's complete state at one moment, on one game patch.
//
// OWNERSHIP: the canonical model now lives in @exilelab/core (RFC-0001 landed).
// This module is a thin re-export of core's types so the normalizer emits core's
// BuildSnapshot natively — there is no package-local mirror anymore. The one local
// concept kept here is `BuildSource`: importer vocabulary, NOT canonical build
// state (a consumer must stay source-blind — RFC-0001 §8.1), so it is deliberately
// not part of the canonical model.

export type {
  Character,
  PassiveTreeAllocation,
  MasteryEffect,
  EquipmentItem,
  SkillSetup,
  LoadoutContext,
  ConfigEntry,
  AssumptionOrigin,
  Assumption,
  BuildState,
  Provenance,
  Metadata,
  DisplayCache,
  BuildSnapshot,
  BuildSnapshotInput,
} from "@exilelab/core";

export { createBuildSnapshot } from "@exilelab/core";

/** The external formats an importer can recognise. Consumers must stay source-blind. */
export type BuildSource = "native-json" | "pob-code";
