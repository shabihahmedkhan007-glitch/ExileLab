// Build Coach ↔ API integration tests (no network — MockNarrationProvider only).
//
// Verifies the narration contract at the HTTP boundary:
//   • a faithful coach adds a `narration` field whose text PASSES the guardrail
//     against the served findings (doctor) and the served candidates (tune);
//   • a number-inventing coach → NO narration field, response otherwise identical
//     (silent degradation, kill-switch);
//   • no coach (default disabled) → NO narration field anywhere.

import { describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createBuildCoach,
  MockNarrationProvider,
  validateNarration,
  UnlimitedBudgetGuard,
} from "@exilelab/coach";
import type {
  BuildCoach,
  DoctorNarrationInput,
  TuneNarrationInput,
} from "@exilelab/coach";
import { buildApp } from "./app.js";
import { twisterHuntressJson } from "./fixtures.js";
import { doctorNarrationInput, tuneNarrationInput } from "./coach-input.js";

function coachWith(mode: "faithful" | "invents-number"): BuildCoach {
  return createBuildCoach({
    enabled: true,
    provider: new MockNarrationProvider({ mode }),
    // Never gate on budget in these tests.
    budget: new UnlimitedBudgetGuard(),
  });
}

async function appWithCoach(coach?: BuildCoach): Promise<{
  app: FastifyInstance;
  buildId: string;
}> {
  const app = await buildApp(coach ? { coach } : {});
  const res = await app.inject({
    method: "POST",
    url: "/import",
    payload: { input: twisterHuntressJson() },
  });
  return { app, buildId: res.json().buildId as string };
}

describe("Doctor narration", () => {
  it("adds a narration whose text passes the guardrail against the served findings", async () => {
    const { app, buildId } = await appWithCoach(coachWith("faithful"));
    const res = await app.inject({
      method: "GET",
      url: `/builds/${buildId}/doctor?goal=hardcore-survivability&tier=10`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.narration).toBeDefined();
    expect(typeof body.narration.text).toBe("string");
    expect(body.narration.text.length).toBeGreaterThan(0);
    expect(typeof body.narration.inputHash).toBe("string");

    // Independently re-derive the exact NarrationInput the API narrated and confirm
    // the served text passes the guardrail against those very findings.
    const detail = await app.inject({ method: "GET", url: `/builds/${buildId}` });
    const archetype = detail.json().archetype;
    const input: DoctorNarrationInput = doctorNarrationInput(
      body,
      "hardcore-survivability",
      archetype,
    );
    expect(validateNarration(body.narration.text, input).ok).toBe(true);
  });

  it("number-inventing coach → NO narration field, report otherwise identical", async () => {
    const invent = await appWithCoach(coachWith("invents-number"));
    const clean = await appWithCoach(); // default: disabled coach

    const url = `/builds/${invent.buildId}/doctor?goal=fast-mapping&tier=10`;
    const inventRes = await invent.app.inject({ method: "GET", url });
    const cleanRes = await clean.app.inject({
      method: "GET",
      url: `/builds/${clean.buildId}/doctor?goal=fast-mapping&tier=10`,
    });

    const inventBody = inventRes.json();
    const cleanBody = cleanRes.json();

    // Silent degradation: no narration field despite an enabled coach.
    expect(inventBody.narration).toBeUndefined();
    // The rest of the report is byte-identical to the no-coach response.
    expect(inventBody).toEqual(cleanBody);
  });

  it("no coach (default disabled) → NO narration field", async () => {
    const { app, buildId } = await appWithCoach();
    const res = await app.inject({
      method: "GET",
      url: `/builds/${buildId}/doctor?goal=fast-mapping&tier=10`,
    });
    expect(res.json().narration).toBeUndefined();
  });
});

describe("Tune narration", () => {
  it("adds a narration whose text passes the guardrail against the served candidates", async () => {
    const { app, buildId } = await appWithCoach(coachWith("faithful"));
    const res = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "fast-mapping" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.narration).toBeDefined();
    const detail = await app.inject({ method: "GET", url: `/builds/${buildId}` });
    const archetype = detail.json().archetype;
    const input: TuneNarrationInput = tuneNarrationInput(
      body.recommendations,
      "fast-mapping",
      archetype,
    );
    expect(validateNarration(body.narration.text, input).ok).toBe(true);
  });

  it("number-inventing coach → NO narration field on tune", async () => {
    const { app, buildId } = await appWithCoach(coachWith("invents-number"));
    const res = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "fast-mapping" },
    });
    expect(res.json().narration).toBeUndefined();
  });
});
