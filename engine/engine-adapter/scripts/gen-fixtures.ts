// Regenerate the golden metrics for the MockEngine conformance suite.
// Run: npx tsx scripts/gen-fixtures.ts   (from the package dir)
// Prints a JSON blob; paste the values into src/fixtures.ts on an INTENTIONAL
// formula change and review the diff.
import { createBuildSnapshot, createBuildMutation } from '@exilelab/core';
import { MockEngine } from '../src/mock-engine.js';
import { twoLoadoutInput, minimalInput, twoLoadoutMutation } from '../src/fixtures.js';

async function main(): Promise<void> {
  const engine = new MockEngine();

  const twoLoadout = createBuildSnapshot(twoLoadoutInput());
  const minimal = createBuildSnapshot(minimalInput());
  const mutation = createBuildMutation(twoLoadoutMutation(twoLoadout.identity));

  const base = await engine.calculate(twoLoadout);
  const min = await engine.calculate(minimal);
  const mutated = await engine.calculate(twoLoadout, mutation);

  const out = {
    TWO_LOADOUT_IDENTITY: twoLoadout.identity,
    GOLDEN_TWO_LOADOUT: base.metrics,
    GOLDEN_MINIMAL: min.metrics,
    GOLDEN_TWO_LOADOUT_MUTATED: mutated.metrics,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

void main();
