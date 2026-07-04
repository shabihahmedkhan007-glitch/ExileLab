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
} from './diff.js';

// Multi-source comparison + consensus.
export {
  compareMany,
  type CompareSource,
  type SourceDiff,
  type ConsensusChange,
  type MultiCompareResult,
} from './compare.js';

// Canonical model contract this package depends on (local mirror of the future
// @exilelab/core types — see model.ts). Re-exported so consumers of the diff
// output can work with candidates and promote them.
export {
  promoteMutation,
  computeCanonicalIdentity,
  getPrimaryLoadout,
  makeSnapshot,
  MutationBaseMismatchError,
  type BuildSnapshot,
  type BuildMutation,
  type MutationOp,
  type LoadoutContext,
  type GearItem,
  type SkillSetup,
  type ConfigValue,
  type Provenance,
} from './model.js';
