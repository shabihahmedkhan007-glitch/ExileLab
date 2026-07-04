// @exilelab/engine-adapter — the permanent calculation-engine boundary (ADR-001,
// RFC-0001 §5.2 / AD-6). Translates canonical BuildSnapshots into engine-side
// inputs, defines the EngineAdapter interface the real PoB2 LuaJIT sidecar will
// implement, ships a deterministic MockEngine stand-in, a result cache with an
// injectable store, and a conformance-suite harness that holds the boundary.

// The explicit translation layer (canonical model → engine-side input).
export type {
  EngineItem,
  EngineSkillGroup,
  EngineLoadout,
  EngineBuildInput,
} from './engine-input.js';
export { translateSnapshot } from './engine-input.js';

// The engine boundary interface + key helpers.
export type { EngineAdapter } from './adapter.js';
export { makeResultKey, serializeResultKey } from './adapter.js';

// The deterministic S1 stand-in.
export {
  MockEngine,
  computeMockMetrics,
  MOCK_ENGINE_VERSION,
  MOCK_COMPUTED_AT,
} from './mock-engine.js';
export type { MockEngineOptions } from './mock-engine.js';

// Result cache (injectable store).
export type { CalculationResultStore } from './cache.js';
export {
  InMemoryCalculationResultStore,
  CachingEngineAdapter,
  withCache,
} from './cache.js';

// Conformance-suite harness.
export type {
  ConformanceFixture,
  MetricMismatch,
  FixtureOutcome,
  ConformanceReport,
} from './conformance.js';
export { runFixture, runConformanceSuite } from './conformance.js';

// The MockEngine's own conformance fixtures (the first suite).
export {
  mockEngineFixtures,
  twoLoadoutInput,
  minimalInput,
  twoLoadoutMutation,
  TWO_LOADOUT_IDENTITY,
} from './fixtures.js';
