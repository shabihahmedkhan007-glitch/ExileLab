// engine/benchmark/convert-fixture.ts
//
// Native-JSON → PoB2-XML fixture converter for the S1 engine benchmark (PRD §9.3
// spike 1, PRODUCT_PLAN Phase 0 S1). The benchmark driver (bench.lua) loads each
// build through the PoB2 fork's `Build:Load(xml)` path (HeadlessWrapper), which
// consumes PoB's *own* XML document format — NOT ExileLab's canonical model and
// NOT PoB's newer JSON payload. This module renders one native benchmark fixture
// into that XML so the engine can build it.
//
// WHY A CONVERTER AT ALL (honest framing):
//   - The 3 benchmark fixtures (melee / minion / DoT — PLAN Phase 0 task 6) are
//     stored as ExileLab-native JSON in research/fixtures/benchmark-builds/, in
//     the SAME build-state vocabulary as the canonical model (character, loadout
//     contexts, allocated nodes, equipment, skills, configuration). Storing them
//     native keeps the fixtures source-independent (RFC-0001 AD-6) and lets the
//     eventual conformance suite reuse them without a PoB dependency.
//   - PoB's headless entry consumes XML. So a translation step is unavoidable.
//     This is a benchmark-scoped, disposable spike converter (AD-6: "PoB payloads
//     may circulate freely ONLY inside disposable Phase 0 spikes") — production
//     import/normalization is build-normalizer's job and does NOT go through here.
//
// DECLARED GAPS (best-effort mapping — see also README §"convert-fixture gaps"):
//   G1  itemRef → item text. PoB items are freeform text blocks parsed by
//       ItemDB. We emit "Rarity / Name / Base" + raw `modifiers` lines verbatim.
//       Bases/names that ItemDB cannot resolve fall back to a generic base of the
//       declared item class; unresolved mods are ignored by the engine (logged by
//       PoB, not fatal). Exact stats therefore depend on the fixture author using
//       PoB-parseable mod text. This is acceptable for a *timing* benchmark (we
//       measure calc cost, not correctness — correctness is S2/conformance work).
//   G2  skillGemRef → <Gem>. PoB matches gems by `nameSpec`/`skillId`; we emit the
//       ref as `nameSpec` and let ItemDB resolve. Refs that are already PoB gem
//       ids resolve exactly; friendly names resolve if unambiguous.
//   G3  masteryEffects → the `masteryEffects` attr uses PoB's `{nodeId,effectId}`
//       encoding; we render it, but effect ids must already be PoB tree ids.
//   G4  tree version / targetVersion are taken from the fixture's `patchVersion`
//       via a small lookup; an unknown patch falls back to the pinned default and
//       is reported on stderr (the run is still valid for timing).
//   G5  config keys are mapped canonical→PoB via CONFIG_KEY_MAP; unmapped keys are
//       passed through unchanged and PoB ignores unknown Config Inputs.
//
// Deterministic and pure: same fixture in ⇒ byte-identical XML out (stable attr
// order, no timestamps). No network, no LLM (HARD RULES 1–2).

import { readFileSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Native benchmark fixture schema (self-contained; mirrors canonical build state
// vocabulary from RFC-0001 §5.3 but is intentionally decoupled so this converter
// typechecks with no workspace dependency).
// ---------------------------------------------------------------------------

export interface NativeItem {
  /** Canonical slot, e.g. "weapon1", "helmet", "ring1", "amulet". */
  readonly slot: string;
  /** Display name for the item (unique name or a rare's label). */
  readonly name: string;
  /** Item base type, e.g. "Advanced Dualstring Bow". */
  readonly base: string;
  /** "normal" | "magic" | "rare" | "unique". */
  readonly rarity: string;
  /** Rolled modifier lines, verbatim PoB-parseable text (see gap G1). */
  readonly modifiers: readonly string[];
}

export interface NativeSkill {
  /** True for the build's designated main skill (drives mainSocketGroup). */
  readonly isMain: boolean;
  /** Active skill gem reference (PoB gem id or friendly name — gap G2). */
  readonly skillGemRef: string;
  readonly level: number;
  readonly quality: number;
  /** Support gem references, in socket order. */
  readonly supports: readonly string[];
}

export interface NativeMasteryEffect {
  readonly nodeId: number;
  readonly effectId: number;
}

export interface NativeLoadout {
  readonly id: string;
  /** Exactly one loadout is primary (becomes the active spec/item/skill set). */
  readonly primary: boolean;
  /** Allocated passive node ids. */
  readonly allocatedNodes: readonly number[];
  readonly masteryEffects: readonly NativeMasteryEffect[];
  readonly items: readonly NativeItem[];
  readonly skills: readonly NativeSkill[];
}

export interface NativeBenchmarkBuild {
  /** Human label, e.g. "melee-warrior-slam". */
  readonly name: string;
  /** Archetype tag for reporting: "melee" | "minion" | "dot". */
  readonly archetype: string;
  /** Game patch, e.g. "0.2.0" — drives tree/targetVersion (gap G4). */
  readonly patchVersion: string;
  readonly character: {
    readonly className: string;
    readonly ascendancy: string | null;
    readonly level: number;
  };
  readonly loadouts: readonly NativeLoadout[];
  /** Calculation-context config: canonical key → value (mapped by CONFIG_KEY_MAP). */
  readonly config: Readonly<Record<string, string | number | boolean>>;
}

// ---------------------------------------------------------------------------
// Mapping tables (best-effort; declared gaps above).
// ---------------------------------------------------------------------------

/** Canonical patch → PoB `targetVersion` / tree `treeVersion` (gap G4). */
const PATCH_TO_TREE_VERSION: Readonly<Record<string, string>> = {
  '0.1.0': '0_1',
  '0.2.0': '0_2',
  '0.3.0': '0_3',
};
const DEFAULT_TREE_VERSION = '0_2';

/** Canonical slot → PoB `<Slot name>` (gap G1). */
const SLOT_NAME_MAP: Readonly<Record<string, string>> = {
  weapon1: 'Weapon 1',
  weapon2: 'Weapon 2',
  helmet: 'Helmet',
  bodyArmour: 'Body Armour',
  gloves: 'Gloves',
  boots: 'Boots',
  belt: 'Belt',
  amulet: 'Amulet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

/** Rarity → PoB item-text `Rarity:` token. */
const RARITY_MAP: Readonly<Record<string, string>> = {
  normal: 'NORMAL',
  magic: 'MAGIC',
  rare: 'RARE',
  unique: 'UNIQUE',
};

/** Canonical config key → PoB Config `<Input name>` (gap G5). */
const CONFIG_KEY_MAP: Readonly<Record<string, string>> = {
  'enemy.isBoss': 'enemyIsBoss',
  'enemy.level': 'enemyLevel',
  'enemy.isPinnacle': 'enemyIsPinnacleBoss',
  'player.hasPower': 'usePowerCharges',
  'player.hasFrenzy': 'useFrenzyCharges',
};

// ---------------------------------------------------------------------------
// XML rendering (deterministic; stable attribute order).
// ---------------------------------------------------------------------------

function xmlEscapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlEscapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function treeVersionFor(patch: string): string {
  const v = PATCH_TO_TREE_VERSION[patch];
  if (v === undefined) {
    process.stderr.write(
      `convert-fixture: WARN unknown patch "${patch}", falling back to tree ${DEFAULT_TREE_VERSION} (gap G4)\n`,
    );
    return DEFAULT_TREE_VERSION;
  }
  return v;
}

function renderItemText(item: NativeItem): string {
  const rarity = RARITY_MAP[item.rarity] ?? 'RARE';
  const lines = [`Rarity: ${rarity}`, item.name, item.base, ...item.modifiers];
  return lines.map(xmlEscapeText).join('\n');
}

function renderConfig(config: NativeBenchmarkBuild['config']): string {
  const inputs: string[] = [];
  for (const [rawKey, value] of Object.entries(config)) {
    const name = CONFIG_KEY_MAP[rawKey] ?? rawKey;
    let attr: string;
    if (typeof value === 'boolean') {
      attr = `boolean="${value ? 'true' : 'false'}"`;
    } else if (typeof value === 'number') {
      attr = `number="${value}"`;
    } else {
      attr = `string="${xmlEscapeAttr(value)}"`;
    }
    inputs.push(`\t\t<Input name="${xmlEscapeAttr(name)}" ${attr}/>`);
  }
  return inputs.join('\n');
}

/**
 * Render one native benchmark fixture into a PoB2 build XML document string.
 * Pure: identical input ⇒ identical output.
 */
export function nativeToPoBXml(build: NativeBenchmarkBuild): string {
  const primary = build.loadouts.find((l) => l.primary) ?? build.loadouts[0];
  if (primary === undefined) {
    throw new Error(`fixture "${build.name}" has no loadouts`);
  }
  const treeVersion = treeVersionFor(build.patchVersion);

  // Find the 1-based index of the main socket group (main skill).
  let mainSocketGroup = 1;
  primary.skills.forEach((s, i) => {
    if (s.isMain) mainSocketGroup = i + 1;
  });

  const ascend = build.character.ascendancy ?? 'None';

  // --- Skills ---
  const skillXml = primary.skills
    .map((s, i) => {
      const gems = [
        `\t\t\t<Gem enabled="true" nameSpec="${xmlEscapeAttr(s.skillGemRef)}" level="${s.level}" quality="${s.quality}"/>`,
        ...s.supports.map(
          (sup) =>
            `\t\t\t<Gem enabled="true" nameSpec="${xmlEscapeAttr(sup)}" level="20" quality="0"/>`,
        ),
      ].join('\n');
      return (
        `\t\t<Skill mainActiveSkill="${s.isMain ? i + 1 : 'nil'}" enabled="true" label="">\n` +
        `${gems}\n` +
        `\t\t</Skill>`
      );
    })
    .join('\n');

  // --- Items + item set ---
  const itemXml = primary.items
    .map((it, i) => `\t\t<Item id="${i + 1}">${renderItemText(it)}</Item>`)
    .join('\n');
  const slotXml = primary.items
    .map((it, i) => {
      const slotName = SLOT_NAME_MAP[it.slot] ?? it.slot;
      return `\t\t\t<Slot name="${xmlEscapeAttr(slotName)}" itemId="${i + 1}"/>`;
    })
    .join('\n');

  // --- Tree spec ---
  const nodes = [...primary.allocatedNodes].sort((a, b) => a - b).join(',');
  const mastery = primary.masteryEffects
    .map((m) => `{${m.nodeId},${m.effectId}}`)
    .join(',');

  const configXml = renderConfig(build.config);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<PathOfBuilding>\n` +
    `\t<Build level="${build.character.level}" targetVersion="${treeVersion}" ` +
    `className="${xmlEscapeAttr(build.character.className)}" ` +
    `ascendClassName="${xmlEscapeAttr(ascend)}" ` +
    `mainSocketGroup="${mainSocketGroup}"/>\n` +
    `\t<Import/>\n` +
    `\t<Skills activeSkillSet="1">\n` +
    `\t\t<SkillSet id="1">\n` +
    `${skillXml}\n` +
    `\t\t</SkillSet>\n` +
    `\t</Skills>\n` +
    `\t<Tree activeSpec="1">\n` +
    `\t\t<Spec treeVersion="${treeVersion}" nodes="${nodes}" masteryEffects="${xmlEscapeAttr(mastery)}"/>\n` +
    `\t</Tree>\n` +
    `\t<Items activeItemSet="1">\n` +
    `${itemXml}\n` +
    `\t\t<ItemSet id="1">\n` +
    `${slotXml}\n` +
    `\t\t</ItemSet>\n` +
    `\t</Items>\n` +
    `\t<Config>\n` +
    `${configXml}\n` +
    `\t</Config>\n` +
    `</PathOfBuilding>\n`
  );
}

/** Minimal shape validation so a malformed fixture fails loudly, not silently. */
function assertNativeBuild(value: unknown): asserts value is NativeBenchmarkBuild {
  if (typeof value !== 'object' || value === null) {
    throw new Error('fixture is not a JSON object');
  }
  const b = value as Record<string, unknown>;
  if (typeof b['name'] !== 'string') throw new Error('fixture.name must be a string');
  if (typeof b['patchVersion'] !== 'string') {
    throw new Error('fixture.patchVersion must be a string');
  }
  if (typeof b['character'] !== 'object' || b['character'] === null) {
    throw new Error('fixture.character must be an object');
  }
  if (!Array.isArray(b['loadouts']) || b['loadouts'].length === 0) {
    throw new Error('fixture.loadouts must be a non-empty array');
  }
}

/**
 * CLI: `tsx convert-fixture.ts <input.json> [output.xml]`
 * Reads a native fixture, prints (or writes) the PoB2 XML. Exit 1 on error.
 */
function main(argv: readonly string[]): void {
  const [inputPath, outputPath] = argv;
  if (inputPath === undefined) {
    process.stderr.write('usage: tsx convert-fixture.ts <input.json> [output.xml]\n');
    process.exit(1);
  }
  const raw = readFileSync(inputPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  assertNativeBuild(parsed);
  const xml = nativeToPoBXml(parsed);
  if (outputPath === undefined) {
    process.stdout.write(xml);
  } else {
    writeFileSync(outputPath, xml, 'utf8');
    process.stderr.write(`convert-fixture: wrote ${outputPath}\n`);
  }
}

// Only run as a CLI when invoked directly (keeps the module import-safe for tests).
const invokedPath = process.argv[1] ?? '';
if (invokedPath.replace(/\\/g, '/').endsWith('convert-fixture.ts')) {
  main(process.argv.slice(2));
}
