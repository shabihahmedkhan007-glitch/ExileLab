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

    expect(snap.character).toEqual({
      className: "Witch",
      ascendancyName: "Infernalist",
      level: 88,
    });
    expect(snap.versioning).toEqual({
      gamePatch: "poe2-0.2.0",
      snapshotFormatVersion: SNAPSHOT_FORMAT_VERSION,
    });
    expect(snap.loadouts).toHaveLength(1);
    const lo = snap.loadouts[0]!;
    expect(lo.primary).toBe(true);
    expect(lo.passiveTree.allocatedNodeIds).toEqual([100, 300, 500]); // canonically sorted
    expect(lo.equipment[0]).toMatchObject({ slot: "Weapon 1", name: "Doomfire", rarity: "Unique" });
    expect(lo.skills[0]!.isMain).toBe(true);
    expect(lo.skills[0]!.gems[0]).toMatchObject({ name: "Fireball", level: 20, quality: 20 });
    expect(lo.configuration).toEqual({ enemyIsBoss: true });
    expect(lo.resources).toEqual({ manaReserved: 50 });

    expect(snap.provenance).toMatchObject({
      source: "native-json",
      reference: "friend-export",
      attribution: "Someone",
    });
    expect(snap.metadata).toEqual({ labels: ["hc"], league: "Standard" });

    // Full fidelity ⇒ no defaulted origins.
    const origins = new Set(snap.assumptions.map((x) => x.origin));
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

    expect(snap.character.className).toBe("Ranger");
    expect(snap.character.ascendancyName).toBe("Deadeye");
    expect(snap.character.level).toBe(92);

    const lo = snap.loadouts[0]!;
    expect(lo.passiveTree.allocatedNodeIds).toEqual([101, 202, 303]); // sorted
    expect(lo.equipment[0]).toMatchObject({ slot: "Weapon 1", name: "Storm Talon", rarity: "Rare" });

    // mainSocketGroup="2" ⇒ second group is main.
    expect(lo.skills).toHaveLength(2);
    expect(lo.skills[0]!.isMain).toBe(false);
    expect(lo.skills[1]!.isMain).toBe(true);
    expect(lo.skills[1]!.gems.map((g) => g.name)).toEqual(["Lightning Arrow", "Added Cold Damage"]);
  });

  it("is deterministic: two independent imports produce the same identity", () => {
    const s1 = normalize(new PobCodeImporter().import(makePobCode()));
    const s2 = normalize(new PobCodeImporter().import(makePobCode()));
    expect(s1.identity).toBe(s2.identity);
  });

  it("declares defaulted origins for fields it could not extract (game patch)", () => {
    const snap = normalize(new PobCodeImporter().import(makePobCode()));
    expect(snap.versioning.gamePatch).toBe(UNKNOWN_GAME_PATCH);
    const patchAssumption = snap.assumptions.find((x) => x.path === "versioning.gamePatch");
    expect(patchAssumption?.origin).toBe("defaulted");
    // At least one defaulted assumption must be present for an incomplete source.
    expect(snap.assumptions.some((x) => x.origin === "defaulted")).toBe(true);
  });

  it("records a caller-supplied patch as inferred rather than defaulted", () => {
    const snap = normalize(new PobCodeImporter().import(makePobCode()), { gamePatch: "poe2-0.2.0" });
    expect(snap.versioning.gamePatch).toBe("poe2-0.2.0");
    expect(snap.assumptions.find((x) => x.path === "versioning.gamePatch")?.origin).toBe("inferred");
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
    expect(snap.character).toEqual({ className: "Unknown", ascendancyName: null, level: 1 });
    expect(snap.loadouts).toHaveLength(1);
    expect(snap.loadouts[0]!.primary).toBe(true);
    expect(snap.versioning.gamePatch).toBe(UNKNOWN_GAME_PATCH);
    // Honesty: the sparse build is dominated by defaulted origins.
    expect(snap.assumptions.filter((x) => x.origin === "defaulted").length).toBeGreaterThan(0);
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
    const primaries = snap.loadouts.filter((l) => l.primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]!.id).toBe("a");
    expect(snap.assumptions.some((x) => x.path === "loadouts[0].primary" && x.origin === "inferred")).toBe(
      true,
    );
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
    expect(Object.isFrozen(snap.loadouts)).toBe(true);
    expect(Object.isFrozen(snap.character)).toBe(true);
  });
});
