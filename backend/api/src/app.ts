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
import type { TuneRequest } from "./services.js";

export interface BuildAppOptions {
  /** Inject a service (e.g. with seeded repositories) for tests. */
  service?: ExileLabService;
  /** CORS origin for the web app (default http://localhost:3000). */
  corsOrigin?: string;
  /** Fastify logger toggle (off by default; the server script turns it on). */
  logger?: boolean;
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const service = options.service ?? new ExileLabService();
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
    const result = service.importBuild(input);
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
      const result = service.promote(request.params.id, mutationId);
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

  return app;
}
