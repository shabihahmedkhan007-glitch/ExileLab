// @exilelab/rulebook — the goal-aware Character Doctor rulebook.
//
// Deterministic, versioned diagnostics (DOC-1 … DOC-9) that read engine outputs
// and produce a Doctor Report: severity-sorted findings with exact evidence,
// per-category grades (Offense/Defense/Sustain/QoL) graded against the active
// goal, and a DOC-9 content-readiness verdict. No network, no LLM, pure math.
export type {
  Category,
  CategoryGrades,
  ContentTier,
  DocId,
  DoctorReport,
  DoctorThresholds,
  EngineOutputs,
  Finding,
  FixTemplate,
  Goal,
  Grade,
  ResistState,
  Rule,
  Severity,
} from './types.js';

export { runDoctor, RULEBOOK_VERSION } from './runDoctor.js';
export { RULES } from './rules.js';
export { computeThresholds, GOAL_PROFILES, tierBaseline, DEFAULT_RESIST_CAP } from './thresholds.js';
export {
  SEVERITY_RANK,
  worstSeverity,
  capSeverity,
  ratioSeverity,
  gradeFromSeverities,
} from './severity.js';
