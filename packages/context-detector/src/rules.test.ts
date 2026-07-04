import { describe, expect, it } from 'vitest';

import { ARCHETYPE_RULES, FALLBACK_RULE } from './rules.js';
import { extractFeatures } from './features.js';
import {
  dashLoopSnapshot,
  esTankSnapshot,
  plainCasterSnapshot,
  twisterSnapshot,
} from './test-fixtures.js';

function ruleById(id: string) {
  const rule = ARCHETYPE_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`no rule ${id}`);
  return rule;
}

describe('rules table integrity', () => {
  it('has unique rule ids', () => {
    const ids = ARCHETYPE_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule and the fallback produce a non-empty rationale on any features', () => {
    const features = extractFeatures(plainCasterSnapshot());
    for (const rule of [...ARCHETYPE_RULES, FALLBACK_RULE]) {
      expect(rule.rationale(features).length).toBeGreaterThan(0);
    }
  });

  it('every rule carries at least one tag', () => {
    for (const rule of ARCHETYPE_RULES) {
      expect(rule.tags.length).toBeGreaterThan(0);
    }
  });
});

describe('per-archetype rule matching (rules are data, tested in isolation)', () => {
  it('attack-as-movement rule matches only the Twister features', () => {
    const rule = ruleById('attack-as-movement');
    expect(rule.matches(extractFeatures(twisterSnapshot()))).toBe(true);
    expect(rule.matches(extractFeatures(plainCasterSnapshot()))).toBe(false);
    expect(rule.matches(extractFeatures(esTankSnapshot()))).toBe(false);
  });

  it('es-tank rule matches only the ES-dominant features', () => {
    const rule = ruleById('es-tank');
    expect(rule.matches(extractFeatures(esTankSnapshot()))).toBe(true);
    expect(rule.matches(extractFeatures(twisterSnapshot()))).toBe(false);
    // a plain caster with a little ES is NOT below-floor dominant
    expect(rule.matches(extractFeatures(plainCasterSnapshot()))).toBe(false);
  });

  it('dash-loop rule matches a travel-skill loop but not attack-as-movement', () => {
    const rule = ruleById('dash-loop-mobility');
    expect(rule.matches(extractFeatures(dashLoopSnapshot()))).toBe(true);
    // Twister carries movement via its attack, so it is NOT a dash loop
    expect(rule.matches(extractFeatures(twisterSnapshot()))).toBe(false);
  });

  it('hit-caster rule matches the plain caster', () => {
    const rule = ruleById('hit-caster');
    expect(rule.matches(extractFeatures(plainCasterSnapshot()))).toBe(true);
  });
});

describe('feature extraction', () => {
  it('marks attack-as-movement and suppresses dash-loop for Twister', () => {
    const f = extractFeatures(twisterSnapshot());
    expect(f.attackAsMovement).toBe(true);
    expect(f.dashLoopMobility).toBe(false);
    expect(f.primaryDelivery).toBe('hit');
  });

  it('marks ES dominance only above the tank floor', () => {
    expect(extractFeatures(esTankSnapshot()).esDominant).toBe(true);
    expect(extractFeatures(plainCasterSnapshot()).esDominant).toBe(false);
  });
});
