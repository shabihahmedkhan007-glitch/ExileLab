// The Fastify application — a thin HTTP shell over ExileLabService.
//
// Routes mirror the product surfaces (UX_PRESENTATION §3/§4): import a build,
// read its measured overview, tune it under the player's weighted priorities,
// promote an accepted change to a new snapshot, and run the goal-aware Doctor.
// No route contacts an external platform (charter §7.5) — importers accept
// pasted/local payloads only.

import Fastify from "fastify";
import type { FastifyError, FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import { ExileLabService, HttpError } from "./services.js";
import type { TuneRequest, UpgradesRequest } from "./services.js";
import type { ReportKind } from "./store/repositories.js";
import { repositoriesFromEnv } from "./store/postgres-repositories.js";
import { coachFromEnv } from "./coach-config.js";
import { priceProviderFromEnv } from "./prices/index.js";
import { withCache } from "@exilelab/engine-adapter";
import {
  InMemoryCalculationResultStore,
  MockEngine,
} from "@exilelab/engine-adapter";
import type { BuildCoach } from "@exilelab/coach";

export interface BuildAppOptions {
  /** Inject a service (e.g. with seeded repositories) for tests. */
  service?: ExileLabService;
  /**
   * Inject a Build Coach (tests use a MockNarrationProvider-backed coach). Ignored
   * when `service` is supplied. Default: env-configured (disabled without a key).
   */
  coach?: BuildCoach;
  /** CORS origin for the web app (default http://localhost:3000). */
  corsOrigin?: string;
  /** Fastify logger toggle (off by default; the server script turns it on). */
  logger?: boolean;
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  // Repository selection by env (Open Task 11 §3): DATABASE_URL set → Postgres
  // (schema applied on connect); otherwise the in-memory default. Tests run with
  // DATABASE_URL unset and never touch a database. An injected service wins.
  const service =
    options.service ??
    new ExileLabService(
      await repositoriesFromEnv(),
      // Same default engine wiring the service uses internally (the seam lives in
      // engine-adapter, ADR-001); named here so an injected coach can be passed.
      withCache(new MockEngine(), new InMemoryCalculationResultStore()),
      options.coach ?? coachFromEnv(),
      // Price-layer kill-switch (UX §4.5): unset/'mock' → synthetic mock; anything
      // else → null, and the Upgrades route returns a typed 503 (charter §7.5).
      priceProviderFromEnv(),
    );
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, {
    origin: options.corsOrigin ?? "http://localhost:3000",
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    // Validation errors from Fastify's schema layer.
    if (error.statusCode === 400) {
      return reply.status(400).send({ error: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "internal error" });
  });

  // -- Health ---------------------------------------------------------------
  app.get("/health", async () => ({ status: "ok", engine: "mock" }));

  // -- Goal preset gallery (UX §3 /goals) -----------------------------------
  app.get("/goals", async () => ({ presets: service.listPresets() }));

  // -- Import ---------------------------------------------------------------
  app.post<{ Body: { input?: unknown } }>("/import", async (request, reply) => {
    const input = request.body?.input;
    if (typeof input !== "string") {
      throw new HttpError(400, "body must be { input: string }");
    }
    const result = await service.importBuild(input);
    return reply.status(201).send(result);
  });

  // -- Build overview -------------------------------------------------------
  app.get<{ Params: { id: string } }>("/builds/:id", async (request) => {
    return service.getBuild(request.params.id);
  });

  // -- Tune -----------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: TuneRequest }>(
    "/builds/:id/tune",
    async (request) => {
      return service.tuneBuild(request.params.id, request.body ?? {});
    },
  );

  // -- Promote --------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: { mutationId?: unknown } }>(
    "/builds/:id/promote",
    async (request, reply) => {
      const mutationId = request.body?.mutationId;
      if (typeof mutationId !== "string") {
        throw new HttpError(400, "body must be { mutationId: string }");
      }
      const result = await service.promote(request.params.id, mutationId);
      return reply.status(201).send(result);
    },
  );

  // -- Doctor ---------------------------------------------------------------
  app.get<{ Params: { id: string }; Querystring: { goal?: string; tier?: string } }>(
    "/builds/:id/doctor",
    async (request) => {
      const goal = request.query.goal;
      if (typeof goal !== "string" || goal.length === 0) {
        throw new HttpError(400, "query parameter 'goal' is required");
      }
      return service.doctor(request.params.id, goal, request.query.tier);
    },
  );

  // -- Compare (UX §4.4) ----------------------------------------------------
  // GET keeps the preset-only form (shareable URL); POST additionally accepts
  // the user's LIVE slider weights (Law 1 — the thesis row is scored under the
  // user's actual weights, never a silent preset fallback).
  app.get<{ Params: { id: string }; Querystring: { with?: string; presetId?: string } }>(
    "/builds/:id/compare",
    async (request) => {
      const other = request.query.with;
      if (typeof other !== "string" || other.length === 0) {
        throw new HttpError(400, "query parameter 'with' (the other build id) is required");
      }
      return service.compare(request.params.id, other, request.query.presetId);
    },
  );

  app.post<{
    Params: { id: string };
    Body: { with?: string; presetId?: string; weights?: Record<string, number> };
  }>("/builds/:id/compare", async (request) => {
    const other = request.body?.with;
    if (typeof other !== "string" || other.length === 0) {
      throw new HttpError(400, "body must include 'with' (the other build id)");
    }
    return service.compare(
      request.params.id,
      other,
      request.body?.presetId,
      request.body?.weights,
    );
  });

  app.post<{ Params: { id: string }; Body: { input?: unknown } }>(
    "/builds/:id/compare/import",
    async (request, reply) => {
      const input = request.body?.input;
      if (typeof input !== "string") {
        throw new HttpError(400, "body must be { input: string }");
      }
      const result = await service.compareImport(request.params.id, input);
      return reply.status(201).send(result);
    },
  );

  // -- Upgrades (UX §4.5) ---------------------------------------------------
  app.post<{ Params: { id: string }; Body: UpgradesRequest }>(
    "/builds/:id/upgrades",
    async (request) => {
      return service.upgrades(request.params.id, request.body ?? ({} as UpgradesRequest));
    },
  );

  // -- Item swap (UX §4.4) --------------------------------------------------
  app.post<{ Params: { id: string }; Body: { itemText?: unknown } }>(
    "/builds/:id/itemswap",
    async (request) => {
      const itemText = request.body?.itemText;
      if (typeof itemText !== "string") {
        throw new HttpError(400, "body must be { itemText: string }");
      }
      return service.itemSwap(request.params.id, itemText);
    },
  );

  // -- Wasted-stat finder ---------------------------------------------------
  app.get<{ Params: { id: string }; Querystring: { presetId?: string } }>(
    "/builds/:id/wasted",
    async (request) => {
      return service.wasted(request.params.id, request.query.presetId);
    },
  );

  // -- Reports (immutable frozen snapshots, shareable /r/{id}) ---------------
  app.post<{ Body: { buildId?: unknown; kind?: unknown; payload?: unknown } }>(
    "/reports",
    async (request, reply) => {
      const buildId = request.body?.buildId;
      const kind = request.body?.kind;
      if (typeof buildId !== "string" || typeof kind !== "string") {
        throw new HttpError(400, "body must be { buildId: string, kind: string, payload }");
      }
      const result = await service.createReport(
        buildId,
        kind as ReportKind,
        request.body?.payload,
      );
      return reply.status(201).send(result);
    },
  );

  app.get<{ Params: { id: string } }>("/reports/:id", async (request) => {
    return service.getReport(request.params.id);
  });

  // -- Users (anonymous account seam) ---------------------------------------
  app.post("/users", async (_request, reply) => {
    const result = await service.createUser();
    return reply.status(201).send(result);
  });

  app.post<{ Params: { id: string }; Body: { buildId?: unknown } }>(
    "/users/:id/builds",
    async (request, reply) => {
      const buildId = request.body?.buildId;
      if (typeof buildId !== "string") {
        throw new HttpError(400, "body must be { buildId: string }");
      }
      const result = await service.saveUserBuild(request.params.id, buildId);
      return reply.status(201).send(result);
    },
  );

  app.get<{ Params: { id: string } }>("/users/:id/builds", async (request) => {
    return service.listUserBuilds(request.params.id);
  });

  return app;
}
