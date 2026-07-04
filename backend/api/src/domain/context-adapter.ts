// Adapter: core BuildSnapshot -> the structural slice the Context Detector reads.
//
// The Context Detector (RFC-0001 §8.1, source-blind consumer) declares its own
// structural BuildSnapshot view — only the fields it needs. Core's canonical
// snapshot carries build state but NOT engine-derived defence/resource numbers
// (those live in Calculation Results, AD-7), so this view omits them; archetype
// detection then keys off skill mechanics, which is sufficient for the launch
// rules table.

import type { BuildSnapshot as CoreSnapshot } from "@exilelab/core";
import type { BuildSnapshot as DetectorSnapshot } from "@exilelab/context-detector";

export function toDetectorSnapshot(snap: CoreSnapshot): DetectorSnapshot {
  const bs = snap.buildState;
  const names = snap.displayCache.names;
  return {
    snapshotFormatVersion: snap.metadata.formatVersion,
    gamePatch: snap.metadata.patchVersion,
    character: {
      ...(bs.character.class ? { className: bs.character.class } : {}),
      ...(bs.character.ascendancy !== null
        ? { ascendancy: bs.character.ascendancy }
        : {}),
      level: bs.character.level,
    },
    loadouts: bs.loadoutContexts.map((lc) => ({
      id: lc.contextId,
      isPrimary: lc.primary,
      skills: lc.skills.map((s) => {
        const skillId = s.skillGemRef ?? s.setupId;
        const displayName = names[skillId];
        return {
          skillId,
          ...(displayName !== undefined ? { displayName } : {}),
          isMainSkill: s.isMainSkill,
        };
      }),
    })),
  };
}
