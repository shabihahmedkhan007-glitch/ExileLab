// The price layer seam (UX §4.5 "the shopping screen").
//
// COMPLIANCE (charter §7.5): ExileLab makes NO external network calls for market
// prices. The real price layer — polling official interchange endpoints
// (cxapi / poe2scout) under a compliance-reviewed service — is a LATER deliverable
// and lives behind THIS interface so it drops in with no route changes. Until it
// ships, every price the product shows is SYNTHETIC and clearly labelled as such
// (priceProvenance: 'synthetic-mock', a disclaimer on every response).
//
// Kill-switch pattern (mirrors the Build Coach): `priceProviderFromEnv` reads
// PRICE_PROVIDER. Only 'mock' is implemented; anything else resolves to `null`
// (unavailable), and the Upgrades route returns a typed 503 rather than inventing
// a number — the same "degrade visibly, never fabricate" posture as the LLM seam.

import { sha256Hex } from "@exilelab/core";
import type { BuildMutation, BuildSnapshot as CoreSnapshot } from "@exilelab/core";

/** A priced quote for a candidate change. */
export interface PriceQuote {
  /** Cost in Divines. */
  readonly divines: number;
}

/**
 * The price-layer boundary. The real compliance-reviewed poller will implement
 * this same interface; consumers depend on the interface, never on a source.
 */
export interface PriceProvider {
  /**
   * Price a candidate change (its target item/gear) against the base snapshot,
   * or `null` when the change is not priceable (e.g. a pure passive respec).
   */
  priceFor(mutation: BuildMutation, snapshot: CoreSnapshot): PriceQuote | null;
}

/** The only price provenance that exists today — synthetic, never live market data. */
export const SYNTHETIC_PRICE_PROVENANCE = "synthetic-mock" as const;
export type PriceProvenance = typeof SYNTHETIC_PRICE_PROVENANCE;

/** The disclaimer stamped on every priced response until the real layer ships. */
export const SYNTHETIC_PRICE_DISCLAIMER =
  "Prices are SYNTHETIC placeholder estimates from a deterministic mock, not live " +
  "market data. They will be replaced by the compliance-reviewed price layer " +
  "(official interchange endpoints only, charter §7.5).";

/** Deterministic unit float in [0, 1) seeded by a string (core sha256, cross-platform). */
function seededUnit(seed: string): number {
  const hex = sha256Hex(seed).slice(0, 13); // 13 hex digits = 52 bits
  return parseInt(hex, 16) / 0x10000000000000;
}

/**
 * synthetic — replaced by the compliance-reviewed price layer.
 *
 * A deterministic {@link PriceProvider}: it hashes the candidate mutation's id to
 * a plausible Divine price in [0.1, 50]. Same mutation ⇒ same price, always. It
 * performs no calculation and makes NO external calls — it exists only so the
 * Upgrades surface has stable, reproducible costs until the real poller slots in
 * behind this same interface.
 */
export class MockPriceProvider implements PriceProvider {
  /** synthetic price band, in Divines. */
  private static readonly MIN_DIV = 0.1;
  private static readonly MAX_DIV = 50;

  priceFor(mutation: BuildMutation, _snapshot: CoreSnapshot): PriceQuote {
    // Only gear-affecting changes carry a real cost; a pure respec is free. The
    // Upgrades pool is already gear-affecting, so every mutation here is priceable.
    const gearAffecting = mutation.operations.some((op) => op.kind === "swapItem");
    if (!gearAffecting) return { divines: 0 };
    const unit = seededUnit(`price:${mutation.mutationId}`);
    const raw =
      MockPriceProvider.MIN_DIV + unit * (MockPriceProvider.MAX_DIV - MockPriceProvider.MIN_DIV);
    return { divines: Math.round(raw * 10) / 10 }; // one-decimal Divine precision
  }
}

/**
 * Resolve the price provider from the environment (the kill-switch seam).
 *
 * PRICE_PROVIDER: unset or 'mock' ⇒ the deterministic {@link MockPriceProvider}.
 * ANY other value ⇒ `null` (the price layer is switched off / unimplemented), and
 * the Upgrades route returns a typed 503 instead of fabricating a price.
 */
export function priceProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PriceProvider | null {
  const kind = env.PRICE_PROVIDER?.trim() || "mock";
  if (kind === "mock") return new MockPriceProvider();
  return null;
}
