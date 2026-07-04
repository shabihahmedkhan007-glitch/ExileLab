// runDoctor — assemble the goal-aware Doctor Report from the eight rules plus
// the DOC-9 composite verdict.
//
// Contract:
//   runDoctor(engineOutputs, goal, tier) → DoctorReport
// Thresholds are goal-parameterized (thresholds.ts), so the *same* engine
// outputs yield different findings, severities, and grades under different
// goals. The report is severity-sorted, every finding carries its evidence
// numbers, and DOC-9 is always consistent with its component findings.
import { RULES } from './rules.js';
import { gradeFromSeverities, SEVERITY_RANK, worstSeverity } from './severity.js';
import { computeThresholds } from './thresholds.js';
import type {
  CategoryGrades,
  ContentTier,
  DoctorReport,
  EngineOutputs,
  Finding,
  Goal,
  Severity,
} from './types.js';

/** Bump when a rule's behavior, thresholds, or evidence shape changes. */
export const RULEBOOK_VERSION = '1.0.0';

const DOC_ORDER: Record<string, number> = {
  'DOC-1': 1,
  'DOC-2': 2,
  'DOC-3': 3,
  'DOC-4': 4,
  'DOC-5': 5,
  'DOC-6': 6,
  'DOC-7': 7,
  'DOC-8': 8,
  'DOC-9': 9,
};

/** Severity-sort: worst first; stable tiebreak by DOC number ascending. */
function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return (DOC_ORDER[a.id] ?? 99) - (DOC_ORDER[b.id] ?? 99);
  });
}

/** DOC ids that gate content readiness (the defensive + offensive core). */
const READINESS_RULE_IDS = new Set(['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-5', 'DOC-6', 'DOC-7']);

/**
 * Compute the highest tier (≤ target) at which no readiness-gating rule would
 * fire a major or critical finding. Deterministic: it re-runs the rules under
 * thresholds recomputed for each candidate tier.
 */
function computeReadyTier(o: EngineOutputs, goal: Goal, targetTier: ContentTier): number {
  for (let t = targetTier; t >= 1; t--) {
    const th = computeThresholds(goal, t);
    let blocked = false;
    for (const rule of RULES) {
      if (!READINESS_RULE_IDS.has(rule.id)) continue;
      const f = rule.check(o, th);
      if (f && (f.severity === 'major' || f.severity === 'critical')) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return t;
  }
  return 0; // not comfortably ready even at tier 1
}

/**
 * DOC-9 — content-readiness verdict. Its severity mirrors the worst component
 * finding (so it is always consistent with the rest of the report), and it
 * reports the realistic "wall" tier alongside the limiting findings.
 */
function buildVerdict(
  o: EngineOutputs,
  goal: Goal,
  tier: ContentTier,
  components: Finding[],
): Finding {
  const worst = worstSeverity(components.map((f) => f.severity));
  const readyTier = worst === 'pass' ? tier : computeReadyTier(o, goal, tier);
  const limiters = components
    .filter((f) => f.severity === 'major' || f.severity === 'critical')
    .map((f) => f.id);

  const evidence: Record<string, number | string> = {
    targetTier: tier,
    readyTier,
    worstSeverity: worst,
    limitingFindings: limiters.join(', ') || 'none',
  };

  if (worst === 'pass') {
    return {
      id: 'DOC-9',
      category: 'Overall',
      severity: 'pass',
      statement: `Ready for T${tier}: every core system meets your ${goal} targets. Push the content with confidence.`,
      evidence,
      fixTemplates: [],
    };
  }

  const wallMsg =
    readyTier > 0
      ? `You're solid up to about T${readyTier}; T${tier} is a stretch right now`
      : `T${tier} is a reach right now`;
  return {
    id: 'DOC-9',
    category: 'Overall',
    severity: worst,
    statement: `${wallMsg} — the limiters are ${limiters.join(', ')}. Clear those and your ceiling rises fast.`,
    evidence,
    fixTemplates: [
      {
        id: 'DOC-9-address-limiters',
        label: 'Address the flagged limiters first',
        hint: `Start with the ${worst}-severity findings above — they gate the tier.`,
      },
    ],
  };
}

function gradeFor(category: 'Offense' | 'Defense' | 'Sustain' | 'QoL', findings: Finding[]) {
  const severities: Severity[] = findings.filter((f) => f.category === category).map((f) => f.severity);
  return gradeFromSeverities(severities);
}

/**
 * Run the full goal-aware Doctor over one set of engine outputs.
 *
 * @param engineOutputs engine-computed metrics (never mutates a BuildSnapshot)
 * @param goal          the declared Goal Preset driving every threshold
 * @param tier          target content tier (endgame Waystone tier; 0 = campaign)
 */
export function runDoctor(
  engineOutputs: EngineOutputs,
  goal: Goal,
  tier: ContentTier,
): DoctorReport {
  const thresholds = computeThresholds(goal, tier);

  const components: Finding[] = [];
  for (const rule of RULES) {
    const finding = rule.check(engineOutputs, thresholds);
    if (finding) components.push(finding);
  }

  const verdict = buildVerdict(engineOutputs, goal, tier, components);
  const allFindings = sortFindings([...components, verdict]);

  const grades: CategoryGrades = {
    Offense: gradeFor('Offense', components),
    Defense: gradeFor('Defense', components),
    Sustain: gradeFor('Sustain', components),
    QoL: gradeFor('QoL', components),
  };

  return {
    rulebookVersion: RULEBOOK_VERSION,
    goal,
    tier,
    findings: allFindings,
    grades,
    verdict,
  };
}
