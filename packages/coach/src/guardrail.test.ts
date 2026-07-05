import { describe, it, expect } from 'vitest';
import { validateNarration, deriveAllowlist } from './guardrail.js';
import type { DoctorNarrationInput, TuneNarrationInput } from './types.js';

const DOCTOR: DoctorNarrationInput = {
  kind: 'doctor',
  goalPresetId: 'fast-mapping',
  archetype: 'attack-as-movement',
  rationale: 'This Twister Huntress moves by attacking, so attack speed is mobility.',
  findings: [
    {
      id: 'DOC-2',
      severity: 'critical',
      statement: 'Chaos res is -34%, versus a Xesht slam of ~11k.',
      evidence: [
        { metric: 'chaosResist', value: -34 },
        { metric: 'chaosMaximumHitTaken', value: 4120, threshold: 11000 },
      ],
      fixSummaries: ['Add chaos res on rings and amulet to reach the cap.'],
    },
    {
      id: 'DOC-3',
      severity: 'major',
      statement: 'Effective HP is 42000, a bit thin for tier 10.',
      evidence: [{ metric: 'totalEHP', value: 42000, threshold: 60000 }],
      fixSummaries: ['Recover 4 passive points near the life wheel.'],
    },
  ],
};

const TUNE: TuneNarrationInput = {
  kind: 'tune',
  goalPresetId: 'fast-mapping',
  candidates: [
    {
      description: 'Re-path: drop 3 nodes and take the movement cluster',
      weightedScoreDelta: 9.2,
      perAxis: [
        { axis: 'Movement Speed', delta: 6.8 },
        { axis: 'Damage', delta: 2.4 },
      ],
    },
    {
      description: 'Swap boots for +35% movement speed',
      weightedScoreDelta: 6.8,
      perAxis: [{ axis: 'Movement Speed', delta: 6.8 }],
    },
  ],
};

describe('validateNarration — numbers', () => {
  it('accepts a faithful narration that cites only in-input numbers', () => {
    const text =
      'Your chaos res of -34% is the real killer here; against a 4,120 hit it leaves you one-shot. Fix that first and you will die far less.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(true);
    expect(r.offendingNumbers).toEqual([]);
  });

  it('is round-trip tolerant for thousands separators, percents, and rounding', () => {
    // 4120 → "4,120"; -34 → "34%"; 42000 → "42k"; 60000 threshold → "60k".
    const text = 'Chaos max hit is 4,120 at 34% res, with 42k EHP against a 60k bar.';
    expect(validateNarration(text, DOCTOR).ok).toBe(true);
  });

  it('REJECTS an invented number (roughly 5000 when the evidence is 4120)', () => {
    const text = 'Your chaos wall is roughly 5000, which is fine for now.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(false);
    expect(r.offendingNumbers).toContain('5000');
  });

  it('accepts signed candidate deltas cited by magnitude', () => {
    const text =
      'The top change is worth +9.2 to your score, and the boot swap adds another 6.8.';
    expect(validateNarration(text, TUNE).ok).toBe(true);
  });

  it('REJECTS a tune narration that invents an absolute score', () => {
    const text = 'This lifts you from 71 to 84 overall, a big jump.';
    const r = validateNarration(text, TUNE);
    expect(r.ok).toBe(false);
    expect(r.offendingNumbers).toEqual(expect.arrayContaining(['71', '84']));
  });
});

describe('validateNarration — names', () => {
  it('does not flag sentence-openers or single capitalized words', () => {
    const text =
      'Your build is steady. Under this goal the Twister carries you, so keep pushing.';
    expect(validateNarration(text, DOCTOR).ok).toBe(true);
  });

  it('accepts multi-word names present in the input (axis names)', () => {
    const text = 'Most of the gain is Movement Speed, exactly what you asked for.';
    expect(validateNarration(text, TUNE).ok).toBe(true);
  });

  it('REJECTS an invented multi-word proper name', () => {
    const text = 'Take Whirling Barrier and you will feel much smoother.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(false);
    expect(r.offendingNames).toContain('whirling barrier');
  });

  it('allows the preset display form derived from a hyphenated id', () => {
    const text = 'For Fast Mapping this is the right call.';
    expect(validateNarration(text, DOCTOR).ok).toBe(true);
  });
});

describe('validateNarration — audited bypass regressions', () => {
  // Every string below was a PROVEN bypass in the trust-rules audit of the
  // first guardrail implementation. None may ever pass again.

  it('REJECTS a single-word invented item name mid-sentence (Mageblood)', () => {
    const text = 'Slot in Mageblood and you will feel much steadier here.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(false);
    expect(r.offendingNames).toContain('mageblood');
  });

  it('REJECTS an article-prefixed invented name (The Doctor → single "Doctor")', () => {
    const text = 'Chase down The Doctor for this build and you are set.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(false);
    expect(r.offendingNames).toContain('doctor');
  });

  it('still allows mid-sentence single words that the input authorizes', () => {
    // "Twister" appears in the rationale; "Huntress" in the archetype text.
    const text = 'Lean on the Twister here and let the Huntress do her thing.';
    expect(validateNarration(text, DOCTOR).ok).toBe(true);
  });

  it('REJECTS a spelled-out invented magnitude (five thousand vs evidence 4120)', () => {
    const text = 'Your effective HP sits at roughly five thousand, comfortable for this content.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(false);
    expect(r.offendingNumbers).toContain('5000');
  });

  it('accepts spelled-out numbers that match authorized values', () => {
    // 42000 is authorized evidence; "forty-two thousand" parses to it.
    const text = 'Sitting at forty-two thousand effective HP, you have some room.';
    expect(validateNarration(text, DOCTOR).ok).toBe(true);
  });

  it('ignores tiny prose counts (one of, top three) as ordinary language', () => {
    const text = 'This is one of your best options; fix the top three findings first.';
    expect(validateNarration(text, DOCTOR).ok).toBe(true);
  });

  it('REJECTS fullwidth-digit numbers via NFKC normalization (５０００)', () => {
    const text = 'Your effective HP sits at ５０００ which should hold.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(false);
    expect(r.offendingNumbers).toContain('5000');
  });

  it('REJECTS non-ASCII digits outright (Arabic-Indic ٥٠٠٠)', () => {
    const text = 'Your effective HP sits at ٥٠٠٠ here.';
    const r = validateNarration(text, DOCTOR);
    expect(r.ok).toBe(false);
    expect(r.offendingNumbers.length).toBeGreaterThan(0);
  });
});

describe('createBuildCoach — degradation on injected-dependency failure', () => {
  it('a throwing async cache degrades to null instead of propagating', async () => {
    const { createBuildCoach } = await import('./coach.js');
    const { MockNarrationProvider } = await import('./providers/mock.js');
    const coach = createBuildCoach({
      enabled: true,
      provider: new MockNarrationProvider({ mode: 'faithful' }),
      cache: {
        get: async () => {
          throw new Error('redis down');
        },
        set: async () => {
          throw new Error('redis down');
        },
      },
    });
    await expect(coach.narrateDoctor(DOCTOR)).resolves.toBeNull();
  });
});

describe('deriveAllowlist', () => {
  it('captures direct evidence values and their thresholds', () => {
    const { numbers } = deriveAllowlist(DOCTOR);
    expect(numbers).toContain(4120);
    expect(numbers).toContain(11000);
    expect(numbers).toContain(60000);
    expect(numbers).toContain(34); // magnitude of -34
  });

  it('captures axis names as allowed multi-word names', () => {
    const { names } = deriveAllowlist(TUNE);
    expect(names.has('movement speed')).toBe(true);
  });
});
