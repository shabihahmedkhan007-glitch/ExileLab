import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import {
  NativeJsonImporter,
  PobCodeImporter,
  encodePobCode,
  detectSource,
  importAny,
  normalize,
  ImportError,
  UnknownSourceError,
  NormalizeError,
  SNAPSHOT_FORMAT_VERSION,
  UNKNOWN_GAME_PATCH,
  NATIVE_FORMAT_TAG,
  type NativeInterchange,
  type RawImportArtifact,
} from "./index.js";

// The normalizer now emits @exilelab/core's canonical BuildSnapshot directly:
//   snap.buildState.{character,loadoutContexts,configuration,assumptions}
//   snap.metadata.{patchVersion,formatVersion,provenance,label,league}
//   snap.displayCache.{names,icons}   snap.identity (core Canonical Identity)

// --- Fixtures -------------------------------------------------------------

const POB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="92" className="Ranger" ascendClassName="Deadeye" mainSocketGroup="2">
    <PlayerStat stat="Life" value="4200"/>
  </Build>
  <Skills activeSkillSet="1">
    <SkillSet id="1">
      <Skill>
        <Gem nameSpec="Herald of Thunder" skillId="HeraldOfThunder" level="20" quality="0"/>
      </Skill>
      <Skill>
        <Gem nameSpec="Lightning Arrow" skillId="LightningArrow" level="20" quality="20"/>
        <Gem nameSpec="Added Cold Damage" skillId="SupportAddedCold" level="20" quality="0"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="1">
    <Spec title="Main" nodes="303,101,202">
      <URL>https://example.invalid/tree</URL>
    </Spec>
  </Tree>
  <Items activeItemSet="1">
    <Item id="1">
Rarity: Rare
Storm Talon
Spine Bow
Adds 1 to 2 Lightning Damage
    </Item>
    <ItemSet id="1">
      <Slot name="Weapon 1" itemId="1"/>
    </ItemSet>
  </Items>
</PathOfBuilding>`;

function makePobCode(xml = POB_XML): string {
  return encodePobCode(xml, (buf) => deflateSync(buf));
}

const NATIVE_BUILD: NativeInterchange = {
  format: NATIVE_FORMAT_TAG,
  formatVersion: 1,
  gamePatch: "poe2-0.2.0",
  character: { className: "Witch", ascendancyName: "Infernalist", level: 88 },
  loadouts: [
    {
      id: "set-a",
      name: "Primary",
      primary: true,
      allocatedNodeIds: [500, 100, 300],
      items: [
        { id: "w1", slot: "Weapon 1", name: "Doomfire", rarity: "Unique", lines: ["+1 Fire"] },
      ],
      skills: [
        {
          id: "sg1",
          isMain: true,
          gems: [{ name: "Fireball", skillId: "Fireball", level: 20, quality: 20 }],
        },
      ],
      configuration: { enemyIsBoss: true },
      resources: { manaReserved: 50 },
    },
  ],
  provenance: { reference: "friend-export", attribution: "Someone" },
  metadata: { labels: ["hc"], league: "Standard" },
};

// --- detectSource routing -------------------------------------------------

describe("detectSource", () => {
  it("routes native JSON to the native importer", () => {
    const input = JSON.stringify(NATIVE_BUILD);
    expect(detectSource(input)).toBeInstanceOf(NativeJsonImporter);
  });

  it("routes a PoB share code to the PoB importer", () => {
    expect(detectSource(makePobCode())).toBeInstanceOf(PobCodeImporter);
  });

  it("returns null for unrecognised text", () => {
    expect(detectSource("just some pasted words, not a build")).toBeNull();
    expect(detectSource("")).toBeNull();
  });

  it("does not misroute plain JSON that is not the interchange format", () => {
    expect(detectSource(JSON.stringify({ hello: "world" }))).toBeNull();
  });
});

// --- Native JSON: full fidelity ------------------------------------------

describe("NativeJsonImporter + normalize (full fidelity)", () => {
  it("preserves all provided fields as imported", () => {
    const artifact = new NativeJsonImporter().import(JSON.stringify(NATIVE_BUILD));
    const snap = normalize(artifact);

    expect(snap.buildState.character).toEqual({
      class: "Witch",
      ascendancy: "Infernalist",
      level: 88,
    });
    expect(snap.metadata.patchVersion).toBe("poe2-0.2.0");
    expect(snap.metadata.formatVersion).toBe(String(SNAPSHOT_FORMAT_VERSION));

    expect(snap.buildState.loadoutContexts).toHaveLength(1);
    const lo = snap.buildState.loadoutContexts[0]!;
    expect(lo.primary).toBe(true);
    expect(lo.passiveTree.allocatedNodes).toEqual([100, 300, 500]); // canonically sorted
    expect(lo.equipment[0]).toMatchObject({ slot: "Weapon 1", itemRef: "Doomfire", rarity: "Unique" });
    expect(lo.skills[0]!.isMainSkill).toBe(true);
    expect(lo.skills[0]!.skillGemRef).toBe("Fireball");

    // Configuration is build-state (RFC-0001 §5.3), lifted from the primary loadout.
    expect(snap.buildState.configuration).toEqual([{ key: "enemyIsBoss", value: true }]);

    expect(snap.metadata.provenance).toMatchObject({
      source: "native-json",
      reference: "friend-export",
      attribution: "Someone",
    });
    expect(snap.metadata.label).toBe("hc");
    expect(snap.metadata.league).toBe("Standard");

    // Display Cache maps game-data refs → display names (rendering only, AD-3).
    expect(snap.displayCache.names["Fireball"]).toBe("Fireball");

    // Full fidelity ⇒ no defaulted origins.
    const origins = new Set(snap.buildState.assumptions.map((x) => x.origin));
    expect(origins.has("defaulted")).toBe(false);
    expect(origins.has("imported")).toBe(true);
  });

  it("re-importing the same native payload yields the same identity", () => {
    const a = normalize(new NativeJsonImporter().import(JSON.stringify(NATIVE_BUILD)));
    const b = normalize(new NativeJsonImporter().import(JSON.stringify(NATIVE_BUILD)));
    expect(a.identity).toBe(b.identity);
  });
});

// --- PoB round-trip -------------------------------------------------------

describe("PobCodeImporter + normalize (round-trip)", () => {
  it("extracts core fields from a synthetic deflated+base64 PoB code", () => {
    const artifact = new PobCodeImporter().import(makePobCode());
    const snap = normalize(artifact);

    expect(snap.buildState.character.class).toBe("Ranger");
    expect(snap.buildState.character.ascendancy).toBe("Deadeye");
    expect(snap.buildState.character.level).toBe(92);

    const lo = snap.buildState.loadoutContexts[0]!;
    expect(lo.passiveTree.allocatedNodes).toEqual([101, 202, 303]); // sorted
    expect(lo.equipment[0]).toMatchObject({ slot: "Weapon 1", itemRef: "Storm Talon", rarity: "Rare" });

    // mainSocketGroup="2" ⇒ second group is main.
    expect(lo.skills).toHaveLength(2);
    expect(lo.skills[0]!.isMainSkill).toBe(false);
    expect(lo.skills[1]!.isMainSkill).toBe(true);
    // Active gem → skillGemRef; linked supports → supports (refs are skillIds).
    expect(lo.skills[1]!.skillGemRef).toBe("LightningArrow");
    expect(lo.skills[1]!.supports).toEqual(["SupportAddedCold"]);
    // Display names ride along in the Display Cache.
    expect(snap.displayCache.names["LightningArrow"]).toBe("Lightning Arrow");
    expect(snap.displayCache.names["SupportAddedCold"]).toBe("Added Cold Damage");
  });

  it("is deterministic: two independent imports produce the same identity", () => {
    const s1 = normalize(new PobCodeImporter().import(makePobCode()));
    const s2 = normalize(new PobCodeImporter().import(makePobCode()));
    expect(s1.identity).toBe(s2.identity);
  });

  it("declares defaulted origins for fields it could not extract (game patch)", () => {
    const snap = normalize(new PobCodeImporter().import(makePobCode()));
    expect(snap.metadata.patchVersion).toBe(UNKNOWN_GAME_PATCH);
    const patchAssumption = snap.buildState.assumptions.find((x) => x.path === "versioning.gamePatch");
    expect(patchAssumption?.origin).toBe("defaulted");
    // At least one defaulted assumption must be present for an incomplete source.
    expect(snap.buildState.assumptions.some((x) => x.origin === "defaulted")).toBe(true);
  });

  it("records a caller-supplied patch as inferred rather than defaulted", () => {
    const snap = normalize(new PobCodeImporter().import(makePobCode()), { gamePatch: "poe2-0.2.0" });
    expect(snap.metadata.patchVersion).toBe("poe2-0.2.0");
    expect(
      snap.buildState.assumptions.find((x) => x.path === "versioning.gamePatch")?.origin,
    ).toBe("inferred");
  });
});

// --- Identity semantics (RFC-0001 I2) ------------------------------------

describe("Canonical Identity", () => {
  it("excludes metadata and import time from identity", () => {
    const base = new NativeJsonImporter().import(JSON.stringify(NATIVE_BUILD));
    const withDifferentMeta: RawImportArtifact = {
      ...base,
      receivedAt: "2000-01-01T00:00:00.000Z",
      ref: "different-ref",
      extracted: {
        ...base.extracted,
        metadata: { labels: ["totally-different"], league: "Hardcore" },
      },
    };
    const a = normalize(base);
    const b = normalize(withDifferentMeta);
    expect(a.identity).toBe(b.identity);
    expect(a.metadata).not.toEqual(b.metadata); // sanity: they really differ
  });

  it("changes identity when build state changes", () => {
    const changed: NativeInterchange = {
      ...NATIVE_BUILD,
      character: { ...NATIVE_BUILD.character, level: 89 },
    };
    const a = normalize(new NativeJsonImporter().import(JSON.stringify(NATIVE_BUILD)));
    const b = normalize(new NativeJsonImporter().import(JSON.stringify(changed)));
    expect(a.identity).not.toBe(b.identity);
  });
});

// --- Defaulting when source is sparse ------------------------------------

describe("normalize defaulting", () => {
  it("fills missing build state with declared defaults instead of throwing", () => {
    const sparse: RawImportArtifact = {
      source: "native-json",
      ref: "sparse-1",
      receivedAt: new Date().toISOString(),
      payload: "{}",
      extracted: {},
      gaps: [],
    };
    const snap = normalize(sparse);
    expect(snap.buildState.character).toEqual({ class: "Unknown", ascendancy: null, level: 1 });
    expect(snap.buildState.loadoutContexts).toHaveLength(1);
    expect(snap.buildState.loadoutContexts[0]!.primary).toBe(true);
    expect(snap.metadata.patchVersion).toBe(UNKNOWN_GAME_PATCH);
    // Honesty: the sparse build is dominated by defaulted origins.
    expect(snap.buildState.assumptions.filter((x) => x.origin === "defaulted").length).toBeGreaterThan(0);
  });

  it("infers a single primary loadout when none is flagged", () => {
    const artifact: RawImportArtifact = {
      source: "native-json",
      ref: "multi-1",
      receivedAt: new Date().toISOString(),
      payload: "",
      extracted: {
        character: { className: "Monk", level: 40 },
        loadouts: [{ id: "a" }, { id: "b" }],
      },
      gaps: [],
    };
    const snap = normalize(artifact);
    const primaries = snap.buildState.loadoutContexts.filter((l) => l.primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]!.contextId).toBe("a");
    expect(
      snap.buildState.assumptions.some((x) => x.path === "loadouts[0].primary" && x.origin === "inferred"),
    ).toBe(true);
  });
});

// --- Error handling (never crash on malformed input) ----------------------

describe("malformed input", () => {
  it("importAny throws UnknownSourceError for arbitrary text", () => {
    expect(() => importAny("this is not a build at all")).toThrow(UnknownSourceError);
  });

  it("native importer throws ImportError on invalid JSON that claims the tag", () => {
    const broken = '{ "format": "exilelab-build", '; // truncated JSON
    // detect() returns false (unparseable), so it must be imported explicitly to hit the parse error.
    expect(() => new NativeJsonImporter().import(broken)).toThrow(ImportError);
  });

  it("native importer throws ImportError when schema validation fails", () => {
    const bad = JSON.stringify({ format: NATIVE_FORMAT_TAG, formatVersion: 1 }); // missing fields
    expect(() => new NativeJsonImporter().import(bad)).toThrow(ImportError);
  });

  it("PoB importer throws ImportError on a non-decodable code", () => {
    expect(() => new PobCodeImporter().import("!!!not base64!!!")).toThrow(ImportError);
  });

  it("PoB importer throws ImportError when decoded bytes are not inflatable", () => {
    const notDeflated = Buffer.from("plain text, not zlib", "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(() => new PobCodeImporter().import(notDeflated)).toThrow(ImportError);
  });

  it("accepts a share code surrounded by junk lines (the paste box accepts anything)", () => {
    // Real-world paste: comment/preamble lines around the code (e.g. the
    // synthetic fixture's own '#' header, or a Discord message). The importer
    // must find and decode the code line.
    const surrounded = [
      "# here's my build, roast it",
      "",
      makePobCode(),
      "thanks!",
    ].join("\n");
    expect(detectSource(surrounded)).toBeInstanceOf(PobCodeImporter);
    const snap = normalize(new PobCodeImporter().import(surrounded));
    expect(snap.buildState.character.class).toBe("Ranger");
  });

  it("PoB importer rejects a decompression bomb instead of inflating it (DoS guard)", () => {
    // ~100 MiB of zeros deflates to ~100 KiB — a classic zip bomb. The importer
    // must refuse (typed error / detect=false), never allocate the inflated buffer.
    const bomb = deflateSync(Buffer.alloc(100 * 1024 * 1024))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const importer = new PobCodeImporter();
    expect(importer.detect(bomb)).toBe(false);
    expect(() => importer.import(bomb)).toThrow(ImportError);
    // And through the front door the paste box uses:
    expect(() => importAny(bomb)).toThrow(UnknownSourceError);
  });

  it("normalize throws NormalizeError for a non-object artifact", () => {
    // Deliberately violate the type contract to exercise the guard.
    expect(() => normalize(null as unknown as RawImportArtifact)).toThrow(NormalizeError);
  });

  it("errors carry stable machine-readable codes", () => {
    try {
      importAny("nonsense");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownSourceError);
      expect((e as UnknownSourceError).code).toBe("unknown_source");
    }
  });
});

// --- Immutability (RFC-0001 I1) ------------------------------------------

describe("immutability", () => {
  it("returns a deeply frozen snapshot", () => {
    const snap = normalize(new NativeJsonImporter().import(JSON.stringify(NATIVE_BUILD)));
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.buildState.loadoutContexts)).toBe(true);
    expect(Object.isFrozen(snap.buildState.character)).toBe(true);
  });
});
