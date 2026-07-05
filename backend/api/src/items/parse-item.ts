// Defensive PoE-style item-text parser for the Compare/Tune "paste an item"
// affordance (POST /builds/:id/itemswap).
//
// It reuses the conventions the build-normalizer's PoB item handling relies on
// (a leading "Rarity:" line, then the item name, then the base type, then the
// rolled modifier lines). It is intentionally SMALL and DEFENSIVE: it recognises
// an item only by the Rarity marker and rejects anything else with a typed error,
// so garbage paste input becomes a clean 422 rather than a wrong swap.
//
// No engine math here — it produces a canonical EquipmentItem; the caller builds
// a swapItem BuildMutation and hands it to the EngineAdapter (the sole calculator).

import type { EquipmentItem } from "@exilelab/core";

/** Thrown when the pasted text is not recognisable PoE item text. */
export class ItemParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemParseError";
  }
}

/** The parsed, source-independent view returned to the client (UX §4.4). */
export interface ParsedItem {
  readonly name: string;
  readonly rarity: string;
  readonly slot: string;
  readonly modifiers: string[];
}

/** Section separators PoE inserts between blocks (e.g. "--------"). */
function isSeparator(line: string): boolean {
  return /^-{3,}$/.test(line);
}

/**
 * Metadata lines that are NOT rolled modifiers (requirements, sockets, item
 * level, quality, class header, flavour). Excluded from the modifier list so the
 * engine's mod-count reflects real affixes, not bookkeeping.
 */
function isMetadataLine(line: string): boolean {
  return /^(Item Class|Rarity|Requirements?|Level|Str|Dex|Int|Sockets?|Item Level|Quality|Corrupted|Unidentified|Note):/i.test(
    line,
  );
}

/** Infer a canonical equipment slot from an item's base type / class keywords. */
function inferSlot(baseType: string, itemClassLine: string | undefined): string {
  const hay = `${itemClassLine ?? ""} ${baseType}`.toLowerCase();
  const table: ReadonlyArray<[RegExp, string]> = [
    [/boot|greave|slipper/, "Boots"],
    [/glove|gauntlet|mitt/, "Gloves"],
    [/helm|hood|mask|crown|circlet|hat|cap/, "Helmet"],
    [/body|chest|plate|armour|robe|garb|vest|jacket|tunic/, "Body Armour"],
    [/belt|sash/, "Belt"],
    [/amulet|talisman|pendant/, "Amulet"],
    [/ring|band|loop/, "Ring 1"],
    [/quiver/, "Quiver"],
    [/shield|buckler/, "Weapon 2"],
    [/bow|wand|staff|sword|axe|mace|dagger|claw|sceptre|spear|flail|crossbow|weapon/, "Weapon 1"],
  ];
  for (const [re, slot] of table) if (re.test(hay)) return slot;
  return "Body Armour"; // safe default: a real, calc-affecting slot
}

/**
 * Parse PoE-style item text into a canonical {@link EquipmentItem}. Throws
 * {@link ItemParseError} on anything that is not recognisable item text.
 */
export function parseItemText(itemText: string): {
  parsed: ParsedItem;
  item: EquipmentItem;
} {
  if (typeof itemText !== "string" || itemText.trim().length === 0) {
    throw new ItemParseError("item text is empty");
  }
  const lines = itemText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rarityIdx = lines.findIndex((l) => /^rarity:/i.test(l));
  if (rarityIdx === -1) {
    throw new ItemParseError(
      "no 'Rarity:' line found — paste the full item text (right-click → Copy Item in game)",
    );
  }
  const rarity = lines[rarityIdx]!.replace(/^rarity:\s*/i, "").trim().toLowerCase();
  if (rarity.length === 0) throw new ItemParseError("the 'Rarity:' line has no value");

  const name = lines[rarityIdx + 1];
  if (name === undefined || isSeparator(name) || isMetadataLine(name)) {
    throw new ItemParseError("no item name follows the 'Rarity:' line");
  }
  // The base type is the next non-separator line after the name, when present.
  let baseType = "";
  const afterName = lines[rarityIdx + 2];
  if (afterName !== undefined && !isSeparator(afterName) && !isMetadataLine(afterName)) {
    baseType = afterName;
  }

  const itemClassLine = lines.find((l) => /^item class:/i.test(l));
  const slot = inferSlot(baseType || name, itemClassLine);

  // Rolled modifiers: every remaining substantive line after name/base, skipping
  // separators and metadata bookkeeping.
  const consumed = new Set<number>([rarityIdx, rarityIdx + 1]);
  if (baseType) consumed.add(rarityIdx + 2);
  const modifiers: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i]!;
    if (isSeparator(line) || isMetadataLine(line)) continue;
    modifiers.push(line);
  }

  const parsed: ParsedItem = { name, rarity, slot, modifiers };
  const item: EquipmentItem = {
    slot,
    itemRef: name,
    rarity,
    modifiers: [...modifiers],
  };
  return { parsed, item };
}
