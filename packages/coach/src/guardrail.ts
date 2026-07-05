// THE GUARDRAIL — the deterministic heart of the Build Coach's trust contract.
//
// UX_PRESENTATION §7 rule 3 (implemented LITERALLY): "The LLM never introduces a
// number, item name, or node name that isn't in the structured findings it
// narrates." This module ENFORCES that in code, not in prompting. A narration
// that fails validation is treated exactly like a provider failure — the request
// silently degrades (no narration field), per the kill-switch rule.
//
// The check is membership-based: we derive an ALLOWLIST of every value the
// NarrationInput authorizes, extract every number and every capitalized
// multi-word name-like token from the narration, and reject the narration if any
// extracted token is not derivable from the allowlist.
//
// ── EXTRACTION RULES (documented; the same extractors build the allowlist and
//    scan the narration, so formatting round-trips consistently) ─────────────
//
// NUMBERS
//   • A numeric token is an optionally-signed integer or decimal, with optional
//     thousands separators and an optional %/k/m suffix:  -1,240   +9.2   12%   11k
//   • Normalization (round-trip tolerant): drop the sign (magnitude only), drop
//     thousands commas, apply the suffix (% → same value, k → ×1e3, m → ×1e6),
//     then parseFloat. So "4,120" and 4120, "+9.2" and 9.2, "12%" and 12 all
//     normalize equal.
//   • The allowlist stores, for every authorized value v: v itself, round(v),
//     and round-to-1-decimal(v) — so a narration that rounds 9.234→"9.2" or
//     84.0→"84" passes, while an invented 5000 (when the evidence is 4120) fails.
//   • A narration number passes iff it is within EPSILON of some allowed value.
//
// NAMES
//   • A name-like token is a run of 2+ CONSECUTIVE capitalized words separated by
//     single spaces (e.g. "Whirling Barrier", "Movement Speed"), OR a SINGLE
//     capitalized word that is NOT sentence-initial (mid-sentence capitalization
//     is a proper-noun signal: "Slot in Mageblood" must be caught even though
//     "Mageblood" is one word — PoE2 is full of single-word uniques/keystones).
//     Sentence-initial single words are grammatical capitalization, not names,
//     and are skipped. ALL-CAPS acronyms (EHP, DPS, ES, QoL) are never checked.
//   • STOPWORDS (function words / common sentence-openers like "Your", "Under",
//     "The") never count as name words: they break runs, so "Under Fast Mapping"
//     yields the run "Fast Mapping", not "Under Fast Mapping". Because "The"
//     breaks a run, "The Doctor" is checked as the mid-sentence single "Doctor".
//   • The allowlist collects every such run found in the input's own text
//     (statements, fix summaries, rationale, axis names) PLUS normalized display
//     forms of the archetype and preset id ("fast-mapping" → "fast mapping").
//     For SINGLE words, membership is word-level: every word occurring anywhere
//     in the input's texts (any casing) or in an allowlisted name authorizes
//     that single word — so capitalization variance never false-rejects.
//   • A narration name passes iff its normalized (lowercased, single-spaced) form
//     is in the allowlist. An invented proper name → reject.
//   • KNOWN RESIDUAL: a single-word invented name at the very start of a
//     sentence ("Mageblood is what you want.") is indistinguishable from
//     grammatical capitalization and passes. Multi-word and mid-sentence
//     inventions — the realistic LLM failure shapes — are caught.
//
// SPELLED-OUT NUMBERS
//   • Word-number sequences ("five thousand", "forty-two", "three hundred and
//     twenty") are parsed to their numeric value and checked against the same
//     numeric allowlist. Enforcement applies when the parsed value is ≥ 10 or
//     the phrase contains a scale word (hundred/thousand/million/billion) —
//     tiny counts ("one of your best options", "top three") are ordinary prose,
//     not smuggled magnitudes, and are ignored.
//
// UNICODE
//   • The narration is NFKC-normalized before scanning (fullwidth ５０００ → 5000).
//   • Any surviving non-ASCII decimal digit (\p{Nd} outside 0-9, e.g.
//     Arabic-Indic ٥) is rejected outright: a well-behaved narrator has no
//     business emitting digits our scanners cannot read.

import type { NarrationInput } from './types.js';

/** Absolute/relative tolerance for numeric membership. */
const EPSILON = 1e-6;

/** Matches an optionally-signed number with thousands separators, decimals, and a %/k/m suffix. */
const NUMBER_RE = /[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|[km])?/gi;

/** Matches a single "word" (letters, digits, apostrophes, hyphens) for name-run scanning. */
const WORD_RE = /[A-Za-z][A-Za-z0-9'’-]*/g;

/**
 * Function words / common sentence-openers that must never anchor a proper name.
 * They break name runs so ordinary coach prose ("Under your Fast Mapping goal…")
 * does not manufacture a false "invented name".
 */
const STOPWORDS: ReadonlySet<string> = new Set(
  [
    'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'by',
    'for', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your',
    "you're", 'yours', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'he',
    'she', 'his', 'her', 'hers', 'under', 'over', 'above', 'below', 'into',
    'onto', 'per', 'via', 'than', 'then', 'so', 'if', 'when', 'while',
    'because', 'since', 'about', 'around', 'roughly', 'approximately', 'only',
    'still', 'now', 'here', 'there', 'what', 'which', 'who', 'whom', 'whose',
    'why', 'how', 'not', 'no', 'yes', 'more', 'less', 'most', 'least', 'up',
    'down', 'out', 'off', 'all', 'any', 'each', 'every', 'both', 'either',
    'neither', 'some', 'few', 'many', 'much', 'keep', 'let', 'get', 'got',
    'make', 'made', 'take', 'give', 'want', 'need', 'like', 'look', 'looks',
    'here’s', "here's", 'once', 'also', 'just', 'well', 'good', 'great',
    'nice', 'consider', 'try', 'add', 'drop', 'swap', 'note', 'watch',
    'room', 'goal', 'build', 'score', 'change', 'changes', 'top', 'main',
    'key', 'figure', 'number', 'picture', 'point', 'points', 'you’re',
  ].map((w) => w.toLowerCase()),
);

/** Result of a guardrail check. `ok:false` degrades the request (kill-switch). */
export interface GuardrailResult {
  ok: boolean;
  /** Numbers found in the narration not derivable from the input. */
  offendingNumbers: string[];
  /** Multi-word names found in the narration not derivable from the input. */
  offendingNames: string[];
}

/** Normalize one numeric token string to a non-negative magnitude, or null. */
function normalizeNumber(token: string): number | null {
  let t = token.trim();
  if (t.length === 0) return null;
  // Drop sign — the allowlist stores magnitudes; a "-312" cites the value 312.
  if (t[0] === '+' || t[0] === '-') t = t.slice(1);
  let multiplier = 1;
  const suffix = t[t.length - 1]?.toLowerCase();
  if (suffix === '%') {
    t = t.slice(0, -1); // "12%" cites the value 12
  } else if (suffix === 'k') {
    t = t.slice(0, -1);
    multiplier = 1_000;
  } else if (suffix === 'm') {
    t = t.slice(0, -1);
    multiplier = 1_000_000;
  }
  t = t.replace(/,/g, '');
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) * multiplier;
}

/** All numeric magnitudes found in a text, normalized. */
function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(NUMBER_RE)) {
    const n = normalizeNumber(match[0]);
    if (n !== null) out.push(n);
  }
  return out;
}

/** True for an ALL-CAPS acronym (EHP, DPS, ES) — allowed anywhere, breaks name runs. */
function isAcronym(word: string): boolean {
  return word.length >= 2 && /^[A-Z0-9]+$/.test(word) && /[A-Z]/.test(word);
}

/** True for a capitalized name word: starts uppercase, not an acronym, not a stopword. */
function isNameWord(word: string): boolean {
  if (!/^[A-Z]/.test(word)) return false;
  if (isAcronym(word)) return false;
  if (STOPWORDS.has(word.toLowerCase())) return false;
  return true;
}

/** Normalize a name run to a canonical key (lowercased, single-spaced). */
function normalizeName(words: string[]): string {
  return words.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Extract every capitalized multi-word (2+) name run from a text. Runs are broken
 * by stopwords, acronyms, non-capitalized words, and any non-space gap between
 * words (punctuation, newlines) — so names never cross sentence/clause bounds.
 */
function extractNames(text: string): string[] {
  return extractNameTokens(text).multi;
}

/** A sentence boundary in the gap between two words. */
const SENTENCE_BREAK_RE = /[.!?;:\n\r"'“”‘’()[\]—–]/;

/**
 * Extracted name tokens: `multi` = runs of 2+ capitalized words; `singles` =
 * lone capitalized words that are NOT sentence-initial (lowercased). Mid-
 * sentence capitalization is a proper-noun signal — "Slot in Mageblood" must
 * be caught even though "Mageblood" is one word. Sentence-initial single words
 * are grammatical capitalization and are skipped (documented residual).
 */
function extractNameTokens(text: string): { multi: string[]; singles: string[] } {
  const multi: string[] = [];
  const singles: string[] = [];
  let run: string[] = [];
  let runOpensSentence = false;
  let lastEnd = -1;

  const flush = (): void => {
    if (run.length >= 2) {
      multi.push(normalizeName(run));
    } else if (run.length === 1 && !runOpensSentence) {
      singles.push(run[0]!.toLowerCase());
    }
    run = [];
    runOpensSentence = false;
  };

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    const start = match.index ?? 0;
    // Gap since previous word: a run only continues across pure-whitespace gaps.
    const gap = lastEnd >= 0 ? text.slice(lastEnd, start) : '';
    const contiguous = lastEnd >= 0 && /^[ \t ]+$/.test(gap);
    // Sentence-initial: first word of the text, or the gap carries sentence-
    // opening punctuation. Computed BEFORE lastEnd moves.
    const opensSentence = lastEnd < 0 || SENTENCE_BREAK_RE.test(gap);
    lastEnd = start + word.length;

    if (isNameWord(word)) {
      if (!contiguous) flush();
      if (run.length === 0) runOpensSentence = opensSentence;
      run.push(word);
    } else {
      // Stopword / acronym / lowercase word ends the current run.
      flush();
    }
  }
  flush();
  return { multi, singles };
}

// ── Spelled-out numbers ─────────────────────────────────────────────────────

const WORD_NUMBER_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const WORD_NUMBER_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
const WORD_NUMBER_SCALES: Record<string, number> = {
  hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000,
};

/**
 * Parse spelled-out number phrases ("five thousand", "forty-two", "three
 * hundred and twenty") and return the ENFORCEABLE parsed magnitudes: value ≥ 10
 * or the phrase used a scale word. Tiny counts ("one of your best options",
 * "top three") are ordinary prose, not smuggled magnitudes, and are ignored.
 */
function extractWordNumbers(text: string): number[] {
  const out: number[] = [];
  // Word-split; hyphenated compounds ("forty-two") split into their parts.
  const words = text.toLowerCase().split(/[^a-z]+/);
  let current = 0;
  let total = 0;
  let inPhrase = false;
  let usedScale = false;

  const flushPhrase = (): void => {
    if (inPhrase) {
      const value = total + current;
      if (value >= 10 || usedScale) out.push(value);
    }
    current = 0;
    total = 0;
    inPhrase = false;
    usedScale = false;
  };

  for (const w of words) {
    if (w in WORD_NUMBER_UNITS) {
      current += WORD_NUMBER_UNITS[w]!;
      inPhrase = true;
    } else if (w in WORD_NUMBER_TENS) {
      current += WORD_NUMBER_TENS[w]!;
      inPhrase = true;
    } else if (w in WORD_NUMBER_SCALES) {
      if (!inPhrase) continue; // bare "a hundred reasons" — no leading unit, skip
      const scale = WORD_NUMBER_SCALES[w]!;
      if (scale === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        total += (current === 0 ? 1 : current) * scale;
        current = 0;
      }
      usedScale = true;
    } else if (w === 'and' && inPhrase) {
      continue; // "three hundred and twenty" — connector inside a phrase
    } else {
      flushPhrase();
    }
  }
  flushPhrase();
  return out;
}

/** Non-ASCII decimal digits (\p{Nd} outside 0-9) that survive NFKC. */
function findNonAsciiDigits(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\p{Nd}/gu)) {
    if (m[0]! < '0' || m[0]! > '9') out.push(m[0]!);
  }
  return out;
}

/** Title-cased/hyphenated ids ("fast-mapping") → normalized name key ("fast mapping"). */
function idToNameKey(id: string): string {
  return id.replace(/[-_]+/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Every text field the input authorizes narration to draw names/numbers from. */
function inputTexts(input: NarrationInput): string[] {
  const texts: string[] = [];
  if (input.archetype !== undefined) texts.push(input.archetype);
  if (input.rationale !== undefined) texts.push(input.rationale);
  if (input.kind === 'doctor') {
    for (const f of input.findings) {
      texts.push(f.statement);
      texts.push(...f.fixSummaries);
    }
  } else {
    for (const c of input.candidates) {
      texts.push(c.description);
      for (const a of c.perAxis) texts.push(a.axis);
    }
  }
  return texts;
}

/** Build the numeric + name allowlists from a NarrationInput (see EXTRACTION RULES). */
export function deriveAllowlist(input: NarrationInput): {
  numbers: number[];
  names: Set<string>;
  /** Word-level allowlist for SINGLE capitalized words: every word occurring
   *  anywhere in the input's texts (any casing) or in an allowlisted name. */
  nameWords: Set<string>;
} {
  const numbers: number[] = [];
  const names = new Set<string>();
  const nameWords = new Set<string>();

  const addNumber = (v: number): void => {
    if (!Number.isFinite(v)) return;
    const a = Math.abs(v);
    numbers.push(a, Math.round(a), Math.round(a * 10) / 10);
  };

  // 1. Direct authorized numbers (evidence values/thresholds; candidate deltas).
  if (input.kind === 'doctor') {
    for (const f of input.findings) {
      for (const e of f.evidence) {
        addNumber(e.value);
        if (e.threshold !== undefined) addNumber(e.threshold);
      }
    }
  } else {
    for (const c of input.candidates) {
      addNumber(c.weightedScoreDelta);
      for (const a of c.perAxis) addNumber(a.delta);
    }
  }

  // 2. Numbers + names embedded in the input's own text (statements, fixes, …).
  for (const text of inputTexts(input)) {
    for (const n of extractNumbers(text)) addNumber(n);
    for (const wn of extractWordNumbers(text)) addNumber(wn);
    for (const name of extractNames(text)) names.add(name);
    // Word-level allowlist: EVERY word of the input's texts (any casing), so a
    // narration capitalizing a word the findings wrote lowercase never
    // false-rejects, while a word absent from the input ("Mageblood") does.
    for (const m of text.matchAll(WORD_RE)) nameWords.add(m[0].toLowerCase());
  }

  // 3. Normalized display forms of the archetype and preset id.
  names.add(idToNameKey(input.goalPresetId));
  if (input.archetype !== undefined) names.add(idToNameKey(input.archetype));

  // 4. Every word of every allowlisted name authorizes its single-word form.
  for (const name of names) {
    for (const w of name.split(' ')) if (w.length > 0) nameWords.add(w);
  }

  return { numbers, names, nameWords };
}

/** True if `value` matches any allowed magnitude within EPSILON. */
function numberAllowed(value: number, allowed: number[]): boolean {
  for (const a of allowed) {
    const tol = Math.max(EPSILON, EPSILON * Math.abs(a));
    if (Math.abs(a - value) <= tol) return true;
  }
  return false;
}

/**
 * Validate a narration against the values its NarrationInput authorizes. Returns
 * `ok:true` for a faithful narration; `ok:false` (with the offending tokens) for
 * any invented number or multi-word proper name. A false result degrades the
 * request exactly like a provider failure (kill-switch).
 */
export function validateNarration(
  text: string,
  input: NarrationInput,
): GuardrailResult {
  const { numbers, names, nameWords } = deriveAllowlist(input);

  // NFKC first: fullwidth digits (５０００) become ASCII and enter the scanners.
  const scanText = text.normalize('NFKC');

  const offendingNumbers: string[] = [];

  // Any surviving non-ASCII decimal digit is an automatic reject: a narrator
  // has no business emitting digits our scanners cannot read.
  for (const d of findNonAsciiDigits(scanText)) offendingNumbers.push(d);

  for (const match of scanText.matchAll(NUMBER_RE)) {
    const n = normalizeNumber(match[0]);
    if (n === null) continue;
    if (!numberAllowed(n, numbers)) offendingNumbers.push(match[0]);
  }

  // Spelled-out magnitudes ("five thousand") are numbers too.
  for (const wn of extractWordNumbers(scanText)) {
    if (!numberAllowed(wn, numbers)) offendingNumbers.push(String(wn));
  }

  const offendingNames: string[] = [];
  const tokens = extractNameTokens(scanText);
  for (const name of tokens.multi) {
    if (!names.has(name)) offendingNames.push(name);
  }
  // Mid-sentence single capitalized words must exist somewhere in the input.
  for (const single of tokens.singles) {
    if (!nameWords.has(single)) offendingNames.push(single);
  }

  return {
    ok: offendingNumbers.length === 0 && offendingNames.length === 0,
    offendingNumbers,
    offendingNames,
  };
}
