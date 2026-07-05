// createBuildCoach — the factory that wires provider + cache + budget + guardrail
// into the two narration entry points the API calls.
//
// EVERY degradation path returns `null` (never throws, never a broken state),
// implementing the kill-switch rule (UX §7 rule 4): no key / disabled flag /
// provider failure / schema-invalid output / guardrail rejection / budget
// exhaustion → the caller simply omits the narration field. When disabled or
// provider-less, the Coach makes ZERO provider calls.

import { buildPrompt, DEFAULT_MODEL, NarrationOutputSchema } from './prompt.js';
import { validateNarration } from './guardrail.js';
import { computeInputHash } from './hash.js';
import { InMemoryNarrationCache } from './cache.js';
import type { NarrationCache } from './cache.js';
import { DailyBudgetGuard } from './budget.js';
import type { BudgetGuard } from './budget.js';
import type {
  DoctorNarrationInput,
  NarrationInput,
  NarrationProvider,
  NarrationResult,
  TuneNarrationInput,
} from './types.js';

export interface BuildCoachOptions {
  /** Master switch. `false` → always null, ZERO provider calls (kill-switch). */
  enabled: boolean;
  /** The LLM provider. Absent → always null, ZERO provider calls. */
  provider?: NarrationProvider;
  /** Content-hash cache (default in-memory). Stores POST-guardrail results only. */
  cache?: NarrationCache;
  /** App-side budget (default per-process daily). Exhausted → degrade. */
  budget?: BudgetGuard;
  /** Model label folded into the input hash (default flash-class). */
  model?: string;
  /** Optional clock for deterministic `cachedAt` in tests. */
  now?: () => Date;
}

/** The Coach surface the API consumes. Both methods return null on any degradation. */
export interface BuildCoach {
  narrateDoctor(input: DoctorNarrationInput): Promise<NarrationResult | null>;
  narrateTune(input: TuneNarrationInput): Promise<NarrationResult | null>;
}

export function createBuildCoach(options: BuildCoachOptions): BuildCoach {
  const {
    enabled,
    provider,
    cache = new InMemoryNarrationCache(),
    budget = new DailyBudgetGuard(),
    model = options.provider && 'model' in options.provider
      ? (options.provider as { model?: string }).model ?? DEFAULT_MODEL
      : DEFAULT_MODEL,
    now = () => new Date(),
  } = options;

  async function narrate(input: NarrationInput): Promise<NarrationResult | null> {
    // Kill-switch: disabled or no provider → never call out, never narrate.
    if (!enabled || provider === undefined) return null;

    const inputHash = computeInputHash(input, model);

    // Cache hit is free — no budget spend, no provider call.
    const cached = await cache.get(inputHash);
    if (cached !== undefined) return cached;

    // Budget is enforced BEFORE spending a provider call.
    if (!budget.tryConsume()) return null;

    // Provider call + strict validation + guardrail — any failure degrades.
    let raw: unknown;
    try {
      raw = await provider.narrate(buildPrompt(input, model));
    } catch {
      return null; // provider/network failure → kill-switch
    }

    const parsed = NarrationOutputSchema.safeParse(raw);
    if (!parsed.success) return null; // schema-invalid → provider failure

    const verdict = validateNarration(parsed.data.summary, input);
    if (!verdict.ok) return null; // guardrail rejection → kill-switch

    const result: NarrationResult = {
      text: parsed.data.summary,
      model,
      cachedAt: now().toISOString(),
      inputHash,
    };
    // Cache POST-guardrail results only.
    await cache.set(inputHash, result);
    return result;
  }

  // The narration layer must NEVER take a route down with it: any throw from
  // ANY injected dependency (an async Redis-backed cache, a custom budget
  // guard, hashing on a hostile input) degrades to null exactly like a
  // provider failure. The inner try/catch keeps provider-failure semantics
  // (budget already spent); this outer net catches everything else.
  async function narrateSafe(input: NarrationInput): Promise<NarrationResult | null> {
    try {
      return await narrate(input);
    } catch {
      return null;
    }
  }

  return {
    narrateDoctor: (input) => narrateSafe(input),
    narrateTune: (input) => narrateSafe(input),
  };
}
