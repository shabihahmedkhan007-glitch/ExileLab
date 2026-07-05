// @exilelab/coach — the Build Coach: ExileLab's single LLM-narration persona and
// the only channel through which generated text reaches the user (GLOSSARY:
// "Build Coach"; UX_PRESENTATION §7). Explanation-ONLY, one-way, coach-voice.
//
// The trust contract (non-negotiable) is enforced HERE, in code:
//   1. A deterministic guardrail rejects any number/name not in the input.
//   2. Provider output is strict-schema (zod) validated; invalid → failure.
//   3. Narration is a summary card, never chat, never advice.
//   4. Kill-switch: no key / disabled / provider failure / guardrail rejection /
//      budget exhaustion → returns null (the caller omits the narration field).
//   5. Every narration is cached by content hash; budgets enforced app-side.

export type {
  NarrationInput,
  DoctorNarrationInput,
  TuneNarrationInput,
  NarrationFinding,
  NarrationEvidence,
  NarrationCandidate,
  NarrationCandidateAxis,
  NarrationResult,
  NarrationProvider,
  StructuredPrompt,
} from './types.js';

export { createBuildCoach } from './coach.js';
export type { BuildCoach, BuildCoachOptions } from './coach.js';

export {
  buildPrompt,
  SYSTEM_PROMPT,
  DEFAULT_MODEL,
  NarrationOutputSchema,
  NARRATION_JSON_SCHEMA,
} from './prompt.js';
export type { NarrationOutput } from './prompt.js';

export { validateNarration, deriveAllowlist } from './guardrail.js';
export type { GuardrailResult } from './guardrail.js';

export { computeInputHash } from './hash.js';

export { InMemoryNarrationCache } from './cache.js';
export type { NarrationCache } from './cache.js';

export { DailyBudgetGuard, UnlimitedBudgetGuard } from './budget.js';
export type { BudgetGuard } from './budget.js';

export { OpenRouterProvider } from './providers/openrouter.js';
export type { OpenRouterOptions } from './providers/openrouter.js';

export { MockNarrationProvider } from './providers/mock.js';
export type { MockMode, MockOptions } from './providers/mock.js';
