// Build the Build Coach from environment configuration.
//
// Config (PRD §9.2 / §10 — LLM is an explanation-only shell):
//   • OPENROUTER_API_KEY — absent ⇒ the Coach is DISABLED (no provider, no
//     network, narration silently omitted everywhere). This is the default.
//   • COACH_ENABLED      — 'false' hard-disables even when a key is present.
//                          Any other value (or unset) ⇒ enabled when a key exists.
//   • COACH_MODEL        — overrides the flash-class default model.
//
// The OpenRouter provider (the one sanctioned external endpoint) is instantiated
// ONLY when a key is present — so a keyless deployment, and the whole test suite,
// makes ZERO network calls. Tests inject a MockNarrationProvider-backed coach.

import {
  createBuildCoach,
  DEFAULT_MODEL,
  OpenRouterProvider,
} from "@exilelab/coach";
import type { BuildCoach } from "@exilelab/coach";

export function coachFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): BuildCoach {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = env.COACH_MODEL?.trim() || DEFAULT_MODEL;

  // No key ⇒ disabled, provider-less: narration is never attempted.
  if (apiKey === undefined || apiKey.length === 0) {
    return createBuildCoach({ enabled: false, model });
  }

  // Key present but explicitly switched off.
  const enabled = env.COACH_ENABLED?.trim().toLowerCase() !== "false";
  if (!enabled) {
    return createBuildCoach({ enabled: false, model });
  }

  return createBuildCoach({
    enabled: true,
    model,
    provider: new OpenRouterProvider({ apiKey, model }),
  });
}
