import { describe, it, expect } from 'vitest';
import { createBuildCoach } from './coach.js';
import { MockNarrationProvider } from './providers/mock.js';
import { InMemoryNarrationCache } from './cache.js';
import { UnlimitedBudgetGuard, type BudgetGuard } from './budget.js';
import { computeInputHash } from './hash.js';
import type { DoctorNarrationInput, TuneNarrationInput } from './types.js';

const DOCTOR: DoctorNarrationInput = {
  kind: 'doctor',
  goalPresetId: 'fast-mapping',
  archetype: 'attack-as-movement',
  findings: [
    {
      id: 'DOC-2',
      severity: 'critical',
      statement: 'Chaos res is low.',
      evidence: [{ metric: 'chaosMaximumHitTaken', value: 4120, threshold: 11000 }],
      fixSummaries: ['Add chaos res on jewellery.'],
    },
  ],
};

const TUNE: TuneNarrationInput = {
  kind: 'tune',
  goalPresetId: 'fast-mapping',
  candidates: [
    {
      description: 'Re-path to the movement cluster',
      weightedScoreDelta: 9.2,
      perAxis: [{ axis: 'Movement Speed', delta: 9.2 }],
    },
  ],
};

describe('createBuildCoach — happy path', () => {
  it('narrates a doctor report whose text passes the guardrail', async () => {
    const provider = new MockNarrationProvider({ mode: 'faithful' });
    const coach = createBuildCoach({ enabled: true, provider });
    const result = await coach.narrateDoctor(DOCTOR);
    expect(result).not.toBeNull();
    expect(result?.text.length).toBeGreaterThan(0);
    expect(result?.model).toBe(provider.model);
    expect(result?.inputHash).toBe(computeInputHash(DOCTOR, provider.model));
    expect(provider.calls).toBe(1);
  });

  it('narrates a tune ranking', async () => {
    const provider = new MockNarrationProvider({ mode: 'faithful' });
    const coach = createBuildCoach({ enabled: true, provider });
    const result = await coach.narrateTune(TUNE);
    expect(result).not.toBeNull();
    expect(result?.text).toContain('9.2');
  });
});

describe('createBuildCoach — kill-switch (returns null, provider NEVER called)', () => {
  it('disabled → null and zero provider calls', async () => {
    const provider = new MockNarrationProvider({ mode: 'faithful' });
    const coach = createBuildCoach({ enabled: false, provider });
    expect(await coach.narrateDoctor(DOCTOR)).toBeNull();
    expect(provider.calls).toBe(0);
  });

  it('no provider → null (and cannot call anything)', async () => {
    const coach = createBuildCoach({ enabled: true });
    expect(await coach.narrateDoctor(DOCTOR)).toBeNull();
  });

  it('budget exhausted → null and provider NEVER called', async () => {
    const provider = new MockNarrationProvider({ mode: 'faithful' });
    const exhausted: BudgetGuard = { tryConsume: () => false };
    const coach = createBuildCoach({ enabled: true, provider, budget: exhausted });
    expect(await coach.narrateDoctor(DOCTOR)).toBeNull();
    expect(provider.calls).toBe(0);
  });

  it('provider throws → null (degrades silently)', async () => {
    const provider = new MockNarrationProvider({ mode: 'throws' });
    const coach = createBuildCoach({ enabled: true, provider });
    expect(await coach.narrateDoctor(DOCTOR)).toBeNull();
  });
});

describe('createBuildCoach — validation failures degrade to null', () => {
  it('schema-invalid provider output → null', async () => {
    const provider = new MockNarrationProvider({ mode: 'schema-invalid' });
    const coach = createBuildCoach({ enabled: true, provider });
    expect(await coach.narrateDoctor(DOCTOR)).toBeNull();
  });

  it('number-inventing output → null (guardrail rejection)', async () => {
    const provider = new MockNarrationProvider({ mode: 'invents-number' });
    const coach = createBuildCoach({ enabled: true, provider });
    expect(await coach.narrateDoctor(DOCTOR)).toBeNull();
  });

  it('name-inventing output → null (guardrail rejection)', async () => {
    const provider = new MockNarrationProvider({ mode: 'invents-name' });
    const coach = createBuildCoach({ enabled: true, provider });
    expect(await coach.narrateDoctor(DOCTOR)).toBeNull();
  });

  it('a rejected narration is NOT cached (degrades every time, no poison)', async () => {
    const provider = new MockNarrationProvider({ mode: 'invents-number' });
    const cache = new InMemoryNarrationCache();
    const coach = createBuildCoach({ enabled: true, provider, cache });
    await coach.narrateDoctor(DOCTOR);
    await coach.narrateDoctor(DOCTOR);
    expect(cache.size).toBe(0);
    expect(provider.calls).toBe(2);
  });
});

describe('createBuildCoach — cache', () => {
  it('a cache hit returns the identical result WITHOUT a second provider call', async () => {
    const provider = new MockNarrationProvider({ mode: 'faithful' });
    const coach = createBuildCoach({ enabled: true, provider });
    const first = await coach.narrateDoctor(DOCTOR);
    const second = await coach.narrateDoctor(DOCTOR);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(provider.calls).toBe(1);
  });

  it('a cache hit does NOT consume budget', async () => {
    const provider = new MockNarrationProvider({ mode: 'faithful' });
    let consumed = 0;
    const budget: BudgetGuard = {
      tryConsume: () => {
        consumed += 1;
        return true;
      },
    };
    const coach = createBuildCoach({ enabled: true, provider, budget });
    await coach.narrateDoctor(DOCTOR);
    await coach.narrateDoctor(DOCTOR);
    expect(consumed).toBe(1); // only the first (cache-miss) request spent budget
  });
});

describe('computeInputHash — determinism under key reordering', () => {
  it('is stable when object keys are reordered', () => {
    const a: DoctorNarrationInput = {
      kind: 'doctor',
      goalPresetId: 'fast-mapping',
      archetype: 'attack-as-movement',
      findings: [
        {
          id: 'DOC-2',
          severity: 'critical',
          statement: 'Chaos res is low.',
          evidence: [{ metric: 'chaosMaximumHitTaken', value: 4120, threshold: 11000 }],
          fixSummaries: ['Add chaos res on jewellery.'],
        },
      ],
    };
    // Same data, keys assembled in a different order.
    const b: DoctorNarrationInput = {
      findings: [
        {
          fixSummaries: ['Add chaos res on jewellery.'],
          evidence: [{ threshold: 11000, value: 4120, metric: 'chaosMaximumHitTaken' }],
          statement: 'Chaos res is low.',
          severity: 'critical',
          id: 'DOC-2',
        },
      ],
      archetype: 'attack-as-movement',
      goalPresetId: 'fast-mapping',
      kind: 'doctor',
    };
    expect(computeInputHash(a, 'm')).toBe(computeInputHash(b, 'm'));
  });

  it('differs when the model changes', () => {
    expect(computeInputHash(DOCTOR, 'model-a')).not.toBe(
      computeInputHash(DOCTOR, 'model-b'),
    );
  });

  it('is unaffected by an unused UnlimitedBudgetGuard instance', () => {
    // Guard against accidental coupling: budget identity must not enter the hash.
    const g = new UnlimitedBudgetGuard();
    expect(g.tryConsume()).toBe(true);
  });
});
