// OpenRouterProvider — the ONE sanctioned external LLM route (PRD §9.2:
// https://openrouter.ai/api/v1). It is the only external endpoint product code
// may reach at runtime, and ONLY ever when an API key is present:
//
//   • The constructor THROWS without a key, so it can never be instantiated
//     keyless. The Coach factory only constructs it when a key exists, so a
//     keyless/disabled deployment makes ZERO network calls.
//   • TESTS never construct this — they use MockNarrationProvider — so the test
//     suite makes zero network calls.
//
// Uses the global `fetch` (Node 24) — no new dependency. It POSTs a strict
// json_schema response_format, a flash-class default model, a sensible timeout,
// and a single retry on 5xx. It returns the PARSED message content as `unknown`;
// the Coach zod-validates it (an invalid/garbled body is a provider failure).

import type { NarrationProvider, StructuredPrompt } from '../types.js';
import { DEFAULT_MODEL } from '../prompt.js';

export interface OpenRouterOptions {
  /** Required. The provider refuses to exist without it (network-rule guard). */
  apiKey: string;
  /** Flash-class default model; override per deployment (COACH_MODEL). */
  model?: string;
  /** Base URL — the sole permitted external host (PRD §9.2). */
  baseUrl?: string;
  /** Per-attempt timeout in ms (default 8s). */
  timeoutMs?: number;
  /** Injectable fetch (defaults to global fetch); tests never exercise this path. */
  fetchImpl?: typeof fetch;
}

export class OpenRouterProvider implements NarrationProvider {
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenRouterOptions) {
    if (typeof options.apiKey !== 'string' || options.apiKey.trim().length === 0) {
      // Hard invariant: NEVER instantiate the external provider without a key.
      throw new Error('OpenRouterProvider requires an apiKey; refuse to run keyless');
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.baseUrl = options.baseUrl ?? 'https://openrouter.ai/api/v1';
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async narrate(prompt: StructuredPrompt): Promise<unknown> {
    const body = JSON.stringify({
      model: prompt.model || this.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      response_format: { type: 'json_schema', json_schema: prompt.jsonSchema },
    });

    // One retry: only on a 5xx (transient). 4xx and parse errors do not retry.
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.post(body);
        if (response.status >= 500) {
          lastError = new Error(`OpenRouter ${response.status}`);
          continue; // retry once
        }
        if (!response.ok) {
          throw new Error(`OpenRouter ${response.status}`);
        }
        const json = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new Error('OpenRouter response missing message content');
        }
        return JSON.parse(content) as unknown;
      } catch (err) {
        lastError = err;
        // Abort/timeout or network error: allow one retry, then fail.
        if (attempt === 1) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('OpenRouter request failed');
  }

  private async post(body: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
