// The eight Preference Axes — the user-weightable dimensions of the Weighted
// Score. Names are the CANONICAL strings from docs/GLOSSARY.md ("Preference
// Axes"); do not introduce synonyms.

export const PREFERENCE_AXES = [
  'Damage',
  'Survivability',
  'Movement Speed',
  'Attack Speed',
  'Cast Speed',
  'Skill Mobility Efficiency',
  'Resource Sustain',
  'Currency Efficiency',
] as const;

/** One of the eight canonical Preference Axes. */
export type PreferenceAxis = (typeof PREFERENCE_AXES)[number];

/**
 * A sum-constrained allocation of weight across every Preference Axis.
 * Callers may pass any non-negative numbers; the Preference Engine normalizes
 * the vector to sum to 1 before scoring (a sum-constrained allocation UI).
 */
export type AxisWeights = Record<PreferenceAxis, number>;
