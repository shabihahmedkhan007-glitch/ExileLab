// Start script for the ExileLab API. Listens on :3001, CORS-open to the web app
// on :3000. Real network listen (unlike the tests, which use fastify.inject).

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

// Load backend/api/.env if present (Node's native loader — no dotenv dep).
// Copy .env.example → .env and fill in OPENROUTER_API_KEY etc. Real env vars
// set in the shell take precedence over the file. .env is gitignored.
const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "127.0.0.1";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

async function main(): Promise<void> {
  const app = await buildApp({ logger: true, corsOrigin: CORS_ORIGIN });
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`ExileLab API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
