// The eight Preference Axes as the UI presents them: canonical name, a short
// label for tight surfaces (radar/sliders), and the PoE stat-color the axis
// reads in. Colors follow the dialect in UX_PRESENTATION §2.4.

import type { PreferenceAxis } from "./types";
import { PREFERENCE_AXES } from "./types";

export { PREFERENCE_AXES };
export type { PreferenceAxis };

export interface AxisMeta {
  axis: PreferenceAxis;
  short: string;
  /** CSS var reference for the axis's stat color. */
  color: string;
}

export const AXIS_META: Record<PreferenceAxis, AxisMeta> = {
  Damage: { axis: "Damage", short: "Damage", color: "var(--color-fire)" },
  Survivability: {
    axis: "Survivability",
    short: "Survival",
    color: "var(--color-life)",
  },
  "Movement Speed": {
    axis: "Movement Speed",
    short: "Move",
    color: "var(--color-cold)",
  },
  "Attack Speed": {
    axis: "Attack Speed",
    short: "Attack",
    color: "var(--color-lightning)",
  },
  "Cast Speed": {
    axis: "Cast Speed",
    short: "Cast",
    color: "var(--color-mana)",
  },
  "Skill Mobility Efficiency": {
    axis: "Skill Mobility Efficiency",
    short: "Mobility",
    color: "var(--color-chaos)",
  },
  "Resource Sustain": {
    axis: "Resource Sustain",
    short: "Sustain",
    color: "var(--color-es)",
  },
  "Currency Efficiency": {
    axis: "Currency Efficiency",
    short: "Currency",
    color: "var(--color-accent-strong)",
  },
};

export const AXIS_LIST: AxisMeta[] = PREFERENCE_AXES.map((a) => AXIS_META[a]);
