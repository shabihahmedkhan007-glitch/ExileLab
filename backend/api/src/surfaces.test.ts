// Integration tests for the remaining product surfaces (Compare, Upgrades, Item
// swap, Wasted-stat finder, Reports, Users), driven end-to-end with fastify.inject.
// Every number asserted here is engine-computed and preference-scored — never
// invented — and prices are the SYNTHETIC mock, clearly labelled as such.

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { twisterHuntressJson, twisterHuntressBossJson } from "./fixtures.js";

async function importBuild(app: FastifyInstance, json: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/import", payload: { input: json } });
  expect(res.statusCode).toBe(201);
  return res.json().buildId as string;
}

describe("ExileLab product surfaces", () => {
  let app: FastifyInstance;
  let userId: string; // the pivot build
  let otherId: string; // the "public" build compared against

  beforeAll(async () => {
    app = await buildApp();
    userId = await importBuild(app, twisterHuntressJson());
    otherId = await importBuild(app, twisterHuntressBossJson());
  });

  // -- Compare --------------------------------------------------------------

  it("GET /builds/:id/compare diffs nodes and re-scores BOTH builds under the user's weights", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/builds/${userId}/compare?with=${otherId}&presetId=boss-farming`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Node diff: the two builds share some nodes and each has its own.
    expect(body.diff.nodes.onlyInUser).toEqual(expect.arrayContaining([5, 6, 11]));
    expect(body.diff.nodes.onlyInOther).toEqual(expect.arrayContaining([40, 41, 42]));
    expect(body.diff.nodes.shared.length).toBeGreaterThan(0);

    // The pivot's thesis row: both builds scored under the USER'S weights.
    expect(body.scoreRow.presetId).toBe("boss-farming");
    expect(typeof body.scoreRow.userScore).toBe("number");
    expect(typeof body.scoreRow.otherScoreUnderUserWeights).toBe("number");

    // The other build renders its provenance + attribution (charter §7.5).
    expect(body.other.provenance.source).toBe("native-json");

    // Candidates are Weighted-Score deltas with an auditable per-axis decomposition,
    // each attributed to the source build.
    expect(body.candidates.length).toBeGreaterThan(0);
    const top = body.candidates[0];
    expect(typeof top.description).toBe("string");
    expect(top.source.toLowerCase()).toContain("boss-farming guide");
    const summed = top.perAxis.reduce(
      (acc: number, a: { weightedDelta: number }) => acc + a.weightedDelta,
      0,
    );
    expect(summed).toBeCloseTo(top.delta, 6);

    // Candidates are ranked by delta, descending.
    const deltas = body.candidates.map((c: { delta: number }) => c.delta);
    for (let i = 1; i < deltas.length; i++) {
      expect(deltas[i - 1]).toBeGreaterThanOrEqual(deltas[i]);
    }
  });

  it("GET /builds/:id/compare 400s without a 'with' target", async () => {
    const res = await app.inject({ method: "GET", url: `/builds/${userId}/compare` });
    expect(res.statusCode).toBe(400);
  });

  it("POST /builds/:id/compare scores the thesis row under CUSTOM slider weights (Law 1)", async () => {
    // Audit regression: the user's live sliders must reach the compare scoring —
    // a custom-weights compare must NOT silently fall back to the default preset.
    const custom = await app.inject({
      method: "POST",
      url: `/builds/${userId}/compare`,
      payload: {
        with: otherId,
        weights: { Damage: 90, Survivability: 5, "Movement Speed": 5 },
      },
    });
    expect(custom.statusCode).toBe(200);
    const customBody = custom.json();
    expect(customBody.scoreRow.presetId).toBe("custom");

    const preset = await app.inject({
      method: "GET",
      url: `/builds/${userId}/compare?with=${otherId}`, // default preset
    });
    const presetBody = preset.json();

    // Different weights ⇒ different thesis-row scores (would be EQUAL under the
    // old silent-fallback bug).
    expect(customBody.scoreRow.userScore).not.toBeCloseTo(
      presetBody.scoreRow.userScore,
      6,
    );
    // And the candidate ordering responds to the weights too.
    const customOrder = customBody.candidates.map((c: { mutationId: string }) => c.mutationId);
    const presetOrder = presetBody.candidates.map((c: { mutationId: string }) => c.mutationId);
    expect(customOrder).not.toEqual(presetOrder);
  });

  it("POST /builds/:id/compare/import round-trips a pasted build for use as ?with=", async () => {
    const imported = await app.inject({
      method: "POST",
      url: `/builds/${userId}/compare/import`,
      payload: { input: twisterHuntressBossJson() },
    });
    expect(imported.statusCode).toBe(201);
    const { otherBuildId } = imported.json();
    // Deterministic identity: the boss fixture always imports to the same id.
    expect(otherBuildId).toBe(otherId);

    const compare = await app.inject({
      method: "GET",
      url: `/builds/${userId}/compare?with=${otherBuildId}`,
    });
    expect(compare.statusCode).toBe(200);
  });

  // -- Upgrades -------------------------------------------------------------

  it("POST /builds/:id/upgrades ranks by score-per-Divine, respects budget, and labels synthetic prices", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/builds/${userId}/upgrades`,
      payload: { budgetDivines: 100 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.priceDisclaimer).toContain("SYNTHETIC");
    expect(body.budgetDivines).toBe(100);

    for (const c of body.candidates) {
      expect(c.priceProvenance).toBe("synthetic-mock");
      expect(c.costDivines).toBeLessThanOrEqual(100);
      expect(c.costDivines).toBeGreaterThan(0);
      expect(c.scorePerDivine).toBeCloseTo(c.delta / c.costDivines, 6);
    }

    // Ranked by score-per-Divine, descending.
    const spd = body.candidates.map((c: { scorePerDivine: number }) => c.scorePerDivine);
    for (let i = 1; i < spd.length; i++) {
      expect(spd[i - 1]).toBeGreaterThanOrEqual(spd[i]);
    }
  });

  it("POST /builds/:id/upgrades excludes over-budget candidates", async () => {
    const all = (
      await app.inject({
        method: "POST",
        url: `/builds/${userId}/upgrades`,
        payload: { budgetDivines: 100 },
      })
    ).json();
    const maxCost = Math.max(
      ...all.candidates.map((c: { costDivines: number }) => c.costDivines),
    );
    // A budget just under the priciest candidate must exclude it.
    const tighter = maxCost - 0.05;
    const res = await app.inject({
      method: "POST",
      url: `/builds/${userId}/upgrades`,
      payload: { budgetDivines: tighter },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const c of body.candidates) {
      expect(c.costDivines).toBeLessThanOrEqual(tighter);
    }
    expect(body.candidates.length).toBeLessThan(all.candidates.length);
  });

  it("POST /builds/:id/upgrades 400s on a non-positive budget", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/builds/${userId}/upgrades`,
      payload: { budgetDivines: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  // -- Item swap ------------------------------------------------------------

  it("POST /builds/:id/itemswap parses item text, scores the swap, and decomposes the delta", async () => {
    const itemText = [
      "Rarity: Rare",
      "Hypnotic Grip",
      "Vaal Gauntlets",
      "--------",
      "+25% increased Attack Speed",
      "Adds 12 to 24 Physical Damage",
      "+55 to maximum Life",
    ].join("\n");
    const res = await app.inject({
      method: "POST",
      url: `/builds/${userId}/itemswap`,
      payload: { itemText },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.parsed.name).toBe("Hypnotic Grip");
    expect(body.parsed.rarity).toBe("rare");
    expect(body.parsed.slot).toBe("Gloves");
    expect(body.parsed.modifiers).toHaveLength(3);
    expect(typeof body.delta).toBe("number");
    expect(typeof body.belowFloor).toBe("boolean");
    const summed = body.perAxis.reduce(
      (acc: number, a: { weightedDelta: number }) => acc + a.weightedDelta,
      0,
    );
    expect(summed).toBeCloseTo(body.delta, 6);
    expect(body.description).toContain("Hypnotic Grip");
  });

  it("POST /builds/:id/itemswap 422s on unparseable text", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/builds/${userId}/itemswap`,
      payload: { itemText: "just some random words, not an item" },
    });
    expect(res.statusCode).toBe(422);
  });

  // -- Wasted-stat finder ---------------------------------------------------

  it("GET /builds/:id/wasted weights a finding's severity by the active preset's axis weight", async () => {
    const fast = (
      await app.inject({
        method: "GET",
        url: `/builds/${userId}/wasted?presetId=fast-mapping`,
      })
    ).json();
    const hardcore = (
      await app.inject({
        method: "GET",
        url: `/builds/${userId}/wasted?presetId=hardcore-survivability`,
      })
    ).json();

    expect(fast.presetId).toBe("fast-mapping");
    expect(hardcore.presetId).toBe("hardcore-survivability");

    const findFire = (r: {
      findings: Array<{ id: string; axisWeightedSeverity: number; evidence: unknown }>;
    }) => r.findings.find((f) => f.id === "overcapped-resist:fire");
    const fastFire = findFire(fast);
    const hardcoreFire = findFire(hardcore);
    expect(fastFire).toBeDefined();
    expect(hardcoreFire).toBeDefined();

    // An overcapped resist matters MORE under a Survivability-heavy preset.
    expect(hardcoreFire!.axisWeightedSeverity).toBeGreaterThan(
      fastFire!.axisWeightedSeverity,
    );
    // The overcap magnitude (deterministic engine evidence) is identical either way.
    expect(hardcoreFire!.evidence).toEqual(fastFire!.evidence);
  });

  // -- Reports --------------------------------------------------------------

  it("POST /reports freezes a result immutably; mutating the build afterwards does not change it", async () => {
    const payload = { grade: "B", findings: [{ id: "DOC-1", value: 42 }] };
    const created = await app.inject({
      method: "POST",
      url: "/reports",
      payload: { buildId: userId, kind: "doctor", payload },
    });
    expect(created.statusCode).toBe(201);
    const { reportId } = created.json();
    expect(typeof reportId).toBe("string");

    const before = (await app.inject({ method: "GET", url: `/reports/${reportId}` })).json();
    expect(before.kind).toBe("doctor");
    expect(before.payload).toEqual(payload);
    expect(before.attribution.length).toBeGreaterThan(0);
    expect((before.buildSummary as { buildId: string }).buildId).toBe(userId);

    // Promote a change off the SAME build (creates a new snapshot). The frozen
    // report must be unaffected — reports never recompute.
    const tune = await app.inject({
      method: "POST",
      url: `/builds/${userId}/tune`,
      payload: { presetId: "balanced" },
    });
    const mutationId = tune.json().recommendations[0].mutationId as string;
    await app.inject({
      method: "POST",
      url: `/builds/${userId}/promote`,
      payload: { mutationId },
    });

    const after = (await app.inject({ method: "GET", url: `/reports/${reportId}` })).json();
    expect(after.payload).toEqual(payload);
    expect((after.buildSummary as { buildId: string }).buildId).toBe(userId);
  });

  it("GET /reports/:id 404s for an unknown report", async () => {
    const res = await app.inject({ method: "GET", url: "/reports/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });

  // -- Users ----------------------------------------------------------------

  it("POST /users then save + list builds round-trips a saved build", async () => {
    const created = await app.inject({ method: "POST", url: "/users" });
    expect(created.statusCode).toBe(201);
    const { userId: accountId } = created.json();
    expect(typeof accountId).toBe("string");

    const saved = await app.inject({
      method: "POST",
      url: `/users/${accountId}/builds`,
      payload: { buildId: userId },
    });
    expect(saved.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: `/users/${accountId}/builds` });
    expect(list.statusCode).toBe(200);
    const builds = list.json().builds as Array<{ buildId: string }>;
    expect(builds.map((b) => b.buildId)).toContain(userId);
  });

  it("POST /users/:id/builds 404s for an unknown user", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/users/nobody/builds`,
      payload: { buildId: userId },
    });
    expect(res.statusCode).toBe(404);
  });
});

// -- Price-layer kill-switch (env seam) -------------------------------------

describe("Upgrades price-layer kill-switch", () => {
  const savedEnv = process.env.PRICE_PROVIDER;
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.PRICE_PROVIDER;
    else process.env.PRICE_PROVIDER = savedEnv;
  });

  it("returns 503 when PRICE_PROVIDER is switched off (never fabricates a price)", async () => {
    process.env.PRICE_PROVIDER = "none";
    const app = await buildApp();
    const buildId = await importBuild(app, twisterHuntressJson());
    const res = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/upgrades`,
      payload: { budgetDivines: 100 },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toContain("price layer unavailable");
  });

  it("Tune under a killed price layer shows NO costs and no disclaimer — and never fabricates", async () => {
    // Audit regression: Tune costs must flow through the same PriceProvider seam
    // as Upgrades. Kill-switched off → tune still works, but every cost chip is
    // absent and no price influences the Weighted Score.
    process.env.PRICE_PROVIDER = "none";
    const app = await buildApp();
    const buildId = await importBuild(app, twisterHuntressJson());
    const res = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "fast-mapping" },
    });
    expect(res.statusCode).toBe(200); // tune itself is NOT price-gated
    const body = res.json();
    for (const r of [...body.recommendations, ...body.belowFloor]) {
      expect(r.cost).toBeUndefined();
    }
    expect(body.priceProvenance).toBeUndefined();
    expect(body.priceDisclaimer).toBeUndefined();
  });

  it("Tune with the mock provider prices gear candidates and carries the disclaimer", async () => {
    process.env.PRICE_PROVIDER = "mock";
    const app = await buildApp();
    const buildId = await importBuild(app, twisterHuntressJson());
    const res = await app.inject({
      method: "POST",
      url: `/builds/${buildId}/tune`,
      payload: { presetId: "fast-mapping" },
    });
    const body = res.json();
    const all = [...body.recommendations, ...body.belowFloor];
    const priced = all.filter((r: { cost?: number }) => typeof r.cost === "number");
    expect(priced.length).toBeGreaterThan(0); // the gear swaps
    expect(body.priceProvenance).toBe("synthetic-mock");
    expect(typeof body.priceDisclaimer).toBe("string");
    // Free respecs (pure node allocations) never carry a chip.
    const nodeAlloc = body.recommendations.find((r: { description: string }) =>
      r.description.toLowerCase().includes("passive"),
    );
    if (nodeAlloc !== undefined) expect(nodeAlloc.cost).toBeUndefined();
  });
});
