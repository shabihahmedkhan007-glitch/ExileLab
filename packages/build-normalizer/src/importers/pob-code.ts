// PobCodeImporter — accepts a Path-of-Building-style share code: URL-safe base64
// of a zlib-deflated XML document. It parses DEFENSIVELY for core fields
// (class, level, allocated node ids, items, skills) and DECLARES what it could not
// extract as gaps, rather than silently guessing (RFC-0001 I3/I4). No network:
// the code is decoded and inflated locally with node:zlib only.

import { inflateSync } from "node:zlib";
import { ImportError } from "../errors.js";
import { findAll, findFirst, parseXml, type XmlElement } from "../xml.js";
import type { Importer } from "./importer.js";
import type {
  ExtractedBuild,
  ExtractedItem,
  ExtractedLoadout,
  ExtractedSkillGroup,
  RawImportArtifact,
} from "../raw-import-artifact.js";

/** Encode XML → PoB-style share code (url-safe base64 of zlib deflate). Test/export helper. */
export function encodePobCode(xml: string, deflate: (buf: Buffer) => Buffer): string {
  const compressed = deflate(Buffer.from(xml, "utf8"));
  return compressed
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Decompression bomb guards: share codes reach this importer from untrusted
 * paste input (POST /import routes every paste through detect()). Real PoB
 * build XMLs are tens of KB; a small crafted deflate stream can otherwise
 * inflate to GBs synchronously on the event loop. Both caps are deliberately
 * generous.
 */
const MAX_CODE_LENGTH = 4 * 1024 * 1024; // 4 MiB of base64 text
const MAX_INFLATED_BYTES = 8 * 1024 * 1024; // 8 MiB of decoded XML

/** Minimum plausible length for a share-code line (real codes are hundreds of chars). */
const MIN_CODE_LINE_LENGTH = 40;

/** Decode one candidate code string, or null. */
function decodeCandidate(candidate: string): string | null {
  const normalized = candidate
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  if (normalized.length === 0) return null;
  // Reject anything with characters outside the base64 alphabet.
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) return null;
  try {
    const bytes = Buffer.from(normalized, "base64");
    if (bytes.length === 0) return null;
    // maxOutputLength makes zlib throw (caught below) instead of allocating
    // an unbounded buffer for a decompression bomb.
    const xml = inflateSync(bytes, { maxOutputLength: MAX_INFLATED_BYTES }).toString("utf8");
    return xml.length > 0 ? xml : null;
  } catch {
    return null;
  }
}

/**
 * Decode a share code back to XML text, or null if it is not a valid code.
 *
 * PASTE TOLERANCE ("the paste box accepts anything", UX §3): people paste codes
 * surrounded by junk — Discord preamble, "here's my build:", comment lines. If
 * the input as a whole is not a code, each individual line that LOOKS like one
 * (long, pure base64url) is tried; the first line that decodes to XML wins.
 * Strictness is preserved: whatever is tried must still inflate under the bomb
 * cap AND (for detect) contain PoB marker tags.
 */
function tryDecode(input: string): string | null {
  if (input.length > MAX_CODE_LENGTH) return null;
  const whole = decodeCandidate(input.trim());
  if (whole !== null) return whole;

  for (const line of input.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length < MIN_CODE_LINE_LENGTH) continue;
    if (!/^[A-Za-z0-9+/=_-]+$/.test(t)) continue;
    const xml = decodeCandidate(t);
    if (xml !== null) return xml;
  }
  return null;
}

function parseIntOrNull(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseNodeList(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

let pobCounter = 0;

export class PobCodeImporter implements Importer {
  readonly source = "pob-code" as const;

  detect(input: string): boolean {
    const xml = tryDecode(input);
    if (xml === null) return false;
    // A PoB document is recognisable by its root/marker tags.
    return /<\s*PathOfBuilding|<\s*Build\b/i.test(xml);
  }

  import(input: string): RawImportArtifact {
    const receivedAt = new Date().toISOString();
    const xml = tryDecode(input);
    if (xml === null) {
      throw new ImportError(
        this.source,
        "input is not a decodable PoB share code (base64 + zlib inflate failed)",
      );
    }
    const root = parseXml(xml);
    if (root === null) {
      throw new ImportError(this.source, "decoded payload contained no XML elements");
    }

    const gaps: string[] = [];

    // --- Character (class, ascendancy, level) ---
    const buildEl = findFirst(root, "Build");
    const className = buildEl?.attributes["className"];
    const ascendClassName = buildEl?.attributes["ascendClassName"];
    const level = parseIntOrNull(buildEl?.attributes["level"]);
    if (className === undefined) gaps.push("character.className");
    if (level === null) gaps.push("character.level");

    // --- Passive tree (allocated node ids) ---
    const specs = findAll(root, "Spec");
    const activeSpecIdx = parseIntOrNull(findFirst(root, "Tree")?.attributes["activeSpec"]);
    const chosenSpec =
      (activeSpecIdx !== null ? specs[activeSpecIdx - 1] : undefined) ?? specs[0];
    const allocatedNodeIds = parseNodeList(chosenSpec?.attributes["nodes"]);
    if (allocatedNodeIds.length === 0) gaps.push("loadouts.0.passiveTree.allocatedNodeIds");

    // --- Items + slot mapping ---
    const itemEls = findAll(root, "Item");
    const slotByItemId = new Map<string, string>();
    for (const slot of findAll(root, "Slot")) {
      const itemId = slot.attributes["itemId"];
      const name = slot.attributes["name"];
      if (itemId !== undefined && name !== undefined) slotByItemId.set(itemId, name);
    }
    const items: ExtractedItem[] = itemEls.map((el, idx) => {
      const id = el.attributes["id"] ?? String(idx + 1);
      const lines = el.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      // PoB item text: first "Rarity: X" line, then name, then base type.
      const rarityLine = lines.find((l) => /^rarity:/i.test(l));
      const rarity = rarityLine ? rarityLine.replace(/^rarity:\s*/i, "").trim() : undefined;
      const nameIdx = rarityLine ? lines.indexOf(rarityLine) + 1 : 0;
      const name = lines[nameIdx];
      const slot = slotByItemId.get(id);
      return {
        id,
        ...(slot !== undefined ? { slot } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(rarity !== undefined ? { rarity } : {}),
        lines,
      };
    });
    if (slotByItemId.size === 0 && items.length > 0) gaps.push("loadouts.0.items[].slot");

    // --- Skills (groups, gems, main designation) ---
    const activeSkillSetIdx = parseIntOrNull(findFirst(root, "Skills")?.attributes["activeSkillSet"]);
    const skillSets = findAll(root, "SkillSet");
    const chosenSet =
      (activeSkillSetIdx !== null ? skillSets[activeSkillSetIdx - 1] : undefined) ??
      skillSets[0] ??
      findFirst(root, "Skills");
    const skillEls = chosenSet ? chosenSet.children.filter((c) => c.name === "Skill") : [];
    const mainSocketGroup = parseIntOrNull(buildEl?.attributes["mainSocketGroup"]);
    const skills: ExtractedSkillGroup[] = skillEls.map((skillEl, idx) => {
      const gems = findAll(skillEl, "Gem").map((g) => {
        const name = g.attributes["nameSpec"] ?? g.attributes["name"];
        const skillId = g.attributes["skillId"];
        const gemLevel = parseIntOrNull(g.attributes["level"]);
        const quality = parseIntOrNull(g.attributes["quality"]);
        return {
          ...(name !== undefined ? { name } : {}),
          ...(skillId !== undefined ? { skillId } : {}),
          ...(gemLevel !== null ? { level: gemLevel } : {}),
          ...(quality !== null ? { quality } : {}),
        };
      });
      return {
        id: `group-${idx + 1}`,
        isMain: mainSocketGroup !== null ? idx + 1 === mainSocketGroup : false,
        gems,
      };
    });
    if (mainSocketGroup === null && skills.length > 0) gaps.push("loadouts.0.skills[].isMain");

    const loadout: ExtractedLoadout = {
      id: "primary",
      primary: true,
      allocatedNodeIds,
      items,
      skills,
    };

    const extracted: ExtractedBuild = {
      character: {
        ...(className !== undefined ? { className } : {}),
        ...(ascendClassName !== undefined ? { ascendancyName: ascendClassName } : {}),
        ...(level !== null ? { level } : {}),
      },
      loadouts: [loadout],
    };

    // PoB codes never carry an ExileLab game patch or provenance reference.
    gaps.push("versioning.gamePatch");

    pobCounter += 1;
    return {
      source: this.source,
      ref: `raw-pob-${receivedAt}-${pobCounter}`,
      receivedAt,
      payload: input,
      extracted,
      gaps,
    };
  }
}
