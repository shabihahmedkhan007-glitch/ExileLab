// Store tests, in two legs:
//
//  1. ALWAYS-running unit tests for the SQL-free logic — the pure row<->artifact
//     mapping and the repository wiring over a FAKE Queryable. These prove
//     hydrate-refreeze, corrupt-row rejection, calc-result base/mutation keying,
//     and injection-safe parameterization with NO database.
//
//  2. describe.skipIf(!DATABASE_URL) integration tests — full CRUD + hydrate +
//     calc-result keying against a LIVE Postgres. This machine has no Docker, so
//     they are skipped here; `docker-compose.db.yml` + the store README bring a
//     Postgres 17 up on any Docker host and the suite runs unchanged.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

import {
  createBuildMutation,
  createCalculationResult,
  createRawImportArtifact,
} from "@exilelab/core";
import type { BuildSnapshot as CoreSnapshot } from "@exilelab/core";
import { detectSource, normalize } from "@exilelab/build-normalizer";

import { twisterHuntressJson } from "../fixtures.js";
import {
  PostgresBuildRepository,
  PostgresCalculationResultRepository,
  ensureSchema,
  pgQueryable,
  repositoriesOver,
  rowToCalculationResult,
  rowToMutation,
  rowToRawImportArtifact,
  rowToSnapshot,
  snapshotToInsert,
} from "./postgres-repositories.js";
import type {
  CalculationResultRow,
  Queryable,
  QueryResultLike,
  SnapshotRow,
} from "./postgres-repositories.js";
import type { Repositories } from "./repositories.js";

// --- Fixtures ---------------------------------------------------------------

function makeSnapshot(): CoreSnapshot {
  const json = twisterHuntressJson();
  const importer = detectSource(json);
  if (importer === null) throw new Error("fixture importer not detected");
  return normalize(importer.import(json));
}

function snapshotRowFrom(snapshot: CoreSnapshot): SnapshotRow {
  const ins = snapshotToInsert(snapshot);
  return {
    identity: ins.identity,
    build_state: JSON.parse(ins.buildState),
    metadata: JSON.parse(ins.metadata),
    display_cache: JSON.parse(ins.displayCache),
  };
}

// A recording fake for the database seam: canned responses + captured calls.
class FakeQueryable implements Queryable {
  readonly calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  constructor(
    private readonly responder: (
      text: string,
      values?: readonly unknown[],
    ) => unknown[] = () => [],
  ) {}
  async query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResultLike<R>> {
    this.calls.push({ text, values });
    return { rows: this.responder(text, values) as R[] };
  }
}

// ===========================================================================
// Leg 1 — always-running unit tests (no database).
// ===========================================================================

describe("row<->artifact mapping (no database)", () => {
  it("round-trips a snapshot through insert -> row -> hydrate, staying frozen", () => {
    const snap = makeSnapshot();
    const hydrated = rowToSnapshot(snapshotRowFrom(snap));

    expect(hydrated.identity).toBe(snap.identity);
    expect(hydrated.buildState).toEqual(snap.buildState);
    expect(hydrated.metadata).toEqual(snap.metadata);
    // Hydrate-refreeze: a read produces an immutable snapshot (I1).
    expect(Object.isFrozen(hydrated)).toBe(true);
    expect(Object.isFrozen(hydrated.buildState)).toBe(true);
  });

  it("rejects a corrupt snapshot row whose PK disagrees with its build state", () => {
    const snap = makeSnapshot();
    const row = { ...snapshotRowFrom(snap), identity: "deadbeef-not-the-real-id" };
    expect(() => rowToSnapshot(row)).toThrow(/corrupt row/);
  });

  it("rejects a snapshot row with structurally invalid build state", () => {
    const snap = makeSnapshot();
    const row: SnapshotRow = { ...snapshotRowFrom(snap), build_state: {} };
    // core's schema validation fires before the identity check — either way, throw.
    expect(() => rowToSnapshot(row)).toThrow();
  });

  it("round-trips a mutation and verifies its deterministic id", () => {
    const snap = makeSnapshot();
    const primary =
      snap.buildState.loadoutContexts.find((l) => l.primary) ??
      snap.buildState.loadoutContexts[0];
    if (primary === undefined) throw new Error("no loadout");
    const mutation = createBuildMutation({
      baseSnapshotId: snap.identity,
      operations: [
        { kind: "allocatePassiveNode", loadoutContextId: primary.contextId, nodeId: 999 },
      ],
    });

    const hydrated = rowToMutation({
      mutation_id: mutation.mutationId,
      base_snapshot_id: mutation.baseSnapshotId,
      operations: JSON.parse(JSON.stringify(mutation.operations)),
    });
    expect(hydrated.mutationId).toBe(mutation.mutationId);
    expect(hydrated.operations).toEqual(mutation.operations);

    // Corrupt: operations don't hash to the stored id.
    expect(() =>
      rowToMutation({
        mutation_id: "not-the-real-hash",
        base_snapshot_id: mutation.baseSnapshotId,
        operations: JSON.parse(JSON.stringify(mutation.operations)),
      }),
    ).toThrow(/corrupt row/);
  });

  it("maps calc-result keying: '' sentinel is a base result, else a mutation result", () => {
    const base: CalculationResultRow = {
      snapshot_id: "s1",
      mutation_id: "",
      engine_version: "mock-1",
      metrics: { fullDPS: 42 },
      computed_at: new Date("2026-07-05T00:00:00.000Z"),
    };
    const baseResult = rowToCalculationResult(base);
    expect(baseResult.key.mutationId).toBeUndefined();
    expect(baseResult.key.snapshotId).toBe("s1");
    expect(baseResult.metrics.fullDPS).toBe(42);

    const withMutation = rowToCalculationResult({ ...base, mutation_id: "m1" });
    expect(withMutation.key.mutationId).toBe("m1");
  });

  it("round-trips a raw import artifact including its retention window", () => {
    const artifact = createRawImportArtifact({
      artifactId: "raw-1",
      source: "native-json",
      fetchedAt: "2026-07-05T00:00:00.000Z",
      payload: "{}",
      retention: { expiresAt: "2026-10-03T00:00:00.000Z", note: "90-day default (AD-4)" },
    });
    const hydrated = rowToRawImportArtifact({
      artifact_id: artifact.artifactId,
      source: artifact.source,
      fetched_at: new Date(artifact.fetchedAt),
      payload: artifact.payload,
      retention_expires_at: new Date(artifact.retention.expiresAt),
      retention_note: artifact.retention.note,
    });
    expect(hydrated).toEqual(artifact);
    expect(Object.isFrozen(hydrated)).toBe(true);
  });
});

describe("repositories over a fake Queryable (no database)", () => {
  it("save issues a parameterized INSERT and never interpolates the value", async () => {
    const snap = makeSnapshot();
    const fake = new FakeQueryable();
    const id = await new PostgresBuildRepository(fake).save(snap);

    expect(id).toBe(snap.identity);
    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0];
    if (call === undefined) throw new Error("no call recorded");
    expect(call.text).toContain("INSERT INTO snapshots");
    expect(call.values?.[0]).toBe(snap.identity);
    // Injection-safe: the identity travels as a bound parameter, not in SQL text.
    expect(call.text).not.toContain(snap.identity);
    expect(call.text).toContain("$1");
  });

  it("get hydrates a canned row (frozen) and returns undefined when absent", async () => {
    const snap = makeSnapshot();
    const row = snapshotRowFrom(snap);
    const present = new FakeQueryable((text) => (text.includes("SELECT") ? [row] : []));
    const got = await new PostgresBuildRepository(present).get(snap.identity);
    expect(got?.identity).toBe(snap.identity);
    expect(Object.isFrozen(got)).toBe(true);

    const absent = new FakeQueryable(() => []);
    expect(await new PostgresBuildRepository(absent).get("missing")).toBeUndefined();
  });

  it("calc save maps an absent mutationId to the '' base sentinel", async () => {
    const fake = new FakeQueryable();
    await new PostgresCalculationResultRepository(fake).save(
      createCalculationResult({
        key: { snapshotId: "s1", engineVersion: "mock-1" },
        metrics: {},
        computedAt: "2026-07-05T00:00:00.000Z",
      }),
    );
    const call = fake.calls[0];
    if (call === undefined) throw new Error("no call recorded");
    expect(call.values?.[1]).toBe(""); // mutation_id sentinel for a base result
  });

  it("latestForBuild queries the base rows ordered by computed_at DESC", async () => {
    const fake = new FakeQueryable();
    await new PostgresCalculationResultRepository(fake).latestForBuild("s1");
    const call = fake.calls[0];
    if (call === undefined) throw new Error("no call recorded");
    expect(call.text).toContain("ORDER BY computed_at DESC");
    expect(call.values).toEqual(["s1", ""]);
  });
});

// ===========================================================================
// Leg 2 — integration tests against a LIVE Postgres (skipped without a DB).
// ===========================================================================

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Postgres repositories (live database)", () => {
  let pool: Pool;
  let repos: Repositories;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    const db = pgQueryable(pool);
    await ensureSchema(db);
    await pool.query(
      "TRUNCATE snapshots, mutations, calculation_results, raw_import_artifacts",
    );
    repos = repositoriesOver(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("snapshot save is idempotent and get re-hydrates a frozen, identity-checked snapshot", async () => {
    const snap = makeSnapshot();
    const id1 = await repos.builds.save(snap);
    const id2 = await repos.builds.save(snap); // idempotent on identity
    expect(id1).toBe(snap.identity);
    expect(id2).toBe(snap.identity);
    expect(await repos.builds.has(snap.identity)).toBe(true);

    const got = await repos.builds.get(snap.identity);
    expect(got?.identity).toBe(snap.identity);
    expect(got?.buildState).toEqual(snap.buildState);
    expect(Object.isFrozen(got)).toBe(true);

    expect(await repos.builds.get("does-not-exist")).toBeUndefined();
    expect(await repos.builds.has("does-not-exist")).toBe(false);
  });

  it("calculation results are keyed by (snapshotId, mutationId?, engineVersion)", async () => {
    const snap = makeSnapshot();
    await repos.builds.save(snap);

    const baseV1 = createCalculationResult({
      key: { snapshotId: snap.identity, engineVersion: "mock-1" },
      metrics: { fullDPS: 100 },
      computedAt: "2026-07-05T00:00:00.000Z",
    });
    const baseV2 = createCalculationResult({
      key: { snapshotId: snap.identity, engineVersion: "mock-2" },
      metrics: { fullDPS: 110 },
      computedAt: "2026-07-05T01:00:00.000Z",
    });
    const withMutation = createCalculationResult({
      key: { snapshotId: snap.identity, mutationId: "m1", engineVersion: "mock-1" },
      metrics: { fullDPS: 130 },
      computedAt: "2026-07-05T02:00:00.000Z",
    });
    await repos.calculations.save(baseV1);
    await repos.calculations.save(baseV2);
    await repos.calculations.save(withMutation);

    // Distinct keys are distinct rows.
    expect((await repos.calculations.get(baseV1.key))?.metrics.fullDPS).toBe(100);
    expect((await repos.calculations.get(baseV2.key))?.metrics.fullDPS).toBe(110);
    const mut = await repos.calculations.get(withMutation.key);
    expect(mut?.key.mutationId).toBe("m1");
    expect(mut?.metrics.fullDPS).toBe(130);

    // latestForBuild returns the newest BASE result (never the mutation result).
    const latest = await repos.calculations.latestForBuild(snap.identity);
    expect(latest?.key.mutationId).toBeUndefined();
    expect(latest?.metrics.fullDPS).toBe(110); // baseV2, later computed_at
  });

  it("mutations round-trip with their deterministic id", async () => {
    const snap = makeSnapshot();
    const primary =
      snap.buildState.loadoutContexts.find((l) => l.primary) ??
      snap.buildState.loadoutContexts[0];
    if (primary === undefined) throw new Error("no loadout");
    const mutation = createBuildMutation({
      baseSnapshotId: snap.identity,
      operations: [
        { kind: "allocatePassiveNode", loadoutContextId: primary.contextId, nodeId: 777 },
      ],
    });
    await repos.mutations.save(mutation);
    const got = await repos.mutations.get(mutation.mutationId);
    expect(got).toEqual(mutation);
    expect(Object.isFrozen(got)).toBe(true);
    expect(await repos.mutations.get("no-such-mutation")).toBeUndefined();
  });

  it("raw import artifacts persist with retention and purgeExpired sweeps them", async () => {
    const live = createRawImportArtifact({
      artifactId: "raw-live",
      source: "native-json",
      fetchedAt: "2026-07-05T00:00:00.000Z",
      payload: "{}",
      retention: { expiresAt: "2999-01-01T00:00:00.000Z", note: "far future" },
    });
    const expired = createRawImportArtifact({
      artifactId: "raw-expired",
      source: "native-json",
      fetchedAt: "2020-01-01T00:00:00.000Z",
      payload: "{}",
      retention: { expiresAt: "2020-04-01T00:00:00.000Z", note: "long expired" },
    });
    await repos.rawArtifacts.save(live);
    await repos.rawArtifacts.save(expired);

    expect((await repos.rawArtifacts.get("raw-live"))?.artifactId).toBe("raw-live");

    const purged = await repos.rawArtifacts.purgeExpired(new Date("2026-07-05T00:00:00.000Z"));
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await repos.rawArtifacts.get("raw-expired")).toBeUndefined();
    expect((await repos.rawArtifacts.get("raw-live"))?.artifactId).toBe("raw-live");
  });
});
