// Deterministic display formatting. Math wears the crown (Law 3): numbers are
// rendered exactly, compactly, and with a stable dialect so they read as
// computed truth, never decoration.

import type { Goal } from "./types";

/** 1_900_000 → "1.9M", 42_000 → "42.0k", 118 → "118". */
export function compact(n: number, digits = 1): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(digits)}k`;
  return `${Math.round(n)}`;
}

export function integer(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** A signed, fixed-precision score delta, e.g. "+9.2" / "−2.4" (en-dash minus). */
export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  if (n > 0) return `+${v}`;
  if (n < 0) return `−${v.replace("-", "")}`;
  return v;
}

/** Percent from a movement-speed style multiplier (1.18 → "118%"). */
export function percentFromMult(mult: number): string {
  return `${Math.round(mult * 100)}%`;
}

/** Divine cost chip text. 0 → "free"; 2 → "~2 div". */
export function costLabel(div: number): string {
  if (div <= 0) return "free";
  const v = div >= 10 ? Math.round(div) : Math.round(div * 10) / 10;
  return `~${v} div`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Goal ids ⇄ human labels used by the Doctor goal switcher. */
export const GOAL_LABELS: Record<Goal, string> = {
  "fast-mapping": "Fast Mapping",
  "speed-clearing": "Speed Clearing",
  "boss-farming": "Boss Farming",
  "party-carry": "Party Carry",
  tanky: "Tanky",
  "hardcore-survivability": "Hardcore Survivability",
  "budget-farming": "Budget Farming",
  "smooth-gameplay": "Smooth Gameplay",
  "maximum-dps": "Maximum DPS",
  balanced: "Balanced",
};

export const GOALS: Goal[] = [
  "fast-mapping",
  "speed-clearing",
  "boss-farming",
  "party-carry",
  "tanky",
  "hardcore-survivability",
  "budget-farming",
  "smooth-gameplay",
  "maximum-dps",
  "balanced",
];

/**
 * Map a Context Detector suggested Goal Preset label (context-detector emits
 * e.g. "Fast Mapping") to the nearest preference-engine preset id and Doctor
 * goal id. The user always sees and may override.
 */
export function presetIdFromSuggestion(suggested: string): string {
  const s = suggested.toLowerCase();
  if (s.includes("fast") || s.includes("speed")) return "fast-mapping";
  if (s.includes("boss")) return "boss-farming";
  if (s.includes("hardcore") || s.includes("tank")) {
    return "hardcore-survivability";
  }
  if (s.includes("budget")) return "budget-farming";
  return "balanced";
}

export function goalFromPresetId(presetId: string): Goal {
  const known: Record<string, Goal> = {
    "fast-mapping": "fast-mapping",
    "boss-farming": "boss-farming",
    "hardcore-survivability": "hardcore-survivability",
    "budget-farming": "budget-farming",
    balanced: "balanced",
    "maximum-dps": "maximum-dps",
  };
  return known[presetId] ?? "balanced";
}
