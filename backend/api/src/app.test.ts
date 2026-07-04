// Integration tests for the ExileLab API, driven end-to-end through the one-way
// pipeline with fastify.inject (no real network listen). One native-JSON build is
// imported, then read, tuned under two presets (asserting DIFFERENT orderings),
// diagnosed under two goals (asserting DIFFERENT severities), and a change is
// promoted (asserting a NEW build id, with the original left untouched).

import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { twisterHuntressJson } from "./fixtures.js";

async function importFixture(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/import",
    payload: { input: twisterHuntressJson() },
  });
  expect(res.statusCode).toBe(201);
  return res.json().buildId as string;
}

describe("ExileLab API", () => {
  let app: FastifyInstance;
  let buildId: string;

  beforeAll(async () => {
    app = await buildApp();
    buildId = await importFixture(app);
  });

  it("GET /health reports ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("POST /import returns a summary, provenance, mandatory attribution, and assumptions", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/import",
      payload: { input: twisterHuntressJson() },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();

    expect(typeof body.buildId).toBe("string");
    expect(body.summary.class).toBe("Huntress");
    expect(body.summary.level).toBe(92);
    expect(body.summary.mainSkill).toBe("Twister");

    // Compliance charter §7.5: attribution is ALWAYS present and non-empty.
    expect(typeof body.attribution).toBe("string");
    expect(body.attribution.length).toBeGreaterThan(0);
    expect(body.provenance.source).toBe("native-json");

    // Assumptions are declared (honesty over completeness, I3/I4).
    expect(Array.isArray(body.assumptions)).toBe(true);
    expect(body.assumptions.length).toBeGreaterThan(0);

    // Re-importing the same build is idempotent on buildId (deterministic identity).
    expect(body.buildId).toBe(buildId);
  });

  it("rejects unrecognised input with 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/import",
      payload: { input: "not a build" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /builds/:id returns the snapshot, a Calculation Result, and a suggested Goal Preset", async () => {
    const res = await app.inject({ method: "GET", url: `/builds/${buildId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.snapshot.identity).toBe(buildId);
    expect(body.calculation.key.snapshotId).toBe(buildId);
    expect(body.calculation.metrics.fullDPS).toBeGreaterThan(0);

    // The Context Detector classifies the attack-as-movement Twister build and
    // suggests a Goal Preset with a mechanic-naming rationale.
    expect(body.archetype.archetype).toBe("attack-as-movement");
    expect(body.archetype.suggestedPreset).toBe("Fast Mapping");
    expect(body.archetype.rationale).toContain("Twister");
  });

  it("GET /builds/:id 404s for an unknown build", async () => {
    const res = await app.inject({ method: "GET", url: "/builds/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /builds/:id/tune ranks changes and two presets produce DIFFERENT orderings", async () => {
    const fast = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "fast-mapping" },
    });
    const boss = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "boss-farming" },
    });
    expect(fast.statusCode).toBe(200);
    expect(boss.statusCode).toBe(200);

    const fastBody = fast.json();
    const bossBody = boss.json();

    expect(fastBody.recommendations.length).toBeGreaterThan(0);
    expect(bossBody.recommendations.length).toBeGreaterThan(0);

    // Each recommendation is a ScoreBar payload (UX §4.2): delta + per-axis
    // decomposition + description + cost; the decomposition sums to the delta.
    const top = fastBody.recommendations[0];
    expect(typeof top.description).toBe("string");
    expect(typeof top.cost).toBe("number");
    expect(Array.isArray(top.perAxis)).toBe(true);
    const summed = top.perAxis.reduce(
      (acc: number, a: { weightedDelta: number }) => acc + a.weightedDelta,
      0,
    );
    expect(summed).toBeCloseTo(top.delta, 6);

    // The player's priorities re-rank the SAME candidates differently — the pivot.
    const fastOrder = fastBody.recommendations.map((r: { mutationId: string }) => r.mutationId);
    const bossOrder = bossBody.recommendations.map((r: { mutationId: string }) => r.mutationId);
    expect(fastOrder).not.toEqual(bossOrder);
  });

  it("POST /builds/:id/tune excludes below-floor candidates under a survivability floor", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "hardcore-survivability" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // The glass-cannon swap drops EHP below the hard floor → it is CUT, not ranked.
    expect(body.belowFloor.length).toBeGreaterThan(0);
    const cut = body.belowFloor[0];
    expect(cut.description.toLowerCase()).toContain("glass-cannon");
    const metrics = cut.violatedFloors.map((v: { metric: string }) => v.metric);
    expect(metrics).toContain("totalEHP");

    // A cut candidate never appears in the ranked recommendations.
    const rankedIds = body.recommendations.map((r: { mutationId: string }) => r.mutationId);
    expect(rankedIds).not.toContain(cut.mutationId);
  });

  it("GET /builds/:id/doctor grades DIFFERENTLY under two goals", async () => {
    const fast = await app.inject({
      method: "GET",
      url: `/builds/${buildId}/doctor?goal=fast-mapping&tier=10`,
    });
    const hardcore = await app.inject({
      method: "GET",
      url: `/builds/${buildId}/doctor?goal=hardcore-survivability&tier=10`,
    });
    expect(fast.statusCode).toBe(200);
    expect(hardcore.statusCode).toBe(200);

    const fastReport = fast.json();
    const hardcoreReport = hardcore.json();

    // Same engine outputs, different goal → different defensive grade + verdict.
    expect(fastReport.grades.Defense).not.toBe(hardcoreReport.grades.Defense);
    expect(fastReport.verdict.severity).not.toBe(hardcoreReport.verdict.severity);

    // Every finding carries its evidence numbers (never invented downstream).
    expect(fastReport.findings.length).toBeGreaterThan(0);
    for (const finding of fastReport.findings) {
      expect(finding.evidence).toBeTypeOf("object");
    }
  });

  it("GET /builds/:id/doctor 400s without a goal", async () => {
    const res = await app.inject({ method: "GET", url: `/builds/${buildId}/doctor` });
    expect(res.statusCode).toBe(400);
  });

  it("POST /builds/:id/promote creates a NEW snapshot and leaves the original untouched", async () => {
    const tune = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "balanced" },
    });
    const mutationId = tune.json().recommendations[0].mutationId as string;

    const promote = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/promote`,
      payload: { mutationId },
    });
    expect(promote.statusCode).toBe(201);
    const body = promote.json();

    // A promotion yields a brand-new build id (immutability, AD-2/I1).
    expect(body.previousBuildId).toBe(buildId);
    expect(body.buildId).not.toBe(buildId);

    // The new build is retrievable; the original still exists unchanged.
    const newBuild = await app.inject({ method: "GET", url: `/builds/${body.buildId}` });
    expect(newBuild.statusCode).toBe(200);
    expect(newBuild.json().snapshot.identity).toBe(body.buildId);

    const original = await app.inject({ method: "GET", url: `/builds/${buildId}` });
    expect(original.statusCode).toBe(200);
    expect(original.json().snapshot.identity).toBe(buildId);
  });

  it("POST /builds/:id/promote 404s for an unknown mutation", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/promote`,
      payload: { mutationId: "deadbeef" },
    });
    expect(res.statusCode).toBe(404);
  });
});
