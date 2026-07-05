// MockNarrationProvider — deterministic, network-free provider for tests.
//
// The whole test suite drives the Coach through this (NEVER OpenRouter), so
// tests make zero network calls. The `mode` selects a canned behavior:
//
//   • 'faithful'      — parse the NarrationInput from the prompt and compose a
//                       summary that cites ONLY numbers present in the input and
//                       introduces no proper names → passes the guardrail.
//   • 'invents-number'— cite a number ("roughly 5000") not in the input → the
//                       guardrail REJECTS it → the request degrades.
//   • 'invents-name'  — introduce invented multi-word proper names → REJECTED.
//   • 'schema-invalid'— return a payload that fails the strict output schema →
//                       treated as a provider failure → degrades.
//   • 'throws'        — throw, simulating a provider/network failure → degrades.
//   • 'custom'        — return a caller-supplied raw response verbatim.

import type { NarrationInput, NarrationProvider, StructuredPrompt } from '../types.js';

export type MockMode =
  | 'faithful'
  | 'invents-number'
  | 'invents-name'
  | 'schema-invalid'
  | 'throws'
  | 'custom';

export interface MockOptions {
  mode?: MockMode;
  /** Model label reported to the Coach (part of the input hash). */
  model?: string;
  /** Raw response returned verbatim when mode === 'custom'. */
  customResponse?: unknown;
}

/** Render a magnitude the way the faithful narrator cites it (guardrail round-trips it). */
function fmt(n: number): string {
  const v = Math.abs(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/** Collect up to two exact numbers the input authorizes, for the faithful summary. */
function citableNumbers(input: NarrationInput): number[] {
  const nums: number[] = [];
  if (input.kind === 'doctor') {
    for (const f of input.findings) {
      for (const e of f.evidence) {
        nums.push(e.value);
        if (nums.length >= 2) return nums;
      }
    }
  } else {
    for (const c of input.candidates) {
      nums.push(c.weightedScoreDelta);
      if (nums.length >= 2) return nums;
    }
  }
  return nums;
}

/** A faithful, guardrail-safe summary that cites only in-input numbers, no proper names. */
function faithfulSummary(input: NarrationInput): string {
  const nums = citableNumbers(input);
  if (input.kind === 'doctor') {
    if (nums.length === 0) {
      return 'Your build is in solid shape for this goal, so there is nothing alarming to flag. Keep an eye on the findings above and you will stay steady.';
    }
    const first = fmt(nums[0] as number);
    return `Good news first: the key figure to watch here is ${first}, and your build is holding together. There is a little headroom, so tighten that up and you will feel steadier.`;
  }
  if (nums.length === 0) {
    return 'These changes all pull in the direction you asked for, so start at the top. Each one nudges your score up without giving away what you care about.';
  }
  const top = fmt(nums[0] as number);
  return `The highest-leverage change is worth about ${top} to your score, so it is the one to try first. The rest stack smaller gains on top of it.`;
}

export class MockNarrationProvider implements NarrationProvider {
  readonly model: string;
  /** Number of times narrate() was invoked — lets kill-switch tests assert ZERO calls. */
  calls = 0;

  constructor(private readonly options: MockOptions = {}) {
    this.model = options.model ?? 'mock/deterministic-1';
  }

  async narrate(prompt: StructuredPrompt): Promise<unknown> {
    this.calls += 1;
    const mode = this.options.mode ?? 'faithful';

    switch (mode) {
      case 'throws':
        throw new Error('mock provider failure');
      case 'schema-invalid':
        // Missing `summary` and wrong `tone` → fails the strict output schema.
        return { tone: 'cheerful' };
      case 'invents-number':
        return {
          summary:
            'Your effective HP sits at roughly 5000, which is comfortable for this content. Push a little harder and you can clear faster.',
          tone: 'coach',
        };
      case 'invents-name':
        return {
          summary:
            'Grab Whirling Barrier and swap in the Eternal Damnation cluster for a clean boost. It suits how you play.',
          tone: 'coach',
        };
      case 'custom':
        return this.options.customResponse;
      case 'faithful':
      default: {
        const input = JSON.parse(prompt.user) as NarrationInput;
        return { summary: faithfulSummary(input), tone: 'coach' };
      }
    }
  }
}
