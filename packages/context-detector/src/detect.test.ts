import { describe, expect, it } from 'vitest';

import { detectArchetype } from './detect.js';
import {
  dashLoopSnapshot,
  dotCasterSnapshot,
  esTankSnapshot,
  makeSnapshot,
  minionSnapshot,
  plainCasterSnapshot,
  twisterSnapshot,
  twisterWithDecoyFirst,
} from './test-fixtures.js';

describe('detectArchetype — Twister attack-as-movement', () => {
  const result = detectArchetype(twisterSnapshot());

  it('classifies the build as attack-as-movement', () => {
    expect(result.archetype).toBe('attack-as-movement');
    expect(result.tags).toContain('attack-as-movement');
  });

  it('suggests Attack Speed HIGH and Movement Speed LOW', () => {
    expect(result.axisHints['Attack Speed']).toBe('high');
    expect(result.axisHints['Movement Speed']).toBe('low');
    expect(result.suggestedPreset).toBe('Fast Mapping');
  });

  it('gives a non-empty rationale that mentions movement', () => {
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.rationale.toLowerCase()).toContain('movement');
    // rationale names the detected mechanic's skill
    expect(result.rationale).toContain('Twister');
  });
});

describe('detectArchetype — ES tank', () => {
  const result = detectArchetype(esTankSnapshot());

  it('classifies the build as an ES tank', () => {
    expect(result.archetype).toBe('es-tank');
    expect(result.tags).toContain('es-tank');
  });

  it('suggests a survivability-leaning preset with Survivability HIGH', () => {
    expect(result.suggestedPreset).toBe('Hardcore Survivability');
    expect(result.axisHints['Survivability']).toBe('high');
  });

  it('gives a non-empty rationale that mentions the ES / survivability mechanic', () => {
    expect(result.rationale.length).toBeGreaterThan(0);
    const lower = result.rationale.toLowerCase();
    expect(lower).toContain('energy shield');
    expect(lower).toContain('survivability');
  });
});

describe('detectArchetype — dash-loop mobility', () => {
  const result = detectArchetype(dashLoopSnapshot());

  it('classifies the build as dash-loop mobility', () => {
    expect(result.archetype).toBe('dash-loop-mobility');
    expect(result.tags).toContain('dash-loop');
  });

  it('gives a non-empty rationale that mentions the dash / movement mechanic', () => {
    expect(result.rationale.length).toBeGreaterThan(0);
    const lower = result.rationale.toLowerCase();
    expect(lower).toContain('movement');
    expect(result.rationale).toContain('Dash');
  });
});

describe('detectArchetype — plain caster', () => {
  const result = detectArchetype(plainCasterSnapshot());

  it('classifies the build as a hit-based caster (not a mobility/tank archetype)', () => {
    expect(result.archetype).toBe('hit-caster');
    expect(result.tags).toContain('spellcaster');
    expect(result.tags).not.toContain('attack-as-movement');
    expect(result.tags).not.toContain('es-tank');
  });

  it('suggests a Balanced preset emphasising Damage and Cast Speed', () => {
    expect(result.suggestedPreset).toBe('Balanced');
    expect(result.axisHints['Cast Speed']).toBe('high');
  });

  it('gives a non-empty rationale that mentions the spellcasting mechanic', () => {
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.rationale.toLowerCase()).toContain('spellcaster');
  });
});

describe('detectArchetype — damage delivery (hit vs DoT vs minion)', () => {
  it('detects minion damage delivery and spirit pressure', () => {
    const result = detectArchetype(minionSnapshot());
    expect(result.archetype).toBe('minion-commander');
    expect(result.tags).toContain('minion-damage');
    // spirit-reserving minions register resource pressure as a secondary tag
    expect(result.tags).toContain('spirit-pressure');
    expect(result.rationale.toLowerCase()).toContain('minion');
  });

  it('detects damage-over-time delivery', () => {
    const result = detectArchetype(dotCasterSnapshot());
    expect(result.archetype).toBe('damage-over-time');
    expect(result.tags).toContain('dot-damage');
    expect(result.rationale.toLowerCase()).toContain('over time');
  });

  it('detects hit delivery for a plain caster', () => {
    const result = detectArchetype(plainCasterSnapshot());
    expect(result.tags).toContain('hit-damage');
  });
});

describe('detectArchetype — mana vs spirit resource pressure', () => {
  it('flags mana pressure for a mana-spending caster', () => {
    const result = detectArchetype(plainCasterSnapshot());
    expect(result.tags).toContain('mana-pressure');
    expect(result.tags).not.toContain('spirit-pressure');
  });

  it('flags spirit pressure for a minion build', () => {
    const result = detectArchetype(minionSnapshot());
    expect(result.tags).toContain('spirit-pressure');
    expect(result.tags).not.toContain('mana-pressure');
  });
});

describe('detectArchetype — degenerate input', () => {
  it('falls back to a balanced generalist when there are no skills', () => {
    const result = detectArchetype(makeSnapshot({ skills: [] }));
    expect(result.archetype).toBe('generalist');
    expect(result.suggestedPreset).toBe('Balanced');
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.matchedRules).toContain('unclassified');
  });

  it('respects the primary loadout, not merely the first, when detecting', () => {
    // A non-primary decoy loadout sits at the front; detection must ignore it and
    // classify off the (second) PRIMARY Loadout Context (RFC-0001 AD-5).
    const result = detectArchetype(twisterWithDecoyFirst());
    expect(result.archetype).toBe('attack-as-movement');
  });

  it('is deterministic — identical input yields identical output', () => {
    const a = detectArchetype(twisterSnapshot());
    const b = detectArchetype(twisterSnapshot());
    expect(a).toEqual(b);
  });
});
