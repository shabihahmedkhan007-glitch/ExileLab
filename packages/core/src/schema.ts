// @exilelab/core — zod validation schemas for the canonical model.
//
// createBuildSnapshot / createBuildMutation validate their inputs against these
// before any identity is computed or anything is frozen. Keeping schemas here
// (separate from the pure TS types in types.ts) means downstream packages can
// import either the type or the runtime validator.

import { z } from 'zod';

export const CharacterSchema = z
  .object({
    class: z.string().min(1),
    ascendancy: z.string().min(1).nullable(),
    level: z.number().int().finite(),
  })
  .strict();

export const MasteryEffectSchema = z
  .object({
    nodeId: z.number().int().finite(),
    effectId: z.number().int().finite(),
  })
  .strict();

export const PassiveTreeAllocationSchema = z
  .object({
    allocatedNodes: z.array(z.number().int().finite()),
    masteryEffects: z.array(MasteryEffectSchema),
  })
  .strict();

export const EquipmentItemSchema = z
  .object({
    slot: z.string().min(1),
    itemRef: z.string().min(1).nullable(),
    rarity: z.string().min(1).nullable(),
    modifiers: z.array(z.string()),
  })
  .strict();

export const SkillSetupSchema = z
  .object({
    setupId: z.string().min(1),
    isMainSkill: z.boolean(),
    skillGemRef: z.string().min(1).nullable(),
    socket: z.string().min(1).nullable(),
    supports: z.array(z.string()),
  })
  .strict();

export const LoadoutContextSchema = z
  .object({
    contextId: z.string().min(1),
    primary: z.boolean(),
    passiveTree: PassiveTreeAllocationSchema,
    equipment: z.array(EquipmentItemSchema),
    skills: z.array(SkillSetupSchema),
  })
  .strict();

const ConfigValueSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

export const ConfigEntrySchema = z
  .object({
    key: z.string().min(1),
    value: ConfigValueSchema,
  })
  .strict();

export const AssumptionOriginSchema = z.enum(['imported', 'inferred', 'defaulted']);

export const AssumptionSchema = z
  .object({
    path: z.string().min(1),
    origin: AssumptionOriginSchema,
    note: z.string().optional(),
  })
  .strict();

export const BuildStateSchema = z
  .object({
    character: CharacterSchema,
    // At least one Loadout Context, with exactly one primary (AD-5).
    loadoutContexts: z
      .array(LoadoutContextSchema)
      .min(1)
      .refine(
        (ctxs) => ctxs.filter((c) => c.primary).length === 1,
        { message: 'exactly one Loadout Context must be primary' },
      )
      .refine(
        (ctxs) => new Set(ctxs.map((c) => c.contextId)).size === ctxs.length,
        { message: 'Loadout Context ids must be unique' },
      ),
    configuration: z.array(ConfigEntrySchema),
    assumptions: z.array(AssumptionSchema),
  })
  .strict();

export const ProvenanceSchema = z
  .object({
    source: z.string().min(1),
    reference: z.string().optional(),
    importedAt: z.string().min(1),
    attribution: z.string().optional(),
    rawImportArtifactId: z.string().optional(),
  })
  .strict();

export const MetadataSchema = z
  .object({
    patchVersion: z.string().min(1),
    formatVersion: z.string().min(1),
    provenance: ProvenanceSchema,
    label: z.string().optional(),
    league: z.string().optional(),
  })
  .strict();

export const DisplayCacheSchema = z
  .object({
    names: z.record(z.string()),
    icons: z.record(z.string()),
  })
  .strict();

export const BuildSnapshotInputSchema = z
  .object({
    buildState: BuildStateSchema,
    metadata: MetadataSchema,
    displayCache: DisplayCacheSchema,
  })
  .strict();

export const MutationOperationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('allocatePassiveNode'),
      loadoutContextId: z.string().min(1),
      nodeId: z.number().int().finite(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('deallocatePassiveNode'),
      loadoutContextId: z.string().min(1),
      nodeId: z.number().int().finite(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('swapItem'),
      loadoutContextId: z.string().min(1),
      item: EquipmentItemSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('changeGem'),
      loadoutContextId: z.string().min(1),
      setupId: z.string().min(1),
      skillGemRef: z.string().min(1).nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('changeSupport'),
      loadoutContextId: z.string().min(1),
      setupId: z.string().min(1),
      removeSupportRef: z.string().optional(),
      addSupportRef: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('changeConfig'),
      key: z.string().min(1),
      value: ConfigValueSchema,
    })
    .strict(),
]);

export const BuildMutationInputSchema = z
  .object({
    baseSnapshotId: z.string().min(1),
    operations: z.array(MutationOperationSchema).min(1),
  })
  .strict();

export const CalculationResultKeySchema = z
  .object({
    snapshotId: z.string().min(1),
    mutationId: z.string().optional(),
    engineVersion: z.string().min(1),
  })
  .strict();

export const CalculationResultSchema = z
  .object({
    key: CalculationResultKeySchema,
    metrics: z.record(z.number().finite()),
    computedAt: z.string().min(1),
  })
  .strict();

export const RetentionNoteSchema = z
  .object({
    expiresAt: z.string().min(1),
    note: z.string(),
  })
  .strict();

export const RawImportArtifactSchema = z
  .object({
    artifactId: z.string().min(1),
    source: z.string().min(1),
    fetchedAt: z.string().min(1),
    payload: z.string(),
    retention: RetentionNoteSchema,
  })
  .strict();
