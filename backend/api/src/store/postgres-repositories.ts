// Postgres implementations of the repository interfaces (RFC-0001 artifact
// pipeline; PRD §9.2 Postgres 17). Selected at runtime when DATABASE_URL is set
// (see `repositoriesFromEnv`); the in-memory impls remain the default.
//
// GUARANTEES enforced here:
//   * Injection-safe: EVERY query is parameterized ($1, $2, …). No value is ever
//     interpolated into SQL text.
//   * Hydrate-refreeze: a row is never trusted. Every read reconstructs the
//     artifact through the core factory (createBuildSnapshot / createBuildMutation
//     / createCalculationResult / createRawImportArtifact), which re-validates and
//     deep-freezes it (I1). For snapshots and mutations the recomputed Canonical
//     Identity is compared to the stored primary key — a corrupt row can never
//     produce an un-frozen, invalid, or mis-identified artifact; it throws.
//   * Storage is the durable backing only; identity/keys are the canonical ones.
//
// The classes depend on a minimal `Queryable` seam (satisfied by a pg Pool via
// `pgQueryable`, and by a fake in unit tests) so the row<->artifact mapping is
// testable with no live database.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  createBuildMutation,
  createBuildSnapshot,
  createCalculationResult,
  createRawImportArtifact,
} from "@exilelab/core";
import type {
  BuildMutation,
  BuildSnapshot as CoreSnapshot,
  BuildState,
  CalculationResult,
  CalculationResultKey,
  DisplayCache,
  Metadata,
  MutationOperation,
  RawImportArtifact,
} from "@exilelab/core";

import type {
  BuildRepository,
  CalculationResultRepository,
  MutationRepository,
  RawImportArtifactRepository,
  Repositories,
} from "./repositories.js";
import { createInMemoryRepositories } from "./repositories.js";

// ---------------------------------------------------------------------------
// The database seam (the "fake query layer" the unit tests inject).
// ---------------------------------------------------------------------------

export interface QueryResultLike<R> {
  readonly rows: R[];
}

/** Everything the repositories need from a database handle. `pg.Pool` satisfies it via {@link pgQueryable}. */
export interface Queryable {
  query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResultLike<R>>;
}

/** Wrap a `pg` Pool in the {@link Queryable} seam used by the repositories. */
export function pgQueryable(pool: Pool): Queryable {
  return {
    async query<R>(text: string, values?: readonly unknown[]) {
      const res = await pool.query(text, values ? [...values] : undefined);
      return { rows: res.rows as R[] };
    },
  };
}

// ---------------------------------------------------------------------------
// Row shapes + PURE row<->artifact mapping (unit-tested without a database).
// ---------------------------------------------------------------------------

/** jsonb comes back parsed from `pg`; a fake layer may hand back a JSON string. */
function asObject(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/** timestamptz comes back as a Date from `pg`; accept an ISO string too. */
function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  throw new Error(`expected a Date or ISO-8601 string, received ${typeof value}`);
}

export interface SnapshotRow {
  readonly identity: string;
  readonly build_state: unknown;
  readonly metadata: unknown;
  readonly display_cache: unknown;
}

/**
 * Re-hydrate a snapshot from its row. Re-validates + deep-freezes via the core
 * factory and asserts the recomputed Canonical Identity matches the stored PK.
 */
export function rowToSnapshot(row: SnapshotRow): CoreSnapshot {
  const snapshot = createBuildSnapshot({
    buildState: asObject(row.build_state) as BuildState,
    metadata: asObject(row.metadata) as Metadata,
    displayCache: asObject(row.display_cache) as DisplayCache,
  });
  if (snapshot.identity !== row.identity) {
    throw new Error(
      `postgres-repositories: snapshot row "${row.identity}" re-hydrated to a ` +
        `different Canonical Identity "${snapshot.identity}" — corrupt row`,
    );
  }
  return snapshot;
}

/** Column values for inserting a snapshot (provenance/version projected out). */
export interface SnapshotInsert {
  readonly identity: string;
  readonly buildState: string;
  readonly metadata: string;
  readonly displayCache: string;
  readonly provenanceSource: string;
  readonly provenanceReference: string | null;
  readonly importedAt: string;
  readonly attribution: string | null;
  readonly rawImportArtifactId: string | null;
  readonly patchVersion: string;
  readonly formatVersion: string;
}

export function snapshotToInsert(snapshot: CoreSnapshot): SnapshotInsert {
  const prov = snapshot.metadata.provenance;
  return {
    identity: snapshot.identity,
    buildState: JSON.stringify(snapshot.buildState),
    metadata: JSON.stringify(snapshot.metadata),
    displayCache: JSON.stringify(snapshot.displayCache),
    provenanceSource: prov.source,
    provenanceReference: prov.reference ?? null,
    importedAt: prov.importedAt,
    attribution: prov.attribution ?? null,
    rawImportArtifactId: prov.rawImportArtifactId ?? null,
    patchVersion: snapshot.metadata.patchVersion,
    formatVersion: snapshot.metadata.formatVersion,
  };
}

export interface MutationRow {
  readonly mutation_id: string;
  readonly base_snapshot_id: string;
  readonly operations: unknown;
}

/** Re-hydrate a mutation, recomputing + verifying its deterministic id. */
export function rowToMutation(row: MutationRow): BuildMutation {
  const mutation = createBuildMutation({
    baseSnapshotId: row.base_snapshot_id,
    operations: asObject(row.operations) as readonly MutationOperation[],
  });
  if (mutation.mutationId !== row.mutation_id) {
    throw new Error(
      `postgres-repositories: mutation row "${row.mutation_id}" re-hydrated to a ` +
        `different mutationId "${mutation.mutationId}" — corrupt row`,
    );
  }
  return mutation;
}

/** Empty string is the base-result sentinel (Postgres PKs cannot hold NULL). */
const BASE_MUTATION_SENTINEL = "";

export interface CalculationResultRow {
  readonly snapshot_id: string;
  readonly mutation_id: string;
  readonly engine_version: string;
  readonly metrics: unknown;
  readonly computed_at: unknown;
}

export function rowToCalculationResult(row: CalculationResultRow): CalculationResult {
  const key: CalculationResultKey = {
    snapshotId: row.snapshot_id,
    engineVersion: row.engine_version,
    ...(row.mutation_id !== BASE_MUTATION_SENTINEL
      ? { mutationId: row.mutation_id }
      : {}),
  };
  return createCalculationResult({
    key,
    metrics: asObject(row.metrics) as Readonly<Record<string, number>>,
    computedAt: asIso(row.computed_at),
  });
}

export interface RawImportArtifactRow {
  readonly artifact_id: string;
  readonly source: string;
  readonly fetched_at: unknown;
  readonly payload: string;
  readonly retention_expires_at: unknown;
  readonly retention_note: string;
}

export function rowToRawImportArtifact(row: RawImportArtifactRow): RawImportArtifact {
  return createRawImportArtifact({
    artifactId: row.artifact_id,
    source: row.source,
    fetchedAt: asIso(row.fetched_at),
    payload: row.payload,
    retention: {
      expiresAt: asIso(row.retention_expires_at),
      note: row.retention_note,
    },
  });
}

// ---------------------------------------------------------------------------
// Repository implementations over the Queryable seam.
// ---------------------------------------------------------------------------

export class PostgresBuildRepository implements BuildRepository {
  constructor(private readonly db: Queryable) {}

  async save(snapshot: CoreSnapshot): Promise<string> {
    const r = snapshotToInsert(snapshot);
    await this.db.query(
      `INSERT INTO snapshots
         (identity, build_state, metadata, display_cache,
          provenance_source, provenance_reference, imported_at, attribution,
          raw_import_artifact_id, patch_version, format_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (identity) DO NOTHING`,
      [
        r.identity,
        r.buildState,
        r.metadata,
        r.displayCache,
        r.provenanceSource,
        r.provenanceReference,
        r.importedAt,
        r.attribution,
        r.rawImportArtifactId,
        r.patchVersion,
        r.formatVersion,
      ],
    );
    return snapshot.identity;
  }

  async get(buildId: string): Promise<CoreSnapshot | undefined> {
    const res = await this.db.query<SnapshotRow>(
      `SELECT identity, build_state, metadata, display_cache
         FROM snapshots WHERE identity = $1`,
      [buildId],
    );
    const row = res.rows[0];
    return row === undefined ? undefined : rowToSnapshot(row);
  }

  async has(buildId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM snapshots WHERE identity = $1`,
      [buildId],
    );
    return res.rows.length > 0;
  }
}

export class PostgresCalculationResultRepository
  implements CalculationResultRepository
{
  constructor(private readonly db: Queryable) {}

  async save(result: CalculationResult): Promise<void> {
    await this.db.query(
      `INSERT INTO calculation_results
         (snapshot_id, mutation_id, engine_version, metrics, computed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (snapshot_id, mutation_id, engine_version) DO NOTHING`,
      [
        result.key.snapshotId,
        result.key.mutationId ?? BASE_MUTATION_SENTINEL,
        result.key.engineVersion,
        JSON.stringify(result.metrics),
        result.computedAt,
      ],
    );
  }

  async get(key: CalculationResultKey): Promise<CalculationResult | undefined> {
    const res = await this.db.query<CalculationResultRow>(
      `SELECT snapshot_id, mutation_id, engine_version, metrics, computed_at
         FROM calculation_results
        WHERE snapshot_id = $1 AND mutation_id = $2 AND engine_version = $3`,
      [key.snapshotId, key.mutationId ?? BASE_MUTATION_SENTINEL, key.engineVersion],
    );
    const row = res.rows[0];
    return row === undefined ? undefined : rowToCalculationResult(row);
  }

  async latestForBuild(snapshotId: string): Promise<CalculationResult | undefined> {
    const res = await this.db.query<CalculationResultRow>(
      `SELECT snapshot_id, mutation_id, engine_version, metrics, computed_at
         FROM calculation_results
        WHERE snapshot_id = $1 AND mutation_id = $2
        ORDER BY computed_at DESC
        LIMIT 1`,
      [snapshotId, BASE_MUTATION_SENTINEL],
    );
    const row = res.rows[0];
    return row === undefined ? undefined : rowToCalculationResult(row);
  }
}

export class PostgresMutationRepository implements MutationRepository {
  constructor(private readonly db: Queryable) {}

  async save(mutation: BuildMutation): Promise<void> {
    await this.db.query(
      `INSERT INTO mutations (mutation_id, base_snapshot_id, operations)
       VALUES ($1, $2, $3)
       ON CONFLICT (mutation_id) DO NOTHING`,
      [
        mutation.mutationId,
        mutation.baseSnapshotId,
        JSON.stringify(mutation.operations),
      ],
    );
  }

  async get(mutationId: string): Promise<BuildMutation | undefined> {
    const res = await this.db.query<MutationRow>(
      `SELECT mutation_id, base_snapshot_id, operations
         FROM mutations WHERE mutation_id = $1`,
      [mutationId],
    );
    const row = res.rows[0];
    return row === undefined ? undefined : rowToMutation(row);
  }
}

export class PostgresRawImportArtifactRepository
  implements RawImportArtifactRepository
{
  constructor(private readonly db: Queryable) {}

  async save(artifact: RawImportArtifact): Promise<void> {
    await this.db.query(
      `INSERT INTO raw_import_artifacts
         (artifact_id, source, fetched_at, payload,
          retention_expires_at, retention_note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (artifact_id) DO NOTHING`,
      [
        artifact.artifactId,
        artifact.source,
        artifact.fetchedAt,
        artifact.payload,
        artifact.retention.expiresAt,
        artifact.retention.note,
      ],
    );
  }

  async get(artifactId: string): Promise<RawImportArtifact | undefined> {
    const res = await this.db.query<RawImportArtifactRow>(
      `SELECT artifact_id, source, fetched_at, payload,
              retention_expires_at, retention_note
         FROM raw_import_artifacts WHERE artifact_id = $1`,
      [artifactId],
    );
    const row = res.rows[0];
    return row === undefined ? undefined : rowToRawImportArtifact(row);
  }

  async purgeExpired(now: Date): Promise<number> {
    const res = await this.db.query(
      `DELETE FROM raw_import_artifacts
        WHERE retention_expires_at <= $1
        RETURNING artifact_id`,
      [now.toISOString()],
    );
    return res.rows.length;
  }
}

// ---------------------------------------------------------------------------
// Bundle + wiring.
// ---------------------------------------------------------------------------

/** A Postgres-backed {@link Repositories} bundle plus schema/lifecycle helpers. */
export interface PostgresRepositories extends Repositories {
  /** Apply sql/schema.sql (idempotent CREATE … IF NOT EXISTS). */
  ensureSchema(): Promise<void>;
  /** Close the underlying pool, if this factory owns one. */
  close(): Promise<void>;
}

const SCHEMA_PATH = fileURLToPath(new URL("../../sql/schema.sql", import.meta.url));

/** Run the canonical schema against a {@link Queryable}. */
export async function ensureSchema(db: Queryable): Promise<void> {
  const sql = await readFile(SCHEMA_PATH, "utf8");
  await db.query(sql);
}

/** Build repositories over a {@link Queryable} (e.g. a wrapped Pool or a fake). */
export function repositoriesOver(db: Queryable): Repositories {
  return {
    builds: new PostgresBuildRepository(db),
    calculations: new PostgresCalculationResultRepository(db),
    mutations: new PostgresMutationRepository(db),
    rawArtifacts: new PostgresRawImportArtifactRepository(db),
  };
}

/**
 * Create Postgres repositories from a connection string (opens + owns a Pool) or
 * from an existing Pool (does not own it — `close()` is then a no-op).
 */
export function createPostgresRepositories(
  connection: string | Pool,
): PostgresRepositories {
  const owned = typeof connection === "string";
  const pool = owned ? new Pool({ connectionString: connection }) : connection;
  const db = pgQueryable(pool);
  return {
    ...repositoriesOver(db),
    ensureSchema: () => ensureSchema(db),
    close: async () => {
      if (owned) await pool.end();
    },
  };
}

/**
 * Repository selection by environment (deliverable §3): if DATABASE_URL is set,
 * use Postgres (and apply the schema); otherwise the in-memory default — the
 * launch behaviour, unchanged. Tests run with DATABASE_URL unset, so they stay
 * fully in-memory and never require a live database.
 */
export async function repositoriesFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<Repositories> {
  const url = env.DATABASE_URL;
  if (url === undefined || url.trim().length === 0) {
    return createInMemoryRepositories();
  }
  const repos = createPostgresRepositories(url);
  await repos.ensureSchema();
  return repos;
}
