// Repository interfaces + in-memory implementations.
//
// SEAM: everything the API persists sits behind these interfaces. The launch
// implementation is in-memory (Map-backed); the Postgres implementation in
// ./postgres-repositories.ts satisfies the SAME interfaces with no route changes
// (chosen by DATABASE_URL, see ./index-wiring via services.ts). Keys follow the
// canonical artifact identities from RFC-0001: buildId = a snapshot's Canonical
// Identity; Calculation Results keyed by (snapshotId, mutationId?, engineVersion);
// mutations keyed by their deterministic mutationId; Raw Import Artifacts by their
// artifactId with time-boxed retention (AD-4).
//
// The methods are ASYNC (Promise-returning). Node cannot do synchronous network
// I/O, so a persistence-backed implementation MUST be async; the in-memory impls
// resolve immediately. Consumers (services.ts) `await` uniformly, so swapping the
// backing store is invisible to the HTTP layer.

import type {
  BuildMutation,
  BuildSnapshot as CoreSnapshot,
  CalculationResult,
  CalculationResultKey,
  RawImportArtifact,
} from "@exilelab/core";

export interface BuildRepository {
  /** Store a snapshot; returns its buildId (the Canonical Identity). Idempotent. */
  save(snapshot: CoreSnapshot): Promise<string>;
  get(buildId: string): Promise<CoreSnapshot | undefined>;
  has(buildId: string): Promise<boolean>;
}

export interface CalculationResultRepository {
  save(result: CalculationResult): Promise<void>;
  get(key: CalculationResultKey): Promise<CalculationResult | undefined>;
  /** Latest stored result for a base snapshot (no mutation), if any. */
  latestForBuild(snapshotId: string): Promise<CalculationResult | undefined>;
}

export interface MutationRepository {
  save(mutation: BuildMutation): Promise<void>;
  get(mutationId: string): Promise<BuildMutation | undefined>;
}

export interface RawImportArtifactRepository {
  save(artifact: RawImportArtifact): Promise<void>;
  get(artifactId: string): Promise<RawImportArtifact | undefined>;
  /**
   * Purge artifacts whose retention window (AD-4) has expired at `now`.
   * Returns the number of artifacts removed.
   */
  purgeExpired(now: Date): Promise<number>;
}

function calcKey(key: CalculationResultKey): string {
  return `${key.snapshotId}::${key.mutationId ?? "base"}::${key.engineVersion}`;
}

export class InMemoryBuildRepository implements BuildRepository {
  private readonly builds = new Map<string, CoreSnapshot>();

  async save(snapshot: CoreSnapshot): Promise<string> {
    this.builds.set(snapshot.identity, snapshot);
    return snapshot.identity;
  }

  async get(buildId: string): Promise<CoreSnapshot | undefined> {
    return this.builds.get(buildId);
  }

  async has(buildId: string): Promise<boolean> {
    return this.builds.has(buildId);
  }
}

export class InMemoryCalculationResultRepository
  implements CalculationResultRepository
{
  private readonly results = new Map<string, CalculationResult>();

  async save(result: CalculationResult): Promise<void> {
    this.results.set(calcKey(result.key), result);
  }

  async get(key: CalculationResultKey): Promise<CalculationResult | undefined> {
    return this.results.get(calcKey(key));
  }

  async latestForBuild(snapshotId: string): Promise<CalculationResult | undefined> {
    // The base (no-mutation) result for this snapshot, whatever engine version
    // measured it. In-memory scan is fine at this scale; a Postgres impl indexes.
    for (const result of this.results.values()) {
      if (result.key.snapshotId === snapshotId && result.key.mutationId === undefined) {
        return result;
      }
    }
    return undefined;
  }
}

export class InMemoryMutationRepository implements MutationRepository {
  private readonly mutations = new Map<string, BuildMutation>();

  async save(mutation: BuildMutation): Promise<void> {
    this.mutations.set(mutation.mutationId, mutation);
  }

  async get(mutationId: string): Promise<BuildMutation | undefined> {
    return this.mutations.get(mutationId);
  }
}

export class InMemoryRawImportArtifactRepository
  implements RawImportArtifactRepository
{
  private readonly artifacts = new Map<string, RawImportArtifact>();

  async save(artifact: RawImportArtifact): Promise<void> {
    this.artifacts.set(artifact.artifactId, artifact);
  }

  async get(artifactId: string): Promise<RawImportArtifact | undefined> {
    return this.artifacts.get(artifactId);
  }

  async purgeExpired(now: Date): Promise<number> {
    let removed = 0;
    for (const [id, artifact] of this.artifacts) {
      if (Date.parse(artifact.retention.expiresAt) <= now.getTime()) {
        this.artifacts.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

/** The repository bundle passed to the service layer. */
export interface Repositories {
  builds: BuildRepository;
  calculations: CalculationResultRepository;
  mutations: MutationRepository;
  rawArtifacts: RawImportArtifactRepository;
}

export function createInMemoryRepositories(): Repositories {
  return {
    builds: new InMemoryBuildRepository(),
    calculations: new InMemoryCalculationResultRepository(),
    mutations: new InMemoryMutationRepository(),
    rawArtifacts: new InMemoryRawImportArtifactRepository(),
  };
}
