# Persistence — `@exilelab/api` store

Everything the API persists sits behind three (plus one) repository interfaces in
[`repositories.ts`](./repositories.ts). They map 1:1 to the immutable artifacts of
the canonical pipeline (RFC-0001 §5.2):

| Interface                       | Artifact              | Key (canonical identity)                     |
| ------------------------------- | --------------------- | -------------------------------------------- |
| `BuildRepository`               | BuildSnapshot         | `identity` (Canonical Identity, I2)          |
| `MutationRepository`            | BuildMutation         | `mutationId` (deterministic, AD-2)           |
| `CalculationResultRepository`   | Calculation Result    | `(snapshotId, mutationId?, engineVersion)` (AD-7) |
| `RawImportArtifactRepository`   | Raw Import Artifact   | `artifactId` + time-boxed retention (AD-4)   |

The methods are **async** (Promise-returning): Node cannot do synchronous network
I/O, so any persistence-backed implementation must be async. The in-memory impls
resolve immediately; the service layer `await`s uniformly, so the backing store is
invisible to the HTTP layer.

## Two implementations, one seam

- **In-memory** (`InMemory*`, `createInMemoryRepositories`) — Map-backed, the
  launch default. Used by all unit/integration API tests.
- **Postgres 17** (`Postgres*`, `createPostgresRepositories`) — PRD §9.2 OLTP.
  Parameterized queries only (injection-safe). Every read **re-hydrates through
  the core factory** (`createBuildSnapshot` / `createBuildMutation` / …), which
  re-validates and deep-freezes the artifact and (for snapshots + mutations)
  asserts the recomputed identity matches the stored primary key — so a corrupt
  row can never yield an un-frozen, invalid, or mis-identified artifact; it throws.

Both satisfy the **same** interfaces (`Repositories` bundle).

## Selection by environment

`repositoriesFromEnv()` chooses at runtime:

- `DATABASE_URL` **set** → Postgres; `ensureSchema()` applies
  [`../../sql/schema.sql`](../../sql/schema.sql) (idempotent) on connect.
- `DATABASE_URL` **unset** → in-memory default (**unchanged** launch behaviour).

`buildApp()` calls this unless a service is injected, so tests — which run with
`DATABASE_URL` unset — stay fully in-memory and never require a database.

## Schema

[`sql/schema.sql`](../../sql/schema.sql) — one table per artifact:

- `snapshots` — frozen `build_state` / `metadata` / `display_cache` as `jsonb`
  (verbatim, for exact re-hydration), plus **provenance/version columns projected
  out** (`provenance_source`, `attribution`, `imported_at`, `patch_version`, …)
  for attribution + Aggregation-Engine queries without unpacking jsonb.
- `mutations` — deterministic `mutation_id` PK, ordered `operations` jsonb.
- `calculation_results` — composite PK `(snapshot_id, mutation_id, engine_version)`.
  Base results (no mutation) use the empty-string sentinel `''` because Postgres
  PKs cannot hold NULL; it maps back to `undefined` on read.
- `raw_import_artifacts` — `retention_expires_at` timestamp (AD-4); `purgeExpired()`
  sweeps past-retention rows.

## Local Postgres 17 (any Docker host)

This machine has **no Docker**, so the integration test leg is skipped here. On a
Docker host:

```bash
docker compose -f backend/api/docker-compose.db.yml up -d
export DATABASE_URL=postgres://exilelab:exilelab@localhost:5433/exilelab
pnpm --filter @exilelab/api test        # postgres integration suite now runs
```

The store test suite ([`postgres-repositories.test.ts`](./postgres-repositories.test.ts))
uses `describe.skipIf(!process.env.DATABASE_URL)` for the DB-backed CRUD /
hydrate-refreeze / calc-result-keying tests, and **always-running** unit tests for
the SQL-free row↔artifact mapping (via a fake `Queryable`).
