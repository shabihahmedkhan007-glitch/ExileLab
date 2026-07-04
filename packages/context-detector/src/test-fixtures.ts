// Snapshot fixture factories for tests.
//
// RFC-0001's BuildSnapshot factory lives in @exilelab/core; these fixtures build
// canonical core snapshots via createBuildSnapshot and pair them with the OPTIONAL
// engine-derived overlay (defence/resources) the detector reads for numeric rules
// like ES-tank (RFC-0001 AD-7: those magnitudes are Calculation Results, not build
// state). Each factory returns a DetectionInput ({ snapshot, calc }) that the
// detector accepts directly.

import { createBuildSnapshot } from "@exilelab/core";
import type {
  CalculationView,
  DefensiveLayers,
  DetectionInput,
  ResourceState,
} from "./types.js";

/** Simplified per-skill fixture input. */
interface FixtureSkill {
  skillId: string;
  displayName?: string;
  isMainSkill?: boolean;
}

/** Build a minimal, valid DetectionInput with one primary Loadout Context. */
export function makeSnapshot(input: {
  skills: FixtureSkill[];
  defence?: DefensiveLayers;
  resources?: ResourceState;
  className?: string;
  ascendancy?: string;
}): DetectionInput {
  const names: Record<string, string> = {};
  for (const s of input.skills) {
    if (s.displayName !== undefined) names[s.skillId] = s.displayName;
  }

  const snapshot = createBuildSnapshot({
    buildState: {
      character: {
        class: input.className ?? "Unknown",
        ascendancy: input.ascendancy ?? null,
        level: 90,
      },
      loadoutContexts: [
        {
          contextId: "primary",
          primary: true,
          passiveTree: { allocatedNodes: [], masteryEffects: [] },
          equipment: [],
          skills: input.skills.map((s) => ({
            setupId: s.skillId,
            isMainSkill: s.isMainSkill ?? false,
            skillGemRef: s.skillId,
            socket: null,
            supports: [],
          })),
        },
      ],
      configuration: [],
      assumptions: [],
    },
    metadata: {
      patchVersion: "0.1.0",
      formatVersion: "1",
      provenance: { source: "test", importedAt: "2026-01-01T00:00:00.000Z" },
    },
    displayCache: { names, icons: {} },
  });

  const calc: CalculationView | undefined =
    input.defence !== undefined || input.resources !== undefined
      ? {
          primary: {
            ...(input.defence !== undefined ? { defence: input.defence } : {}),
            ...(input.resources !== undefined ? { resources: input.resources } : {}),
          },
        }
      : undefined;

  return calc !== undefined ? { snapshot, calc } : { snapshot };
}

/** A Twister Huntress: movement carried by a repeated attack skill. */
export function twisterSnapshot(): DetectionInput {
  return makeSnapshot({
    className: "Huntress",
    ascendancy: "Amazon",
    skills: [
      { skillId: "twister", displayName: "Twister", isMainSkill: true },
      { skillId: "blink", displayName: "Blink" },
    ],
    defence: { life: 3200, evasion: 6000, energyShield: 0, armour: 0 },
    resources: { unreservedMana: 120, mainSkillCost: 8 },
  });
}

/** A twister build with a non-primary decoy loadout at the FRONT (primary is second). */
export function twisterWithDecoyFirst(): DetectionInput {
  const snapshot = createBuildSnapshot({
    buildState: {
      character: { class: "Huntress", ascendancy: "Amazon", level: 90 },
      loadoutContexts: [
        {
          contextId: "decoy",
          primary: false,
          passiveTree: { allocatedNodes: [], masteryEffects: [] },
          equipment: [],
          skills: [{ setupId: "fireball", isMainSkill: true, skillGemRef: "fireball", socket: null, supports: [] }],
        },
        {
          contextId: "primary",
          primary: true,
          passiveTree: { allocatedNodes: [], masteryEffects: [] },
          equipment: [],
          skills: [
            { setupId: "twister", isMainSkill: true, skillGemRef: "twister", socket: null, supports: [] },
            { setupId: "blink", isMainSkill: false, skillGemRef: "blink", socket: null, supports: [] },
          ],
        },
      ],
      configuration: [],
      assumptions: [],
    },
    metadata: {
      patchVersion: "0.1.0",
      formatVersion: "1",
      provenance: { source: "test", importedAt: "2026-01-01T00:00:00.000Z" },
    },
    displayCache: { names: { twister: "Twister", blink: "Blink", fireball: "Fireball" }, icons: {} },
  });
  return { snapshot };
}

/** An energy-shield tank: ES is the dominant defensive layer. */
export function esTankSnapshot(): DetectionInput {
  return makeSnapshot({
    className: "Sorceress",
    ascendancy: "Chronomancer",
    skills: [{ skillId: "spark", displayName: "Spark", isMainSkill: true }],
    defence: { energyShield: 9000, life: 1200, armour: 500, evasion: 400 },
    resources: { unreservedMana: 200, mainSkillCost: 10 },
  });
}

/** A dash-loop mobility build: a spell attacker that traverses via dash loops. */
export function dashLoopSnapshot(): DetectionInput {
  return makeSnapshot({
    className: "Monk",
    ascendancy: "Invoker",
    skills: [
      { skillId: "fireball", displayName: "Fireball", isMainSkill: true },
      { skillId: "dash", displayName: "Dash" },
    ],
    defence: { life: 4000, evasion: 3000, energyShield: 800, armour: 0 },
    resources: { unreservedMana: 150, mainSkillCost: 12 },
  });
}

/** A plain hit-based caster with no special mobility or tank profile. */
export function plainCasterSnapshot(): DetectionInput {
  return makeSnapshot({
    className: "Witch",
    ascendancy: "Infernalist",
    skills: [{ skillId: "fireball", displayName: "Fireball", isMainSkill: true }],
    defence: { life: 4200, energyShield: 600, armour: 300, evasion: 200 },
    resources: { unreservedMana: 180, mainSkillCost: 15 },
  });
}

/** A minion commander: damage delivered by spirit-reserving minions. */
export function minionSnapshot(): DetectionInput {
  return makeSnapshot({
    className: "Witch",
    ascendancy: "Blood Mage",
    skills: [
      { skillId: "raise-skeletal-warrior", displayName: "Raise Skeletal Warrior", isMainSkill: true },
    ],
    defence: { life: 3800, energyShield: 500, armour: 200, evasion: 200 },
    resources: { unreservedSpirit: 20, reservedSpirit: 100, mainSkillCost: 0 },
  });
}

/** A DoT caster: damage delivered over time. */
export function dotCasterSnapshot(): DetectionInput {
  return makeSnapshot({
    className: "Witch",
    ascendancy: "Infernalist",
    skills: [{ skillId: "essence-drain", displayName: "Essence Drain", isMainSkill: true }],
    defence: { life: 4000, energyShield: 700, armour: 200, evasion: 300 },
    resources: { unreservedMana: 160, mainSkillCost: 20 },
  });
}
