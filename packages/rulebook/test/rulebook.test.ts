import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runDoctor, RULEBOOK_VERSION } from '../src/runDoctor.js';
import { computeThresholds } from '../src/thresholds.js';
import { SEVERITY_RANK } from '../src/severity.js';
import type { DoctorReport, Finding, Goal, Severity } from '../src/types.js';
import { BROKEN_BUILD, HEALTHY_BUILD, MID_BUILD } from './fixtures.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadGolden(goal: Goal): DoctorReport {
  return JSON.parse(readFileSync(join(HERE, 'golden', `${goal}.json`), 'utf8')) as DoctorReport;
}

function findingById(report: DoctorReport, id: string): Finding {
  const f = report.findings.find((x) => x.id === id);
  if (!f) throw new Error(`missing finding ${id}`);
  return f;
}

const ALL_DOC_IDS = ['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-5', 'DOC-6', 'DOC-7', 'DOC-8', 'DOC-9'];

describe('goal-parameterized golden files', () => {
  it('reproduces the frozen fast-mapping report byte-for-byte', () => {
    const report = runDoctor(MID_BUILD, 'fast-mapping', 10);
    expect(report).toEqual(loadGolden('fast-mapping'));
  });

  it('reproduces the frozen hardcore-survivability report byte-for-byte', () => {
    const report = runDoctor(MID_BUILD, 'hardcore-survivability', 10);
    expect(report).toEqual(loadGolden('hardcore-survivability'));
  });

  it('THE pivot case: the SAME EHP passes Fast Mapping but flags critical under Hardcore Survivability', () => {
    const fast = runDoctor(MID_BUILD, 'fast-mapping', 10);
    const hardcore = runDoctor(MID_BUILD, 'hardcore-survivability', 10);

    // Identical engine input, identical EHP number in evidence...
    const fastDoc3 = findingById(fast, 'DOC-3');
    const hardcoreDoc3 = findingById(hardcore, 'DOC-3');
    expect(fastDoc3.evidence.totalEHP).toBe(40_000);
    expect(hardcoreDoc3.evidence.totalEHP).toBe(40_000);

    // ...but opposite verdicts, driven purely by the goal-parameterized floor.
    expect(fastDoc3.severity).toBe('pass');
    expect(hardcoreDoc3.severity).toBe('critical');
    expect(fastDoc3.evidence.ehpFloor).toBe(33_600);
    expect(hardcoreDoc3.evidence.ehpFloor).toBe(67_200);
  });

  it('grades the same build differently per goal (Defense A vs F)', () => {
    const fast = runDoctor(MID_BUILD, 'fast-mapping', 10);
    const hardcore = runDoctor(MID_BUILD, 'hardcore-survivability', 10);
    expect(fast.grades.Defense).toBe('A');
    expect(hardcore.grades.Defense).toBe('F');
    // Offense is unaffected — the build has plenty of DPS for either goal.
    expect(fast.grades.Offense).toBe('A');
    expect(hardcore.grades.Offense).toBe('A');
  });
});

describe('report shape and invariants', () => {
  it('emits exactly the nine launch rules, DOC-1..DOC-9', () => {
    const report = runDoctor(MID_BUILD, 'balanced', 10);
    expect(report.findings.map((f) => f.id).sort()).toEqual([...ALL_DOC_IDS].sort());
    expect(report.findings).toHaveLength(9);
  });

  it('is severity-sorted (worst first)', () => {
    const report = runDoctor(BROKEN_BUILD, 'hardcore-survivability', 12);
    for (let i = 1; i < report.findings.length; i++) {
      const prev = report.findings[i - 1]!.severity;
      const cur = report.findings[i]!.severity;
      expect(SEVERITY_RANK[prev]).toBeGreaterThanOrEqual(SEVERITY_RANK[cur]);
    }
  });

  it('carries the exact numbers it used in every non-pass finding evidence', () => {
    const report = runDoctor(BROKEN_BUILD, 'balanced', 10);
    const doc2 = findingById(report, 'DOC-2');
    expect(doc2.evidence.chaosResist).toBe(-60);
    const doc3 = findingById(report, 'DOC-3');
    expect(doc3.evidence.totalEHP).toBe(9_000);
    // Evidence must be self-consistent with the finding's own threshold context.
    expect(doc3.evidence.ehpFloor).toBe(computeThresholds('balanced', 10).ehpFloor);
    const doc8 = findingById(report, 'DOC-8');
    expect(doc8.evidence.skill).toBe('Firestorm');
  });

  it('stamps the rulebook version', () => {
    const report = runDoctor(MID_BUILD, 'balanced', 10);
    expect(report.rulebookVersion).toBe(RULEBOOK_VERSION);
  });
});

describe('DOC-9 content-readiness verdict consistency', () => {
  const goals: Goal[] = ['fast-mapping', 'balanced', 'hardcore-survivability', 'boss-farming'];
  const tiers = [3, 8, 12, 16];

  it('verdict severity always equals the worst component severity', () => {
    for (const goal of goals) {
      for (const tier of tiers) {
        for (const build of [MID_BUILD, BROKEN_BUILD, HEALTHY_BUILD]) {
          const report = runDoctor(build, goal, tier);
          const components = report.findings.filter((f) => f.id !== 'DOC-9');
          const worst = components.reduce<Severity>(
            (acc, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc),
            'pass',
          );
          expect(report.verdict.severity).toBe(worst);
        }
      }
    }
  });

  it('ready tier never exceeds the target, and equals the target only when nothing is flagged', () => {
    for (const goal of goals) {
      for (const tier of tiers) {
        for (const build of [MID_BUILD, BROKEN_BUILD, HEALTHY_BUILD]) {
          const report = runDoctor(build, goal, tier);
          const readyTier = report.verdict.evidence.readyTier as number;
          expect(readyTier).toBeLessThanOrEqual(tier);
          if (report.verdict.severity === 'pass') {
            expect(readyTier).toBe(tier);
          }
        }
      }
    }
  });

  it('lists every major/critical component as a DOC-9 limiter', () => {
    const report = runDoctor(BROKEN_BUILD, 'hardcore-survivability', 14);
    const expectedLimiters = report.findings
      .filter((f) => f.id !== 'DOC-9' && (f.severity === 'major' || f.severity === 'critical'))
      .map((f) => f.id);
    expect(report.verdict.evidence.limitingFindings).toBe(expectedLimiters.join(', '));
  });
});

describe('broken and healthy builds', () => {
  it('flags the broken build with multiple criticals and failing defense grade', () => {
    const report = runDoctor(BROKEN_BUILD, 'balanced', 10);
    const criticals = report.findings.filter((f) => f.severity === 'critical');
    expect(criticals.length).toBeGreaterThanOrEqual(2);
    expect(report.grades.Defense).toBe('F');
    // DOC-2 chaos res, DOC-6 negative sustain, DOC-8 unusable skill all bite.
    expect(findingById(report, 'DOC-6').severity).toBe('critical');
  });

  it('passes a healthy build cleanly under a balanced goal (all A grades, ready verdict)', () => {
    const report = runDoctor(HEALTHY_BUILD, 'balanced', 12);
    expect(report.findings.every((f) => f.severity === 'pass')).toBe(true);
    expect(report.grades).toEqual({ Offense: 'A', Defense: 'A', Sustain: 'A', QoL: 'A' });
    expect(report.verdict.severity).toBe('pass');
    expect(report.verdict.evidence.readyTier).toBe(12);
  });
});

describe('coach-not-judge tone (UX_PRESENTATION §9)', () => {
  const BANNED = ['bad', 'terrible', 'awful', 'wasted', 'sucks', 'stupid', 'garbage', 'trash', 'useless'];
  it('never shames the build in any finding statement, across goals and builds', () => {
    for (const goal of ['fast-mapping', 'hardcore-survivability', 'balanced'] as Goal[]) {
      for (const build of [MID_BUILD, BROKEN_BUILD, HEALTHY_BUILD]) {
        for (const f of runDoctor(build, goal, 12).findings) {
          const lower = f.statement.toLowerCase();
          for (const word of BANNED) {
            expect(lower.includes(word), `"${word}" in: ${f.statement}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('threshold determinism', () => {
  it('computeThresholds is a pure function of (goal, tier)', () => {
    expect(computeThresholds('hardcore-survivability', 10)).toEqual(
      computeThresholds('hardcore-survivability', 10),
    );
    // Hardcore floors strictly exceed fast-mapping floors at the same tier.
    expect(computeThresholds('hardcore-survivability', 10).ehpFloor).toBeGreaterThan(
      computeThresholds('fast-mapping', 10).ehpFloor,
    );
  });
});
