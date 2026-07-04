// Deterministic severity helpers shared by every rule.
import type { Grade, Severity } from './types.js';

/** Total order over severities; higher = worse. */
export const SEVERITY_RANK: Record<Severity, number> = {
  pass: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

/** The worst (highest-rank) severity in a list; `'pass'` if empty. */
export function worstSeverity(severities: readonly Severity[]): Severity {
  let worst: Severity = 'pass';
  for (const s of severities) {
    if (SEVERITY_RANK[s] > SEVERITY_RANK[worst]) worst = s;
  }
  return worst;
}

/** Clamp a severity so it never exceeds `cap` (used by goal-relaxed rules). */
export function capSeverity(severity: Severity, cap: Severity): Severity {
  return SEVERITY_RANK[severity] > SEVERITY_RANK[cap] ? cap : severity;
}

/**
 * Map an achieved/required ratio to a severity. `ratio >= 1` passes; below that
 * the shortfall widens the severity. This is the single shared curve so every
 * "value vs floor" rule grades consistently.
 */
export function ratioSeverity(ratio: number): Severity {
  if (ratio >= 1) return 'pass';
  if (ratio >= 0.85) return 'minor';
  if (ratio >= 0.7) return 'major';
  return 'critical';
}

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F'];

/** Drop a letter grade by one step (A→B…D→F, F stays F). */
export function downgrade(grade: Grade): Grade {
  const i = GRADE_ORDER.indexOf(grade);
  return GRADE_ORDER[Math.min(i + 1, GRADE_ORDER.length - 1)]!;
}

/**
 * Derive a category letter grade from its findings' severities. The worst
 * severity sets the base grade; a second (or later) non-pass finding drops it
 * one further letter. Deterministic and goal-aware by construction, because the
 * severities were computed against goal-parameterized thresholds.
 */
export function gradeFromSeverities(severities: readonly Severity[]): Grade {
  const worst = worstSeverity(severities);
  const base: Grade =
    worst === 'critical' ? 'F' : worst === 'major' ? 'C' : worst === 'minor' ? 'B' : 'A';
  const nonPass = severities.filter((s) => s !== 'pass').length;
  return nonPass >= 2 ? downgrade(base) : base;
}
