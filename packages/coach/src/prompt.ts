// The prompt builder + the strict output schema.
//
// The system prompt encodes the coach persona rules from UX_PRESENTATION §9
// (coach never judge; respect the archetype; numbers exact and scoped;
// PoE-literate not memey) PLUS the hard instruction that only values present in
// the input may be referenced. The user content is the NarrationInput as JSON.
//
// The output is intentionally MINIMAL — a summary card, not structured advice
// (advice is the deterministic layer's job): { summary, tone:'coach' }. It is
// zod-validated (strict) on the way back, and the same shape is expressed as a
// strict JSON Schema for the provider's response_format.

import { z } from 'zod';
import type { NarrationInput, StructuredPrompt } from './types.js';

/**
 * The default narration model (configurable via COACH_MODEL). PRD §9.2 / §10:
 * cheap, explanation-only. Chosen + live-tested 2026-07 against OpenRouter.
 *
 * DEFAULT — inclusionai/ling-2.6-flash: the cheapest paid model that reliably
 * works end-to-end (≈$0.0000094/narration ≈ $1 per 100k, ~1.4s, verified to
 * pass the guardrail with clean coach-tone prose). "Effectively free" without
 * the free tier's fragility.
 *
 * NOTE on the $0 tier: qwen/qwen3-next-80b-a3b-instruct:free is genuinely free
 * but its upstream provider rate-limits aggressively (observed HTTP 429,
 * retry-after ~26s) — impractical for a narration that rides a live
 * doctor/tune response, so it is NOT the default. It still works as a COACH_MODEL
 * override when the upstream has capacity; every failure silently drops the card.
 *
 * THE LADDER (env COACH_MODEL, zero code changes), per-narration at our
 * ~700-in/80-out profile:
 *   qwen/qwen3-next-80b-a3b-instruct:free  $0            (flaky upstream 429s)
 *   inclusionai/ling-2.6-flash             ≈ $0.0000094  (DEFAULT — reliable floor)
 *   qwen/qwen3-30b-a3b-instruct-2507       ≈ $0.000049   (proven instructor, ~4s)
 *   openai/gpt-4.1-nano                    ≈ $0.0001     (grammar-enforced schema,
 *                                                         fastest — production pick)
 *   anthropic/claude-haiku-4.5             ≈ $0.001      (best discipline)
 */
export const DEFAULT_MODEL = 'inclusionai/ling-2.6-flash';

/** The coach persona + hard grounding instruction (UX §9 + §7 rule 3). */
export const SYSTEM_PROMPT = [
  'You are the Build Coach for a Path of Exile 2 build-optimization tool.',
  'You narrate deterministic, already-computed findings into a short summary.',
  '',
  'VOICE (follow literally):',
  '- Coach, never judge. Lead with the gain, never shame the build.',
  "- Respect the detected archetype; frame everything relative to the player's goal, never as an absolute \"optimal\".",
  '- Numbers are exact and scoped; claims are bounded to what the findings state.',
  '- Be PoE-literate (use real terms: EHP, ES, resistances, ailments) but never memey or slangy.',
  '',
  'HARD RULES (a violation makes your entire response unusable):',
  '- You may ONLY reference numbers, item names, and passive-node names that appear in the JSON input below.',
  '- Never invent, estimate, round to a new figure, or introduce any value that is not already in the input.',
  '- Do not compute anything. The numbers are computed for you; you only explain them.',
  '',
  'OUTPUT: a JSON object { "summary": string, "tone": "coach" }.',
  'The summary is 2-3 sentences of plain-language coach prose. No lists, no markdown, no headings.',
].join('\n');

/** Strict runtime schema for the provider's parsed response. Invalid → provider failure. */
export const NarrationOutputSchema = z
  .object({
    summary: z.string().min(1),
    tone: z.literal('coach'),
  })
  .strict();

export type NarrationOutput = z.infer<typeof NarrationOutputSchema>;

/** The strict JSON Schema envelope for OpenRouter's response_format json_schema. */
export const NARRATION_JSON_SCHEMA: Record<string, unknown> = {
  name: 'narration',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'tone'],
    properties: {
      summary: { type: 'string' },
      tone: { type: 'string', enum: ['coach'] },
    },
  },
};

/** Build the provider-agnostic prompt for a NarrationInput. */
export function buildPrompt(input: NarrationInput, model: string): StructuredPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: JSON.stringify(input),
    model,
    jsonSchema: NARRATION_JSON_SCHEMA,
  };
}
