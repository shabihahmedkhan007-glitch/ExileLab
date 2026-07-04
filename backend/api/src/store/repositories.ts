// In-memory repositories behind interfaces.
//
// SEAM: everything the API persists sits behind these interfaces. The launch
// implementation is in-memory (Map-backed); a later phase swaps in a Postgres
// implementation of the SAME interfaces with no route changes. Keys follow the
// canonical artifact identities from RFC-0001: buildId = a snapshot's Canonical
// Identity; Calculation Results keyed by (snapshotId, mutationId?, engineVersion);
// mutations keyed by their deterministic mutationId.

import type {
  BuildMutation,
  BuildSnapshot as CoreSnapshot,
  CalculationResult,
  CalculationResultKey,
} from "@exilelab/core";

export interface BuildRepository {
  /** Store a snapshot; returns its buildId (the Canonical Identity). Idempotent. */
  save(snapshot: CoreSnapshot): string;
  get(buildId: string): CoreSnapshot | undefined;
  has(buildId: string): boolean;
}

export interface CalculationResultRepository {
  save(result: CalculationResult): void;
  get(key: CalculationResultKey): CalculationResult | undefined;
  /** Latest stored result for a base snapshot (no mutation), if any. */
  latestForBuild(snapshotId: string): CalculationResult | undefined;
}

export interface MutationRepository {
  save(mutation: BuildMutation): void;
  get(mutationId: string): BuildMutation | undefined;
}

function calcKey(key: CalculationResultKey): string {
  return `${key.snapshotId}::${key.mutationId ?? "base"}::${key.engineVersion}`;
}

export class InMemoryBuildRepository implements BuildRepository {
  private readonly builds = new Map<string, CoreSnapshot>();

  save(snapshot: CoreSnapshot): string {
    this.builds.set(snapshot.identity, snapshot);
    return snapshot.identity;
  }

  get(buildId: string): CoreSnapshot | undefined {
    return this.builds.get(buildId);
  }

  has(buildId: string): boolean {
    return this.builds.has(buildId);
  }
}

export class InMemoryCalculationResultRepository
  implements CalculationResultRepository
{
  private readonly results = new Map<string, CalculationResult>();

  save(result: CalculationResult): void {
    this.results.set(calcKey(result.key), result);
  }

  get(key: CalculationResultKey): CalculationResult | undefined {
    return this.results.get(calcKey(key));
  }

  latestForBuild(snapshotId: string): CalculationResult | undefined {
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

  save(mutation: BuildMutation): void {
    this.mutations.set(mutation.mutationId, mutation);
  }

  get(mutationId: string): BuildMutation | undefined {
    return this.mutations.get(mutationId);
  }
}

/** The repository bundle passed to the service layer. */
export interface Repositories {
  builds: BuildRepository;
  calculations: CalculationResultRepository;
  mutations: MutationRepository;
}

export function createInMemoryRepositories(): Repositories {
  return {
    builds: new InMemoryBuildRepository(),
    calculations: new InMemoryCalculationResultRepository(),
    mutations: new InMemoryMutationRepository(),
  };
}
