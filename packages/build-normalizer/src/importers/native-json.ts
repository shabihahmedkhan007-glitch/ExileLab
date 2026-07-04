// NativeJsonImporter — the reliable, full-fidelity path. Accepts the documented
// ExileLab JSON interchange format (defined + zod-validated below). Because this
// format is ExileLab's own, everything it carries is treated as `imported` by the
// normalizer; there are no declared gaps unless the author omits optional data.

import { z } from "zod";
import { ImportError } from "../errors.js";
import type { Importer } from "./importer.js";
import type {
  ExtractedBuild,
  ExtractedLoadout,
  RawImportArtifact,
} from "../raw-import-artifact.js";

/** Discriminator every native payload must carry at the top level. */
export const NATIVE_FORMAT_TAG = "exilelab-build" as const;

const scalar = z.union([z.string(), z.number(), z.boolean()]);

const gemSchema = z.object({
  name: z.string(),
  skillId: z.string().optional(),
  level: z.number().optional(),
  quality: z.number().optional(),
});

const skillGroupSchema = z.object({
  id: z.string().optional(),
  isMain: z.boolean().optional(),
  gems: z.array(gemSchema).optional(),
});

const itemSchema = z.object({
  id: z.string().optional(),
  slot: z.string(),
  name: z.string(),
  rarity: z.string().optional(),
  lines: z.array(z.string()).optional(),
});

const loadoutSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  primary: z.boolean().optional(),
  allocatedNodeIds: z.array(z.number()).optional(),
  items: z.array(itemSchema).optional(),
  skills: z.array(skillGroupSchema).optional(),
  configuration: z.record(scalar).optional(),
  resources: z.record(scalar).optional(),
});

/**
 * The documented ExileLab JSON interchange format. This is the contract other
 * ExileLab surfaces (exporters, tests, fixtures) target for lossless round-trips.
 */
export const nativeInterchangeSchema = z.object({
  format: z.literal(NATIVE_FORMAT_TAG),
  formatVersion: z.number().int().positive(),
  gamePatch: z.string().min(1),
  character: z.object({
    className: z.string().min(1),
    ascendancyName: z.string().optional(),
    level: z.number().int().positive(),
  }),
  loadouts: z.array(loadoutSchema).min(1),
  provenance: z
    .object({
      reference: z.string().optional(),
      attribution: z.string().optional(),
    })
    .optional(),
  metadata: z
    .object({
      labels: z.array(z.string()).optional(),
      league: z.string().optional(),
    })
    .optional(),
});

export type NativeInterchange = z.infer<typeof nativeInterchangeSchema>;

function toExtractedLoadout(l: z.infer<typeof loadoutSchema>): ExtractedLoadout {
  return {
    ...(l.id !== undefined ? { id: l.id } : {}),
    ...(l.name !== undefined ? { name: l.name } : {}),
    ...(l.primary !== undefined ? { primary: l.primary } : {}),
    ...(l.allocatedNodeIds !== undefined ? { allocatedNodeIds: l.allocatedNodeIds } : {}),
    ...(l.items !== undefined
      ? {
          items: l.items.map((it) => ({
            ...(it.id !== undefined ? { id: it.id } : {}),
            slot: it.slot,
            name: it.name,
            ...(it.rarity !== undefined ? { rarity: it.rarity } : {}),
            ...(it.lines !== undefined ? { lines: it.lines } : {}),
          })),
        }
      : {}),
    ...(l.skills !== undefined
      ? {
          skills: l.skills.map((g) => ({
            ...(g.id !== undefined ? { id: g.id } : {}),
            ...(g.isMain !== undefined ? { isMain: g.isMain } : {}),
            ...(g.gems !== undefined
              ? {
                  gems: g.gems.map((gem) => ({
                    name: gem.name,
                    ...(gem.skillId !== undefined ? { skillId: gem.skillId } : {}),
                    ...(gem.level !== undefined ? { level: gem.level } : {}),
                    ...(gem.quality !== undefined ? { quality: gem.quality } : {}),
                  })),
                }
              : {}),
          })),
        }
      : {}),
    ...(l.configuration !== undefined ? { configuration: l.configuration } : {}),
    ...(l.resources !== undefined ? { resources: l.resources } : {}),
  };
}

let nativeCounter = 0;

export class NativeJsonImporter implements Importer {
  readonly source = "native-json" as const;

  detect(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed.startsWith("{")) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return false;
    }
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { format?: unknown }).format === NATIVE_FORMAT_TAG
    );
  }

  import(input: string): RawImportArtifact {
    const receivedAt = new Date().toISOString();
    let json: unknown;
    try {
      json = JSON.parse(input.trim());
    } catch (cause) {
      throw new ImportError(this.source, "payload is not valid JSON", { cause });
    }

    const result = nativeInterchangeSchema.safeParse(json);
    if (!result.success) {
      throw new ImportError(
        this.source,
        `payload does not match the ExileLab interchange schema: ${result.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")}`,
        { cause: result.error },
      );
    }

    const data = result.data;
    const extracted: ExtractedBuild = {
      gamePatch: data.gamePatch,
      character: {
        className: data.character.className,
        ...(data.character.ascendancyName !== undefined
          ? { ascendancyName: data.character.ascendancyName }
          : {}),
        level: data.character.level,
      },
      loadouts: data.loadouts.map(toExtractedLoadout),
      ...(data.provenance !== undefined
        ? {
            provenance: {
              ...(data.provenance.reference !== undefined
                ? { reference: data.provenance.reference }
                : {}),
              ...(data.provenance.attribution !== undefined
                ? { attribution: data.provenance.attribution }
                : {}),
            },
          }
        : {}),
      ...(data.metadata !== undefined
        ? {
            metadata: {
              ...(data.metadata.labels !== undefined ? { labels: data.metadata.labels } : {}),
              ...(data.metadata.league !== undefined ? { league: data.metadata.league } : {}),
            },
          }
        : {}),
    };

    nativeCounter += 1;
    return {
      source: this.source,
      ref: `raw-native-${receivedAt}-${nativeCounter}`,
      receivedAt,
      payload: input,
      extracted,
      // Native format is authoritative: no declared gaps.
      gaps: [],
    };
  }
}
