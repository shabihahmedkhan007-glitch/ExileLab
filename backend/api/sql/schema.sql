-- ExileLab OLTP schema (Postgres 17) — the canonical artifact pipeline of
-- RFC-0001 §5.2, one table per immutable artifact, each keyed by its canonical
-- identity. This schema is the durable backing for the repository interfaces in
-- src/store/repositories.ts (implemented over `pg` in postgres-repositories.ts).
--
-- Design rules honoured here:
--   * BuildSnapshot holds normalized build state ONLY; calculated/derived values
--     are separate downstream artifacts (AD-7) — never columns on `snapshots`.
--   * Identity is the Canonical Identity computed over build state only (I2); it
--     is the primary key, so re-inserting an identical build is idempotent.
--   * Frozen build state / metadata / display cache are stored verbatim as jsonb
--     so a read can re-hydrate and re-validate the exact snapshot (I1/I6).
--   * Provenance is denormalized into columns for attribution + Aggregation-Engine
--     queries (charter §7.5, RFC-0001 §5.3) WITHOUT losing the authoritative copy
--     inside metadata jsonb.
--   * Raw Import Artifacts carry a time-boxed retention timestamp (AD-4, OQ-1).
--
-- Idempotent: safe to run repeatedly (CREATE TABLE/INDEX IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- BuildSnapshot — the narrow waist (RFC-0001). Immutable, hashed identity PK.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshots (
  -- Canonical Identity: sha256 hex over the canonically serialized build state.
  identity                text        PRIMARY KEY,

  -- Frozen canonical value graph, stored verbatim for exact re-hydration (I1/I6).
  build_state             jsonb       NOT NULL,
  metadata                jsonb       NOT NULL,
  display_cache           jsonb       NOT NULL,

  -- Provenance projection (source of truth stays in metadata->'provenance').
  -- Denormalized so attribution surfaces and the Aggregation Engine can query by
  -- source/author/time without unpacking jsonb on every row (charter §7.5).
  provenance_source       text        NOT NULL,
  provenance_reference    text,
  imported_at             timestamptz NOT NULL,
  attribution             text,
  raw_import_artifact_id  text,

  -- Version projection (I5): the game patch + snapshot-format version.
  patch_version           text        NOT NULL,
  format_version          text        NOT NULL,

  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Attribution / aggregation query paths.
CREATE INDEX IF NOT EXISTS snapshots_source_idx        ON snapshots (provenance_source);
CREATE INDEX IF NOT EXISTS snapshots_imported_at_idx   ON snapshots (imported_at DESC);
CREATE INDEX IF NOT EXISTS snapshots_patch_idx         ON snapshots (patch_version);
-- Re-normalization / debugging: find snapshots produced from a given raw artifact.
CREATE INDEX IF NOT EXISTS snapshots_raw_artifact_idx  ON snapshots (raw_import_artifact_id)
  WHERE raw_import_artifact_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- BuildMutation — immutable candidate deltas (AD-2). Deterministic id PK.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mutations (
  -- sha256 hex over (base_snapshot_id, operations) — operation order is semantic.
  mutation_id       text        PRIMARY KEY,
  base_snapshot_id  text        NOT NULL,
  -- Ordered operation list; order is preserved (apply sequence), so stored as an
  -- ordered jsonb array, never re-sorted.
  operations        jsonb       NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Optimizer: list candidate mutations for a base snapshot.
CREATE INDEX IF NOT EXISTS mutations_base_idx ON mutations (base_snapshot_id);

-- ---------------------------------------------------------------------------
-- Calculation Result — engine output artifact (AD-7). NEVER embedded in a
-- snapshot. Keyed by (snapshotId, mutationId?, engineVersion).
-- ---------------------------------------------------------------------------
-- mutationId is optional in the model (base results have none). Postgres primary
-- keys cannot contain NULLs, so the base case is stored as the empty-string
-- sentinel '' and mapped back to `undefined` on read. This keeps the natural
-- 3-column composite PK the task specifies.
CREATE TABLE IF NOT EXISTS calculation_results (
  snapshot_id     text        NOT NULL,
  mutation_id     text        NOT NULL DEFAULT '',  -- '' == base result (no mutation)
  engine_version  text        NOT NULL,
  metrics         jsonb       NOT NULL,
  computed_at     timestamptz NOT NULL,
  PRIMARY KEY (snapshot_id, mutation_id, engine_version)
);

-- latestForBuild(): newest BASE result for a snapshot across engine versions.
-- Partial index over base rows only, ordered for the LIMIT 1 lookup.
CREATE INDEX IF NOT EXISTS calc_results_base_latest_idx
  ON calculation_results (snapshot_id, computed_at DESC)
  WHERE mutation_id = '';

-- ---------------------------------------------------------------------------
-- Raw Import Artifact — importer-owned, time-boxed (AD-4). Never consumed
-- downstream; linked from a snapshot's provenance for re-normalization/debug.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_import_artifacts (
  artifact_id           text        PRIMARY KEY,
  source                text        NOT NULL,
  fetched_at            timestamptz NOT NULL,
  -- Opaque original payload (e.g. a pasted PoB code). Text, not jsonb: it is
  -- third-party-served content, never interpreted here.
  payload               text        NOT NULL,
  -- Retention window (AD-4 / OQ-1): rows past this instant are purge candidates.
  retention_expires_at  timestamptz NOT NULL,
  retention_note        text        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Retention sweep: purge expired artifacts efficiently.
CREATE INDEX IF NOT EXISTS raw_artifacts_retention_idx
  ON raw_import_artifacts (retention_expires_at);

-- ---------------------------------------------------------------------------
-- Report — an IMMUTABLE frozen snapshot of one result (shareable /r/{id}).
-- A report NEVER recomputes: build_summary / attribution / payload are frozen
-- verbatim at POST time and returned as-is, so a later change to the underlying
-- build cannot alter a shared report.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  report_id      text        PRIMARY KEY,
  build_id       text        NOT NULL,
  kind           text        NOT NULL,   -- 'overview' | 'doctor' | 'tune' | 'compare'
  frozen_at      timestamptz NOT NULL,
  -- Frozen at POST time; never re-derived on read.
  build_summary  jsonb       NOT NULL,
  attribution    text        NOT NULL,   -- charter §7.5: present on every shared report
  -- The result payload, stored verbatim.
  payload        jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Find reports for a build (e.g. a build's shared-report history).
CREATE INDEX IF NOT EXISTS reports_build_idx ON reports (build_id);

-- ---------------------------------------------------------------------------
-- User — a minimal anonymous account. AUTH SEAM: platform auth (Phase 1 item 5)
-- replaces this anonymous id with a real authenticated principal.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id     text        PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SavedBuild — a (user -> build) association (the saved-builds list).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_builds (
  user_id   text        NOT NULL,
  build_id  text        NOT NULL,
  saved_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

-- List a user's saved builds, oldest-first.
CREATE INDEX IF NOT EXISTS saved_builds_user_idx ON saved_builds (user_id, saved_at);
