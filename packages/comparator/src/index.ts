// @exilelab/comparator — Comparator: diffs BuildSnapshots category-by-category
// (tree/gear/gems/config) for Comparative Optimization, and emits each
// meaningful difference as a candidate BuildMutation against the user's snapshot
// so downstream can engine-evaluate + preference-score it (RFC-0001;
// PRODUCT_PLAN "Comparative Optimization Engine"; UX_PRESENTATION §4.4).

// Diff surface.
export {
  diffSnapshots,
  isEmptyDiff,
  changeKey,
  type SnapshotDiff,
  type PassiveTreeDiff,
  type GearSlotDiff,
  type SkillSetupDiff,
  type ConfigDiff,
  type SlotStatus,
  type SetupStatus,
  type ConfigStatus,
  type Candidate,
} from "./diff.js";

// Multi-source comparison + consensus.
export {
  compareMany,
  type CompareSource,
  type SourceDiff,
  type ConsensusChange,
  type MultiCompareResult,
} from "./compare.js";

// Canonical model contract — re-exported straight from @exilelab/core (RFC-0001
// landed). Consumers of the diff output work with candidates and promote them.
export {
  createBuildSnapshot,
  createBuildMutation,
  promoteMutation,
  computeBuildStateIdentity,
  getPrimaryLoadout,
  type BuildSnapshot,
  type BuildState,
  type BuildMutation,
  type MutationOperation,
  type LoadoutContext,
  type EquipmentItem,
  type SkillSetup,
  type ConfigEntry,
  type Character,
  type Provenance,
} from "./model.js";
