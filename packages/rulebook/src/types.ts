// @exilelab/rulebook — public types for the goal-aware Character Doctor.
//
// The rulebook consumes engine outputs (the numeric surface of a Calculation
// Result, keyed elsewhere by BuildSnapshot id × engine version) and produces a
// Doctor Report: a severity-sorted, goal-aware diagnosis with deterministic
// evidence. It never mutates a BuildSnapshot, never embeds calculated values in
// one, and never calls out to any external service — all math here is plain,
// deterministic TypeScript (PRINCIPLES: deterministic systems over AI).

/** The nine launch diagnoses from PRODUCT_PRD §4.2 (DOC-1 … DOC-9). */
export type DocId =
  | 'DOC-1'
  | 'DOC-2'
  | 'DOC-3'
  | 'DOC-4'
  | 'DOC-5'
  | 'DOC-6'
  | 'DOC-7'
  | 'DOC-8'
  | 'DOC-9';

/** Finding severities, rendered as the ✅/🟡/🟠/🔴 chips of UX_PRESENTATION §4.3. */
export type Severity = 'pass' | 'minor' | 'major' | 'critical';

/** Report card categories. `Overall` is reserved for the DOC-9 composite verdict. */
export type Category = 'Offense' | 'Defense' | 'Sustain' | 'QoL' | 'Overall';

/** Letter grade per category, graded against the *active goal* (UX §4.3). */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * A declared Goal Preset (GLOSSARY: Goal Preset). Thresholds are parameterized
 * by this value — hardcore-survivability tightens floors, speed-clear relaxes
 * them (PRODUCT_PLAN Phase 2 item 3).
 */
export type Goal =
  | 'fast-mapping'
  | 'speed-clearing'
  | 'boss-farming'
  | 'party-carry'
  | 'tanky'
  | 'hardcore-survivability'
  | 'budget-farming'
  | 'smooth-gameplay'
  | 'maximum-dps'
  | 'balanced';

/** Map-tier (endgame Waystone tier). Campaign content maps to tier 0. */
export type ContentTier = number;

/** One elemental (or chaos) resistance: current total vs the build's cap. */
export interface ResistState {
  /** Uncapped resistance total, in percent (may exceed `max`). */
  total: number;
  /** The build's resistance cap, in percent (default 75). */
  max: number;
}

/**
 * The numeric surface the Doctor reads. These are engine-computed values (never
 * authored, never embedded in a snapshot). Field names mirror the PoB2 stat
 * surface referenced in PRODUCT_PRD §4.2.
 */
export interface EngineOutputs {
  /** `FullDPS` — combined damage-per-second across the build's skills. */
  fullDps: number;
  /** `TotalEHP` — effective hit points (CalcDefence.lua:3341). */
  totalEHP: number;
  /** `{Type}MaximumHitTaken` — largest survivable hit per type (CalcDefence.lua:3781). */
  maximumHitTaken: {
    physical: number;
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };
  /** `*Resist` / `*ResistOverCap` — elemental and chaos resistances. */
  resists: {
    fire: ResistState;
    cold: ResistState;
    lightning: ResistState;
    chaos: ResistState;
  };
  /** Ailment/stun avoidance, in percent (100 = immune). */
  ailmentProtection: {
    stunAvoidance: number;
    freezeAvoidance: number;
    shockAvoidance: number;
    igniteAvoidance: number;
  };
  /** Defensive pools and mitigation layers. */
  defenses: {
    life: number;
    energyShield: number;
    armour: number;
    evasion: number;
    /** Attack/hit block chance, in percent. */
    blockChance: number;
    /** Spell suppression chance, in percent. */
    spellSuppression: number;
    /** Whether the ES pool has recharge protection (recoup / uninterruptible recharge). */
    energyShieldRechargeProtected: boolean;
  };
  /** Sustain surface: `NetLifeRegen`, `TotalBuildDegen`, leech, ES recharge. */
  sustain: {
    netLifeRegen: number;
    totalBuildDegen: number;
    lifeLeechRatePerSecond: number;
    energyShieldRechargeRate: number;
  };
  /** Socketed active skills with their per-use `LifeCost` / `ManaCost`. */
  skills: Array<{ name: string; manaCost: number; lifeCost: number }>;
  /** Unreserved mana available to pay skill costs. */
  unreservedMana: number;
  /** Unreserved life available to pay skill costs. */
  unreservedLife: number;
  /** Engine `WarningList` entries (Calcs.lua:412-448). */
  warnings: string[];
}

/**
 * Goal- and tier-derived numeric floors that rule checks compare against.
 * `goal` and `tier` ride along so a rule's `check(engineOutputs, thresholds)`
 * signature stays two-argument while still being fully goal-aware.
 */
export interface DoctorThresholds {
  goal: Goal;
  tier: ContentTier;
  /** Required minimum for each elemental resist (the cap, in percent). */
  resistFloor: number;
  /** Overcap beyond this many points is flagged as recoverable waste. */
  resistOvercapWaste: number;
  /** Minimum acceptable chaos resistance, in percent (goal-dependent). */
  chaosResFloor: number;
  /** Representative largest incoming hit at this tier, before the goal buffer. */
  expectedTierHit: number;
  /** Required `TotalEHP` for this goal + tier. */
  ehpFloor: number;
  /** Multiplier applied to `expectedTierHit` to get the required MaximumHitTaken. */
  maxHitFloorMultiplier: number;
  /** Lower bound of the acceptable `FullDPS` band for this goal + tier. */
  expectedDps: number;
  /** Required stun avoidance, in percent. */
  stunAvoidanceFloor: number;
  /** Required freeze/shock/ignite avoidance, in percent. */
  ailmentAvoidanceFloor: number;
  /** Required net life regen, life/sec. */
  netRegenFloor: number;
  /** Highest severity DOC-5 (defense layering) may reach under this goal. */
  layeringCap: Severity;
}

/** A concrete, actionable fix suggestion attached to a finding (coach-voice). */
export interface FixTemplate {
  id: string;
  label: string;
  hint: string;
}

/**
 * One diagnosis result. `evidence` carries the *exact* numbers the check used,
 * so the UI can render them inline (UX §4.3) and the LLM narrator never invents
 * a value that isn't here.
 */
export interface Finding {
  id: DocId;
  category: Category;
  severity: Severity;
  /** Coach-not-judge statement (UX §9): leads with the gain, never shames. */
  statement: string;
  evidence: Record<string, number | string | boolean>;
  fixTemplates: FixTemplate[];
}

/** A single DOC-1 … DOC-8 rule. DOC-9 is the composite verdict (see runDoctor). */
export interface Rule {
  id: DocId;
  category: Category;
  /**
   * Evaluate the rule. Returns a Finding (possibly `severity: 'pass'`), or
   * `null` when the rule does not apply to this build at all.
   */
  check(engineOutputs: EngineOutputs, thresholds: DoctorThresholds): Finding | null;
}

/** Per-category letter grades, all graded against the active goal. */
export interface CategoryGrades {
  Offense: Grade;
  Defense: Grade;
  Sustain: Grade;
  QoL: Grade;
}

/** The Doctor Report (GLOSSARY: Doctor Report). Immutable, deterministic output. */
export interface DoctorReport {
  rulebookVersion: string;
  goal: Goal;
  tier: ContentTier;
  /** All findings, severity-sorted (critical → pass), stable by DOC id within a tier. */
  findings: Finding[];
  grades: CategoryGrades;
  /** The DOC-9 content-readiness verdict (also present in `findings`). */
  verdict: Finding;
}
